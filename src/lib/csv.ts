import { describeSplit, eventMath, payersLabel } from "./event-math";
import { minorDigits, toMajor } from "./money";
import { SPLIT_MODE_LABELS } from "./constants";
import type { EventDetail } from "./types";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per expense with each participant's share in its own column, then the settlements. */
export function eventToCsv(event: EventDetail): string {
  const math = eventMath(event);
  const cur = event.currency;
  const amt = (minor: number) => toMajor(minor, cur).toFixed(minorDigits(cur));
  const names = event.participants.map((p) => p.name);
  const rows: (string | number)[][] = [
    ["Date", "Title", "Category", "Paid by", `Amount (${cur})`, "Split mode", "Split detail", "Notes", ...names.map((n) => `${n} share`)],
  ];
  for (const e of [...event.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const shares = math.sharesByExpense.get(e.id)!;
    rows.push([
      e.date,
      e.title,
      e.category,
      e.payers.length > 1 ? e.payers.map((p) => `${math.people.get(p.personId)?.name} ${amt(p.amount)}`).join(" + ") : payersLabel(e, math.people),
      amt(e.amount),
      SPLIT_MODE_LABELS[e.mode],
      describeSplit(e, math.people),
      e.notes,
      ...event.participants.map((p) => amt(shares.get(p.id) ?? 0)),
    ]);
  }
  rows.push([]);
  rows.push(["Settlements"]);
  rows.push(["Date", "From", "To", `Amount (${cur})`, "Note"]);
  for (const s of event.settlements) {
    rows.push([s.date, math.people.get(s.fromId)?.name ?? "?", math.people.get(s.toId)?.name ?? "?", amt(s.amount), s.note]);
  }
  rows.push([]);
  rows.push(["Balances"]);
  rows.push(["Person", "Paid", "Share", "Sent", "Received", "Net"]);
  for (const b of math.balances) {
    rows.push([math.people.get(b.personId)?.name ?? "?", amt(b.paid), amt(b.share), amt(b.sent), amt(b.received), amt(b.net)]);
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
