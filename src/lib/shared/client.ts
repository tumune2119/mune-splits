"use client";

/**
 * Talks to Firestore for shared events: live subscriptions, edits (planned by ./actions), sharing a
 * local event, receipts. Firestore keeps an offline copy on the device, so a shared event still opens
 * and takes new expenses without a connection; they sync when it's back.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { nanoid } from "nanoid";
import { firebaseConfig, firestoreEmulator } from "./config";
import { planSharedAction, touchesEventDoc } from "./actions";
import {
  eventDocOf,
  expenseDocOf,
  settlementDocOf,
  toEventDetail,
  type SharedEventDoc,
  type SharedExpenseDoc,
  type SharedReceiptDoc,
  type SharedSettlementDoc,
  type SharedWrite,
} from "./model";
import { eventMath } from "../event-math";
import { newReceiptName } from "../core/store";
import { blobToDataUrl, shrinkImage } from "../client/images";
import type { EventAction } from "../event-actions";
import type { EventDetail, EventSummary } from "../types";

let firestore: Firestore | null = null;

function db(): Firestore {
  if (firestore) return firestore;
  if (!firebaseConfig) throw new Error("Sharing isn't set up in this build.");
  const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  try {
    firestore = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    firestore = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  if (firestoreEmulator) {
    const [host, port] = firestoreEmulator.split(":");
    connectFirestoreEmulator(firestore, host, Number(port));
  }
  return firestore;
}

const eventRef = (sid: string) => doc(db(), "events", sid) as DocumentReference<SharedEventDoc>;
const sub = (sid: string, name: "expenses" | "settlements" | "receipts") => collection(db(), "events", sid, name);

export const newShareId = () => nanoid(24);

/** Writes aren't awaited (so the app stays instant offline); if the server later rejects one, say so. */
const SYNC_ERROR = "mune:sync-error";
const reportSyncError = (err: unknown) => window.dispatchEvent(new CustomEvent(SYNC_ERROR, { detail: (err as Error)?.message ?? String(err) }));
export function onSyncError(fn: (message: string) => void) {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(SYNC_ERROR, h);
  return () => window.removeEventListener(SYNC_ERROR, h);
}

/* ---- reading ------------------------------------------------------------------------------- */

export interface RemoteChange {
  text: string;
}

/**
 * Live view of a shared event. `onChange` fires with the whole event whenever anything changes
 * (here or on another device); `onRemote` describes changes other people made.
 */
export function subscribeEvent(
  sid: string,
  me: string | null,
  onChange: (e: EventDetail | null) => void,
  onRemote: (c: RemoteChange) => void,
  onError: (err: Error) => void,
): () => void {
  let docData: SharedEventDoc | null | undefined;
  let expenses: [string, SharedExpenseDoc][] | undefined;
  let settlements: [string, SharedSettlementDoc][] | undefined;
  let ready = { expenses: false, settlements: false };
  const emit = () => {
    if (docData === undefined || !expenses || !settlements) return;
    onChange(docData === null ? null : toEventDetail(sid, docData, expenses, settlements, me));
  };
  const nameOf = (id: string | null) => docData?.people.find((p) => p.id === id)?.name ?? "Someone";

  const unsubs = [
    onSnapshot(eventRef(sid), (snap) => {
      docData = snap.exists() ? (snap.data() as SharedEventDoc) : null;
      emit();
    }, onError),
    onSnapshot(sub(sid, "expenses"), (snap) => {
      if (ready.expenses) {
        for (const c of snap.docChanges()) {
          const x = c.doc.data() as SharedExpenseDoc;
          if (c.doc.metadata.hasPendingWrites || x.by === me) continue;
          if (c.type === "added") onRemote({ text: `${nameOf(x.by)} added “${x.title}”` });
          else if (c.type === "removed") onRemote({ text: `“${x.title}” was deleted` });
          else onRemote({ text: `${nameOf(x.by)}'s “${x.title}” was edited` });
        }
      }
      expenses = snap.docs.map((d) => [d.id, d.data() as SharedExpenseDoc]);
      ready = { ...ready, expenses: true };
      emit();
    }, onError),
    onSnapshot(sub(sid, "settlements"), (snap) => {
      if (ready.settlements) {
        for (const c of snap.docChanges()) {
          const s = c.doc.data() as SharedSettlementDoc;
          if (c.doc.metadata.hasPendingWrites || s.by === me || c.type !== "added") continue;
          onRemote({ text: `${nameOf(s.fromId)} paid ${nameOf(s.toId)}` });
        }
      }
      settlements = snap.docs.map((d) => [d.id, d.data() as SharedSettlementDoc]);
      ready = { ...ready, settlements: true };
      emit();
    }, onError),
  ];
  return () => unsubs.forEach((u) => u());
}

