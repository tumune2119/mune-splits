/**
 * MUNE Splits data layer: every read and write of events, people, expenses, payments and settings.
 * Platform-neutral: it talks to SQLite through ./sql (better-sqlite3 on the desktop server, sql.js on
 * phones) and never touches the file system. Receipt files are handled by each platform.
 */
import { nanoid } from "nanoid";
import { getDb } from "./sql";
import { DEFAULT_SETTINGS, PERSON_COLORS, today } from "../constants";
import { minorDigits } from "../money";
import { validateExpense } from "../splits";
import { eventMath } from "../event-math";
import {
  EventActionSchema,
  EventFields,
  ExpenseFields,
  NewEventSchema,
  type EventAction,
  type NewEvent,
} from "../event-actions";
import type { AppSettings, EventBase, EventDetail, EventStatus, EventSummary, Expense, Person, Settlement } from "../types";

export class NotFoundError extends Error {}
export class UserError extends Error {}

/* ------------------------------------------------------------------ settings */

export function getSettings(): AppSettings {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'app'").get() as { value: string } | undefined;
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  try {
    const saved = JSON.parse(row.value) as Partial<AppSettings>;
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...saved,
      categories: saved.categories?.length ? saved.categories : DEFAULT_SETTINGS.categories,
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(next: AppSettings) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
      JSON.stringify(next),
    );
    db.prepare("UPDATE people SET name = ? WHERE is_me = 1").run(next.myName.trim() || "You");
  })();
}

/* -------------------------------------------------------------------- people */

interface PersonRow {
  id: string;
  name: string;
  color: string;
  is_me: number;
  hidden: number;
  created_at: number;
}
const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  color: r.color,
  isMe: r.is_me === 1,
  hidden: r.hidden === 1,
  createdAt: r.created_at,
});

export interface PersonWithStats extends Person {
  eventCount: number;
}

