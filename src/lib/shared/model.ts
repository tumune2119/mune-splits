/**
 * Shared events live in Firestore so everyone with the link sees the same thing, live:
 *
 *   events/{sid}                     the event + its people   (sid = the secret in the share link)
 *   events/{sid}/expenses/{id}       one doc per expense
 *   events/{sid}/settlements/{id}    one doc per payment
 *   events/{sid}/receipts/{name}     receipt images (small JPEGs as data: URLs)
 *
 * There are no accounts: knowing the sid is what grants access (see firestore.rules), and each device
 * remembers which person it is in each event. These shapes convert to the app's EventDetail so every
 * screen, the maths and the PDF work unchanged.
 */
import type { Payer, SplitEntry, SplitMode } from "../splits";
import type { EventDetail, EventStatus, Expense, Person, Settlement } from "../types";

export interface SharedPerson {
  id: string;
  name: string;
  color: string;
}

export interface SharedEventDoc {
  v: 1;
  name: string;
  description: string;
  emoji: string;
  color: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  settledAt: number | null;
  createdAt: number;
  updatedAt: number;
  people: SharedPerson[];
}

export interface SharedExpenseDoc {
  title: string;
  amount: number;
  date: string;
  category: string;
  payers: Payer[];
  mode: SplitMode;
  split: SplitEntry[];
  notes: string;
  receipt: string | null;
  createdAt: number;
  updatedAt: number;
  /** Person id of whoever added it (null when unknown). */
  by: string | null;
}

export interface SharedSettlementDoc {
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  note: string;
  createdAt: number;
  by: string | null;
}

export interface SharedReceiptDoc {
  data: string;
  createdAt: number;
}

/** A Firestore change, planned without touching Firestore (so it can be tested). */
export type SharedWrite =
  | { kind: "set-event"; data: SharedEventDoc }
  /** Only bumps updatedAt, so a concurrent edit to the people list is never overwritten. */
  | { kind: "touch-event"; updatedAt: number }
  | { kind: "set-expense"; id: string; data: SharedExpenseDoc }
  | { kind: "delete-expense"; id: string }
  | { kind: "set-settlement"; id: string; data: SharedSettlementDoc }
  | { kind: "delete-settlement"; id: string };

export function toEventDetail(
  sid: string,
  doc: SharedEventDoc,
  expenses: [string, SharedExpenseDoc][],
  settlements: [string, SharedSettlementDoc][],
  me: string | null,
): EventDetail {
  const participants: Person[] = doc.people.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isMe: p.id === me,
    hidden: false,
    createdAt: doc.createdAt,
  }));
  const ex: Expense[] = expenses
    .map(([id, e]) => ({
      id,
      eventId: sid,
      title: e.title,
      amount: e.amount,
      date: e.date,
      category: e.category,
      payers: e.payers,
      mode: e.mode,
      split: e.split,
      notes: e.notes ?? "",
      receipt: e.receipt ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      createdBy: e.by ?? null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const st: Settlement[] = settlements
    .map(([id, s]) => ({ id, eventId: sid, fromId: s.fromId, toId: s.toId, amount: s.amount, date: s.date, note: s.note ?? "", createdAt: s.createdAt, createdBy: s.by ?? null }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    id: sid,
    name: doc.name,
    description: doc.description ?? "",
    emoji: doc.emoji ?? "",
    color: doc.color ?? "",
    currency: doc.currency,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    status: doc.status,
    settledAt: doc.settledAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    participants,
    expenses: ex,
    settlements: st,
    shared: { sid, me },
  };
}

export function eventDocOf(e: EventDetail): SharedEventDoc {
  return {
    v: 1,
    name: e.name,
    description: e.description,
    emoji: e.emoji,
    color: e.color,
    currency: e.currency,
    startDate: e.startDate,
    endDate: e.endDate,
    status: e.status,
    settledAt: e.settledAt,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    people: e.participants.map(({ id, name, color }) => ({ id, name, color })),
  };
}

export function expenseDocOf(x: Expense): SharedExpenseDoc {
  return {
    title: x.title,
    amount: x.amount,
    date: x.date,
    category: x.category,
    payers: x.payers,
    mode: x.mode,
    split: x.split,
    notes: x.notes,
    receipt: x.receipt,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    by: x.createdBy ?? null,
  };
}

export function settlementDocOf(s: Settlement): SharedSettlementDoc {
  return { fromId: s.fromId, toId: s.toId, amount: s.amount, date: s.date, note: s.note, createdAt: s.createdAt, by: s.createdBy ?? null };
}