/** One-off read (join screen, home list). Null if the link points nowhere. */
export async function getSharedEvent(sid: string, me: string | null): Promise<EventDetail | null> {
  const snap = await getDoc(eventRef(sid));
  if (!snap.exists()) return null;
  const [ex, st] = await Promise.all([getDocs(sub(sid, "expenses")), getDocs(sub(sid, "settlements"))]);
  return toEventDetail(
    sid,
    snap.data(),
    ex.docs.map((d) => [d.id, d.data() as SharedExpenseDoc]),
    st.docs.map((d) => [d.id, d.data() as SharedSettlementDoc]),
    me,
  );
}

export function summarize(e: EventDetail): EventSummary {
  const math = eventMath(e);
  const me = e.participants.find((p) => p.isMe);
  return {
    ...e,
    shared: true,
    participants: e.participants.map(({ id, name, color, isMe }) => ({ id, name, color, isMe })),
    total: math.total,
    expenseCount: e.expenses.length,
    myNet: me ? math.balanceOf(me.id).net : null,
    outstanding: math.outstanding,
    lastExpenseAt: e.expenses.reduce<number | null>((m, x) => Math.max(m ?? 0, x.createdAt), null),
  };
}

/* ---- writing ------------------------------------------------------------------------------- */

/** What a WriteBatch and a Transaction have in common. */
interface Stager {
  set(ref: DocumentReference, data: object): unknown;
  update(ref: DocumentReference, data: object): unknown;
  delete(ref: DocumentReference): unknown;
}

function stage(batch: Stager, sid: string, writes: SharedWrite[]) {
  for (const w of writes) {
    switch (w.kind) {
      case "set-event":
        batch.set(eventRef(sid), w.data);
        break;
      case "touch-event":
        batch.update(eventRef(sid), { updatedAt: w.updatedAt });
        break;
      case "set-expense":
        batch.set(doc(sub(sid, "expenses"), w.id), w.data);
        break;
      case "delete-expense":
        batch.delete(doc(sub(sid, "expenses"), w.id));
        break;
      case "set-settlement":
        batch.set(doc(sub(sid, "settlements"), w.id), w.data);
        break;
      case "delete-settlement":
        batch.delete(doc(sub(sid, "settlements"), w.id));
        break;
    }
  }
}

/**
 * Applies an edit. Expense and payment edits are plain writes (they also work offline and sync later);
 * edits to the event itself (people, details, status) run in a transaction against the latest copy, so
 * two people adding someone at the same moment can't overwrite each other.
 */
export async function applySharedAction(current: EventDetail, action: EventAction): Promise<EventDetail> {
  const sid = current.shared!.sid;
  const me = current.shared!.me;
  if (!touchesEventDoc(action)) {
    const plan = planSharedAction(current, action, { me });
    const batch = writeBatch(db());
    stage(batch, sid, plan.writes);
    // Don't wait for the server: Firestore applies it locally at once and syncs when online.
    void batch.commit().catch(reportSyncError);
    return plan.next;
  }
  if (!navigator.onLine) throw new Error("You're offline. Changing people or event details needs a connection.");
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(eventRef(sid));
    if (!snap.exists()) throw new Error("This event was deleted.");
    const latest = toEventDetail(sid, snap.data(), current.expenses.map((x) => [x.id, expenseDocOf(x)]), current.settlements.map((s) => [s.id, settlementDocOf(s)]), me);
    const plan = planSharedAction(latest, action, { me });
    stage(tx, sid, plan.writes);
    return plan.next;
  });
}

