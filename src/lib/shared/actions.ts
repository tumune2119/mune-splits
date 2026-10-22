/**
 * Applies one edit to a shared event: the same actions and the same rules as the local store
 * (src/lib/core/store.ts applyEventAction), but instead of SQL it plans Firestore writes and returns
 * the updated event. Pure, so it is unit-tested without Firebase.
 */
import { nanoid } from "nanoid";
import { EventActionSchema, EventFields, ExpenseFields, type EventAction } from "../event-actions";
import { validateExpense } from "../splits";
import { eventMath } from "../event-math";
import { minorDigits } from "../money";
import { PERSON_COLORS, today } from "../constants";
import { UserError } from "../core/store";
import { eventDocOf, expenseDocOf, settlementDocOf, type SharedWrite } from "./model";
import type { EventDetail, Expense, Person } from "../types";

export interface Plan {
  next: EventDetail;
  writes: SharedWrite[];
}

function checkExpense(event: EventDetail, raw: unknown) {
  const e = ExpenseFields.parse(raw);
  const ids = new Set(event.participants.map((p) => p.id));
  if (e.payers.some((p) => !ids.has(p.personId)) || e.split.some((s) => !ids.has(s.personId))) {
    throw new UserError("Everyone in an expense must be in the event.");
  }
  const payers = e.payers.filter((p) => p.amount > 0);
  const split = e.mode === "equal" ? e.split : e.split.filter((s) => s.value > 0);
  const problem = validateExpense({ amount: e.amount, payers, mode: e.mode, split });
  if (problem) throw new UserError(problem);
  return { ...e, payers, split };
}

export function planSharedAction(
  event: EventDetail,
  input: EventAction,
  opts: { me: string | null; now?: number; newId?: () => string } = { me: null },
): Plan {
  const action = EventActionSchema.parse(input);
  const now = opts.now ?? Date.now();
  const newId = opts.newId ?? (() => nanoid(12));
  if (event.status === "settled" && action.type !== "set-status") {
    throw new UserError("This event is settled and read-only. Reopen it to make changes.");
  }
  const next: EventDetail = structuredClone(event);
  const writes: SharedWrite[] = [];

  switch (action.type) {
    case "update": {
      const f = action.fields;
      if (f.currency && f.currency !== event.currency) {
        const hasMoney = event.expenses.length > 0 || event.settlements.length > 0;
        if (hasMoney && minorDigits(f.currency) !== minorDigits(event.currency)) {
          throw new UserError(`Can't switch to ${f.currency}: it uses different decimal places and this event already has amounts.`);
        }
      }
      const merged = EventFields.parse({
        name: event.name,
        description: event.description,
        emoji: event.emoji,
        color: event.color,
        currency: event.currency,
        startDate: event.startDate,
        endDate: event.endDate,
        ...f,
      });
      Object.assign(next, merged);
      break;
    }
    case "add-participant": {
      const name = action.name?.trim();
      if (!name) throw new UserError("Enter a name.");
      if (next.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new UserError(`${name} is already in this event.`);
      }
      const person: Person = {
        id: newId(),
        name: name.slice(0, 60),
        color: PERSON_COLORS[next.participants.length % PERSON_COLORS.length],
        isMe: false,
        hidden: false,
        createdAt: now,
      };
      next.participants.push(person);
      break;
    }
    case "remove-participant": {
      const id = action.personId;
      const used =
        event.expenses.some((e) => e.payers.some((p) => p.personId === id) || e.split.some((s) => s.personId === id)) ||
        event.settlements.some((s) => s.fromId === id || s.toId === id);
      if (used) throw new UserError("They're part of expenses or payments here. Remove them from those first.");
      if (id === opts.me) throw new UserError("You can't remove yourself. Leave the event instead.");
      next.participants = next.participants.filter((p) => p.id !== id);
      break;
    }
    case "add-expense":
    case "restore-expense": {
      const e = checkExpense(event, action.expense);
      const restoring = action.type === "restore-expense";
      const id = restoring ? action.expense.id : newId();
      const x: Expense = {
        id,
        eventId: event.id,
        ...e,
        createdAt: restoring ? action.expense.createdAt : now,
        updatedAt: now,
        createdBy: opts.me,
      };
      next.expenses = [x, ...next.expenses.filter((y) => y.id !== id)];
      writes.push({ kind: "set-expense", id, data: expenseDocOf(x) });
      break;
    }
    case "update-expense": {
      const old = event.expenses.find((x) => x.id === action.id);
      if (!old) throw new UserError("That expense was deleted by someone else.");
      const e = checkExpense(event, action.expense);
      const x: Expense = { ...old, ...e, updatedAt: now };
      next.expenses = next.expenses.map((y) => (y.id === x.id ? x : y));
      writes.push({ kind: "set-expense", id: x.id, data: expenseDocOf(x) });
      break;
    }
    case "delete-expense":
      next.expenses = next.expenses.filter((x) => x.id !== action.id);
      writes.push({ kind: "delete-expense", id: action.id });
      break;
    case "add-settlement": {
      const ids = new Set(event.participants.map((p) => p.id));
      if (!ids.has(action.fromId) || !ids.has(action.toId)) throw new UserError("Both people must be in the event.");
      if (action.fromId === action.toId) throw new UserError("Choose two different people.");
      const s = {
        id: newId(),
        eventId: event.id,
        fromId: action.fromId,
        toId: action.toId,
        amount: action.amount,
        date: action.date ?? today(),
        note: action.note,
        createdAt: now,
        createdBy: opts.me,
      };
      next.settlements = [s, ...next.settlements];
      writes.push({ kind: "set-settlement", id: s.id, data: settlementDocOf(s) });
      break;
    }
    case "delete-settlement":
      next.settlements = next.settlements.filter((s) => s.id !== action.id);
      writes.push({ kind: "delete-settlement", id: action.id });
      break;
    case "set-status": {
      if (action.status === "settled" && !eventMath(event).settled) {
        throw new UserError("Everyone needs to be at zero before the event can be marked settled.");
      }
      next.status = action.status;
      next.settledAt = action.status === "settled" ? now : null;
      break;
    }
  }

  next.updatedAt = now;
  // Edits to the event itself rewrite its doc (inside a transaction, see client.ts); everything else
  // only bumps updatedAt, so it can never overwrite a person someone else just added.
  writes.unshift(touchesEventDoc(action) ? { kind: "set-event", data: eventDocOf(next) } : { kind: "touch-event", updatedAt: now });
  return { next, writes };
}

/** True when an action changes the event doc's own fields (people, details, status). */
export const touchesEventDoc = (a: EventAction) => ["update", "add-participant", "remove-participant", "set-status"].includes(a.type);