export function listPeople(includeHidden = false): PersonWithStats[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM event_people ep WHERE ep.person_id = p.id) AS event_count
       FROM people p ${includeHidden ? "" : "WHERE p.hidden = 0"}
       ORDER BY p.is_me DESC, event_count DESC, p.name COLLATE NOCASE`,
    )
    .all() as (PersonRow & { event_count: number })[];
  return rows.map((r) => ({ ...toPerson(r), eventCount: r.event_count }));
}

function nextColor(): string {
  const n = (getDb().prepare("SELECT COUNT(*) AS n FROM people").get() as { n: number }).n;
  return PERSON_COLORS[n % PERSON_COLORS.length];
}

/** Finds a person by name (case-insensitive) or creates them. Un-hides a hidden match. */
export function ensurePerson(name: string, color?: string): Person {
  const db = getDb();
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new UserError("Enter a name.");
  const existing = db.prepare("SELECT * FROM people WHERE name = ? COLLATE NOCASE AND is_me = 0").get(clean) as PersonRow | undefined;
  if (existing) {
    if (existing.hidden) db.prepare("UPDATE people SET hidden = 0 WHERE id = ?").run(existing.id);
    return toPerson({ ...existing, hidden: 0 });
  }
  const row: PersonRow = { id: nanoid(10), name: clean, color: color ?? nextColor(), is_me: 0, hidden: 0, created_at: Date.now() };
  db.prepare("INSERT INTO people (id, name, color, is_me, hidden, created_at) VALUES (@id, @name, @color, @is_me, @hidden, @created_at)").run(row);
  return toPerson(row);
}

export function updatePerson(id: string, fields: { name?: string; color?: string; hidden?: boolean }) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!row) throw new NotFoundError("Person not found");
  const name = fields.name?.trim() || row.name;
  if (row.is_me && fields.name !== undefined) {
    // The owner's name lives in settings too.
    saveSettings({ ...getSettings(), myName: name });
  }
  db.prepare("UPDATE people SET name = ?, color = ?, hidden = ? WHERE id = ?").run(
    name,
    fields.color ?? row.color,
    row.is_me ? 0 : fields.hidden === undefined ? row.hidden : Number(fields.hidden),
    id,
  );
}

/** Deletes someone who isn't in any event; otherwise hides them from quick-add. Returns what happened. */
export function deletePerson(id: string): "deleted" | "hidden" {
  const db = getDb();
  const row = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!row) throw new NotFoundError("Person not found");
  if (row.is_me) throw new UserError("You can't remove yourself.");
  const used = (db.prepare("SELECT COUNT(*) AS n FROM event_people WHERE person_id = ?").get(id) as { n: number }).n;
  if (used) {
    db.prepare("UPDATE people SET hidden = 1 WHERE id = ?").run(id);
    return "hidden";
  }
  db.prepare("DELETE FROM people WHERE id = ?").run(id);
  return "deleted";
}

/* -------------------------------------------------------------------- events */

interface EventRow {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: EventStatus;
  settled_at: number | null;
  created_at: number;
  updated_at: number;
}
const toEvent = (r: EventRow): EventBase => ({
  id: r.id,
  name: r.name,
  description: r.description,
  emoji: r.emoji,
  color: r.color,
  currency: r.currency,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  settledAt: r.settled_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface ExpenseRow {
  id: string;
  event_id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  payers: string;
  split_mode: Expense["mode"];
  split: string;
  notes: string;
  receipt: string | null;
  created_at: number;
  updated_at: number;
}
const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  eventId: r.event_id,
  title: r.title,
  amount: r.amount,
  date: r.date,
  category: r.category,
  payers: JSON.parse(r.payers),
  mode: r.split_mode,
  split: JSON.parse(r.split),
  notes: r.notes,
  receipt: r.receipt,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface SettlementRow {
  id: string;
  event_id: string;
  from_id: string;
  to_id: string;
  amount: number;
  date: string;
  note: string;
  created_at: number;
}
const toSettlement = (r: SettlementRow): Settlement => ({
  id: r.id,
  eventId: r.event_id,
  fromId: r.from_id,
  toId: r.to_id,
  amount: r.amount,
  date: r.date,
  note: r.note,
  createdAt: r.created_at,
});

export function getEvent(id: string): EventDetail | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
  if (!row) return null;
  const participants = (
    db
      .prepare("SELECT p.* FROM event_people ep JOIN people p ON p.id = ep.person_id WHERE ep.event_id = ? ORDER BY ep.position")
      .all(id) as PersonRow[]
  ).map(toPerson);
  const expenses = (
    db.prepare("SELECT * FROM expenses WHERE event_id = ? ORDER BY date DESC, created_at DESC").all(id) as ExpenseRow[]
  ).map(toExpense);
  const settlements = (
    db.prepare("SELECT * FROM settlements WHERE event_id = ? ORDER BY created_at DESC").all(id) as SettlementRow[]
  ).map(toSettlement);
  return { ...toEvent(row), participants, expenses, settlements };
}

export function listEventSummaries(): EventSummary[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM events ORDER BY updated_at DESC").all() as EventRow[];
  return rows.map((r) => {
    const detail = getEvent(r.id)!;
    const math = eventMath(detail);
    const me = detail.participants.find((p) => p.isMe);
    return {
      ...toEvent(r),
      participants: detail.participants.map(({ id, name, color, isMe }) => ({ id, name, color, isMe })),
      total: math.total,
      expenseCount: detail.expenses.length,
      myNet: me ? math.balanceOf(me.id).net : null,
      outstanding: math.outstanding,
      lastExpenseAt: detail.expenses.reduce<number | null>((m, e) => Math.max(m ?? 0, e.createdAt), null),
    };
  });
}

function touch(id: string) {
  getDb().prepare("UPDATE events SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

function addParticipant(eventId: string, personId: string) {
  const db = getDb();
  const pos = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM event_people WHERE event_id = ?").get(eventId) as { p: number }).p;
  db.prepare("INSERT OR IGNORE INTO event_people (event_id, person_id, position) VALUES (?, ?, ?)").run(eventId, personId, pos);
}

export function createEvent(input: NewEvent): EventDetail {
  const data = NewEventSchema.parse(input);
  const db = getDb();
  const id = nanoid(10);
  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO events (id, name, description, emoji, color, currency, start_date, end_date, status, settled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
    ).run(id, data.name, data.description, data.emoji, data.color, data.currency, data.startDate, data.endDate, now, now);
    addParticipant(id, "me");
    for (const pid of data.personIds) {
      if (db.prepare("SELECT 1 FROM people WHERE id = ?").get(pid)) addParticipant(id, pid);
    }
    for (const name of data.newPeople) addParticipant(id, ensurePerson(name).id);
  })();
  return getEvent(id)!;
}

export function deleteEvent(id: string) {
  const res = getDb().prepare("DELETE FROM events WHERE id = ?").run(id);
  if (res.changes === 0) throw new NotFoundError("Event not found");
}

function checkExpense(event: EventDetail, raw: unknown) {
  const e = ExpenseFields.parse(raw);
  const ids = new Set(event.participants.map((p) => p.id));
  if (e.payers.some((p) => !ids.has(p.personId)) || e.split.some((s) => !ids.has(s.personId))) {
    throw new UserError("Everyone in an expense must be in the event.");
  }
  // Drop zero-amount payers, and zero entries in modes where zero means "not included".
  const payers = e.payers.filter((p) => p.amount > 0);
  const split = e.mode === "equal" ? e.split : e.split.filter((s) => s.value > 0);
  const problem = validateExpense({ amount: e.amount, payers, mode: e.mode, split });
  if (problem) throw new UserError(problem);
  return { ...e, payers, split };
}

/** Applies one edit to an event and returns the updated event. */
export function applyEventAction(eventId: string, input: EventAction): EventDetail {
  const action = EventActionSchema.parse(input);
  const db = getDb();
  const event = getEvent(eventId);
  if (!event) throw new NotFoundError("Event not found");
  if (event.status === "settled" && action.type !== "set-status") {
    throw new UserError("This event is settled and read-only. Reopen it to make changes.");
  }
  const now = Date.now();

  db.transaction(() => {
    switch (action.type) {
      case "update": {
        const f = action.fields;
        if (f.currency && f.currency !== event.currency) {
          const hasMoney = event.expenses.length > 0 || event.settlements.length > 0;
          if (hasMoney && minorDigits(f.currency) !== minorDigits(event.currency)) {
            throw new UserError(`Can't switch to ${f.currency}: it uses different decimal places and this event already has amounts.`);
          }
        }
        const merged = EventFields.parse({ ...toFields(event), ...f });
        db.prepare(
          "UPDATE events SET name = ?, description = ?, emoji = ?, color = ?, currency = ?, start_date = ?, end_date = ? WHERE id = ?",
        ).run(merged.name, merged.description, merged.emoji, merged.color, merged.currency, merged.startDate, merged.endDate, eventId);
        break;
      }
      case "add-participant": {
        const personId = action.personId ?? (action.name ? ensurePerson(action.name).id : null);
        if (!personId || !db.prepare("SELECT 1 FROM people WHERE id = ?").get(personId)) throw new UserError("Person not found.");
        db.prepare("UPDATE people SET hidden = 0 WHERE id = ?").run(personId);
        addParticipant(eventId, personId);
        break;
      }
      case "remove-participant": {
        const used =
          event.expenses.some((e) => e.payers.some((p) => p.personId === action.personId) || e.split.some((s) => s.personId === action.personId)) ||
          event.settlements.some((s) => s.fromId === action.personId || s.toId === action.personId);
        if (used) throw new UserError("They're part of expenses or payments here. Remove them from those first.");
        db.prepare("DELETE FROM event_people WHERE event_id = ? AND person_id = ?").run(eventId, action.personId);
        break;
      }
      case "add-expense":
      case "restore-expense": {
        const e = checkExpense(event, action.expense);
        const id = action.type === "restore-expense" ? action.expense.id : nanoid(10);
        const createdAt = action.type === "restore-expense" ? action.expense.createdAt : now;
        db.prepare(
          `INSERT INTO expenses (id, event_id, title, amount, date, category, payers, split_mode, split, notes, receipt, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, eventId, e.title, e.amount, e.date, e.category, JSON.stringify(e.payers), e.mode, JSON.stringify(e.split), e.notes, e.receipt, createdAt, now);
        break;
      }
      case "update-expense": {
        const e = checkExpense(event, action.expense);
        const res = db
          .prepare(
            `UPDATE expenses SET title = ?, amount = ?, date = ?, category = ?, payers = ?, split_mode = ?, split = ?, notes = ?, receipt = ?, updated_at = ?
             WHERE id = ? AND event_id = ?`,
          )
          .run(e.title, e.amount, e.date, e.category, JSON.stringify(e.payers), e.mode, JSON.stringify(e.split), e.notes, e.receipt, now, action.id, eventId);
        if (res.changes === 0) throw new NotFoundError("Expense not found");
        break;
      }
      case "delete-expense":
        // The receipt file is kept for undo; unreferenced files are cleaned up on a later start.
        db.prepare("DELETE FROM expenses WHERE id = ? AND event_id = ?").run(action.id, eventId);
        break;
      case "add-settlement": {
        const ids = new Set(event.participants.map((p) => p.id));
        if (!ids.has(action.fromId) || !ids.has(action.toId)) throw new UserError("Both people must be in the event.");
        if (action.fromId === action.toId) throw new UserError("Choose two different people.");
        db.prepare(
          "INSERT INTO settlements (id, event_id, from_id, to_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(nanoid(10), eventId, action.fromId, action.toId, action.amount, action.date ?? today(), action.note, now);
        break;
      }
      case "delete-settlement":
        db.prepare("DELETE FROM settlements WHERE id = ? AND event_id = ?").run(action.id, eventId);
        break;
      case "set-status": {
        if (action.status === "settled" && !eventMath(event).settled) {
          throw new UserError("Everyone needs to be at zero before the event can be marked settled.");
        }
        db.prepare("UPDATE events SET status = ?, settled_at = ? WHERE id = ?").run(
          action.status,
          action.status === "settled" ? now : null,
          eventId,
        );
        break;
      }
    }
    touch(eventId);
  })();

  return getEvent(eventId)!;
}

function toFields(e: EventBase) {
  return {
    name: e.name,
    description: e.description,
    emoji: e.emoji,
    color: e.color,
    currency: e.currency,
    startDate: e.startDate,
    endDate: e.endDate,
  };
}

/* ------------------------------------------------------------------ receipts */

export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};
export const RECEIPT_MAX_BYTES = 12 * 1024 * 1024;

/** A new random receipt file name for this MIME type (throws for unsupported types). */
export function newReceiptName(mime: string, size: number): string {
  const ext = RECEIPT_TYPES[mime];
  if (!ext) throw new UserError("Receipts can be JPG, PNG, WEBP, GIF, HEIC or PDF.");
  if (size > RECEIPT_MAX_BYTES) throw new UserError("That file is over 12 MB.");
  return `${nanoid(14)}${ext}`;
}

export const isReceiptName = (name: string) => /^[\w-]{6,40}\.(jpg|png|webp|gif|heic|pdf)$/.test(name);

export function receiptMime(name: string): string {
  const ext = name.slice(name.lastIndexOf("."));
  return Object.entries(RECEIPT_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

/** Receipt names some expense still points to. */
export function usedReceipts(): Set<string> {
  return new Set(
    (getDb().prepare("SELECT receipt FROM expenses WHERE receipt IS NOT NULL").all() as { receipt: string }[]).map((r) => r.receipt),
  );
}

/* -------------------------------------------------------------------- backup */

export interface BackupFile {
  app: "mune-splits";
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  people: Person[];
  events: (EventDetail & { participantIds: string[] })[];
  /** Receipt images as data: URLs, keyed by file name. */
  receipts: Record<string, string>;
}

/** Everything except receipt files, which the platform layer adds (it knows where they live). */
export function exportAll(): BackupFile {
  const db = getDb();
  const events = (db.prepare("SELECT id FROM events ORDER BY created_at").all() as { id: string }[]).map((r) => {
    const e = getEvent(r.id)!;
    return { ...e, participantIds: e.participants.map((p) => p.id) };
  });
  return {
    app: "mune-splits",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    people: listPeople(true).map(({ eventCount, ...p }) => p),
    events,
    receipts: {},
  };
}

/** Restores a backup (the platform layer stores `data.receipts`). "merge" keeps existing data (same ids are overwritten); "replace" wipes first. */
export function importBackup(data: BackupFile, mode: "merge" | "replace"): { events: number; people: number } {
  const db = getDb();
  db.transaction(() => {
    if (mode === "replace") wipe();
    if (data.settings) saveSettings({ ...getSettings(), ...data.settings });
    const upsertPerson = db.prepare(
      `INSERT INTO people (id, name, color, is_me, hidden, created_at) VALUES (@id, @name, @color, @is_me, @hidden, @created_at)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, hidden = excluded.hidden`,
    );
    for (const p of data.people) {
      upsertPerson.run({ id: p.id, name: p.name, color: p.color, is_me: p.isMe ? 1 : 0, hidden: p.hidden ? 1 : 0, created_at: p.createdAt });
    }
    for (const e of data.events) {
      db.prepare("DELETE FROM events WHERE id = ?").run(e.id);
      db.prepare(
        `INSERT INTO events (id, name, description, emoji, color, currency, start_date, end_date, status, settled_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(e.id, e.name, e.description ?? "", e.emoji ?? "", e.color ?? "", e.currency, e.startDate, e.endDate, e.status, e.settledAt, e.createdAt, e.updatedAt);
      (e.participantIds ?? e.participants.map((p) => p.id)).forEach((pid, i) =>
        db.prepare("INSERT OR IGNORE INTO event_people (event_id, person_id, position) VALUES (?, ?, ?)").run(e.id, pid, i),
      );
      for (const x of e.expenses) {
        db.prepare(
          `INSERT INTO expenses (id, event_id, title, amount, date, category, payers, split_mode, split, notes, receipt, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(x.id, e.id, x.title, x.amount, x.date, x.category, JSON.stringify(x.payers), x.mode, JSON.stringify(x.split), x.notes ?? "", x.receipt, x.createdAt, x.updatedAt);
      }
      for (const s of e.settlements) {
        db.prepare(
          "INSERT INTO settlements (id, event_id, from_id, to_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(s.id, e.id, s.fromId, s.toId, s.amount, s.date, s.note ?? "", s.createdAt);
      }
    }
  })();
  return { events: data.events.length, people: data.people.length };
}

function wipe() {
  const db = getDb();
  db.exec("DELETE FROM settlements; DELETE FROM expenses; DELETE FROM event_people; DELETE FROM events; DELETE FROM people WHERE is_me = 0;");
}

/** Settings → Clear all data. Keeps the owner and resets settings (the platform layer deletes receipts). */
export function clearAll() {
  const db = getDb();
  db.transaction(() => {
    wipe();
    db.prepare("DELETE FROM settings").run();
    db.prepare("UPDATE people SET name = 'You', color = '#FFB38A' WHERE is_me = 1").run();
  })();
}

export { EventActionSchema };