/** Adds a person to the event and returns their id (used by "I'm not on the list"). */
export async function joinAsNewPerson(sid: string, name: string): Promise<string> {
  const current = await getSharedEvent(sid, null);
  if (!current) throw new Error("This event no longer exists.");
  const next = await applySharedAction({ ...current, shared: { sid, me: null } }, { type: "add-participant", name });
  const person = next.participants.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  if (!person) throw new Error("Couldn't add you to the event.");
  return person.id;
}

/**
 * Uploads a local (on-device) event so it can be shared. The device's own person ("You", id "me")
 * gets a fresh id; everyone else keeps theirs. Returns the share id and this device's person id.
 */
export async function shareLocalEvent(
  local: EventDetail,
  receiptBlob: (name: string) => Promise<Blob | null>,
  myName: string,
): Promise<{ sid: string; me: string }> {
  const sid = newShareId();
  const meId = nanoid(12);
  const id = (pid: string) => (pid === "me" ? meId : pid);
  const now = Date.now();
  const event: EventDetail = {
    ...local,
    id: sid,
    updatedAt: now,
    // Friends see this list when they pick who they are, so "You" becomes your real name.
    participants: local.participants.map((p) => ({ ...p, id: id(p.id), name: p.id === "me" ? myName : p.name })),
    expenses: local.expenses.map((x) => ({
      ...x,
      payers: x.payers.map((p) => ({ ...p, personId: id(p.personId) })),
      split: x.split.map((s) => ({ ...s, personId: id(s.personId) })),
      createdBy: meId,
    })),
    settlements: local.settlements.map((s) => ({ ...s, fromId: id(s.fromId), toId: id(s.toId), createdBy: meId })),
  };

  // Firestore batches hold up to 500 writes; receipts go one per doc (each a small JPEG).
  const docs: [DocumentReference, object][] = [
    [eventRef(sid), eventDocOf(event)],
    ...event.expenses.map((x): [DocumentReference, object] => [doc(sub(sid, "expenses"), x.id), expenseDocOf(x)]),
    ...event.settlements.map((s): [DocumentReference, object] => [doc(sub(sid, "settlements"), s.id), settlementDocOf(s)]),
  ];
  for (const x of event.expenses) {
    if (!x.receipt) continue;
    const blob = await receiptBlob(x.receipt).catch(() => null);
    const data = blob && (await receiptData(blob));
    if (data) docs.push([doc(sub(sid, "receipts"), x.receipt), { data, createdAt: now } satisfies SharedReceiptDoc]);
  }
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db());
    for (const [ref, data] of docs.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }
  return { sid, me: meId };
}

/** Deletes a shared event for everyone. */
export async function deleteSharedEvent(sid: string) {
  const refs: DocumentReference[] = [];
  for (const name of ["expenses", "settlements", "receipts"] as const) {
    refs.push(...(await getDocs(sub(sid, name))).docs.map((d) => d.ref));
  }
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db());
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  const batch = writeBatch(db());
  batch.delete(eventRef(sid));
  await batch.commit();
}

/* ---- receipts ------------------------------------------------------------------------------ */

const MAX_RECEIPT_DOC = 900_000; // Firestore documents are capped at 1 MiB.

async function receiptData(blob: Blob): Promise<string | null> {
  let small = await shrinkImage(blob, 1400, 0.72, 0);
  if (small.size > 600_000) small = await shrinkImage(small, 1000, 0.6, 0);
  const url = await blobToDataUrl(small);
  return url.length <= MAX_RECEIPT_DOC ? url : null;
}

export async function uploadSharedReceipt(sid: string, file: File): Promise<string> {
  const data = await receiptData(file);
  if (!data) throw new Error("That file is too large to share. Try a photo, or a smaller PDF (under about 600 KB).");
  const mime = data.slice(5, data.indexOf(";"));
  const name = newReceiptName(mime, 0);
  const batch = writeBatch(db());
  batch.set(doc(sub(sid, "receipts"), name), { data, createdAt: Date.now() } satisfies SharedReceiptDoc);
  void batch.commit().catch(reportSyncError);
  return name;
}

export async function sharedReceiptUrl(sid: string, name: string): Promise<string | null> {
  const snap = await getDoc(doc(sub(sid, "receipts"), name));
  return snap.exists() ? (snap.data() as SharedReceiptDoc).data : null;
}
