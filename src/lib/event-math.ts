/**
 * Everything derived from one event's records: balances, suggested transfers, and the totals the
 * overview, balances tab and PDF report show. Pure, so it runs on the server and in the browser.
 */
import {
  computeBalances,
  computeShares,
  isAllSettled,
  pairwiseDebts,
  simplifyDebts,
  type Balance,
  type ExpenseInput,
  type Transfer,
} from "./splits";
import type { EventDetail, Expense, Person } from "./types";

export function toInput(e: Pick<Expense, "amount" | "payers" | "mode" | "split">): ExpenseInput {
  return { amount: e.amount, payers: e.payers, mode: e.mode, split: e.split };
}

export interface EventMath {
  people: Map<string, Person>;
  total: number;
  balances: Balance[];
  balanceOf: (id: string) => Balance;
  transfers: Transfer[];
  rawTransfers: Transfer[];
  settled: boolean;
  outstanding: number;
  sharesByExpense: Map<string, Map<string, number>>;
  byCategory: { name: string; amount: number; count: number }[];
  byDay: { date: string; amount: number }[];
}

export function eventMath(event: Pick<EventDetail, "participants" | "expenses" | "settlements">): EventMath {
  const ids = event.participants.map((p) => p.id);
  const people = new Map(event.participants.map((p) => [p.id, p]));
  const inputs = event.expenses.map(toInput);
  const balances = computeBalances(ids, inputs, event.settlements);
  const byId = new Map(balances.map((b) => [b.personId, b]));
  const transfers = simplifyDebts(balances);

  const sharesByExpense = new Map<string, Map<string, number>>();
  event.expenses.forEach((e, i) => sharesByExpense.set(e.id, computeShares(inputs[i])));

  const cats = new Map<string, { amount: number; count: number }>();
  const days = new Map<string, number>();
  for (const e of event.expenses) {
    const c = cats.get(e.category) ?? { amount: 0, count: 0 };
    c.amount += e.amount;
    c.count += 1;
    cats.set(e.category, c);
    days.set(e.date, (days.get(e.date) ?? 0) + e.amount);
  }

  return {
    people,
    total: event.expenses.reduce((s, e) => s + e.amount, 0),
    balances,
    balanceOf: (id) => byId.get(id) ?? { personId: id, paid: 0, share: 0, sent: 0, received: 0, net: 0 },
    transfers,
    rawTransfers: pairwiseDebts(inputs, event.settlements, ids),
    settled: isAllSettled(balances),
    outstanding: transfers.reduce((s, t) => s + t.amount, 0),
    sharesByExpense,
    byCategory: [...cats].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
    byDay: [...days].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** "Sam ×2, Lee ×0.5" for weighted splits, "40% / 60%" style text for percent, names otherwise. */
export function describeSplit(e: Expense, people: Map<string, Person>): string {
  const name = (id: string) => people.get(id)?.name ?? "?";
  const active = e.split.filter((s) => e.mode === "equal" || s.value > 0);
  switch (e.mode) {
    case "equal":
      return active.length === people.size ? "Everyone equally" : `Equally: ${active.map((s) => name(s.personId)).join(", ")}`;
    case "shares": {
      const weighted = active.filter((s) => s.value !== 1);
      const plain = active.filter((s) => s.value === 1);
      if (weighted.length === 0) return active.map((s) => name(s.personId)).join(", ") + " ×1";
      const parts = weighted.map((s) => `${name(s.personId)} ×${trimNum(s.value)}`);
      if (plain.length === 1) parts.push(`${name(plain[0].personId)} ×1`);
      else if (plain.length > 1) parts.push("others ×1");
      return parts.join(", ");
    }
    case "percent":
      return active.map((s) => `${name(s.personId)} ${trimNum(s.value)}%`).join(", ");
    case "exact":
      return active.map((s) => name(s.personId)).join(", ");
  }
}

export function trimNum(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function payersLabel(e: Expense, people: Map<string, Person>): string {
  return e.payers.map((p) => people.get(p.personId)?.name ?? "?").join(" + ");
}
