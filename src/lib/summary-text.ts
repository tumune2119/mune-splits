import { formatRange } from "./format";
import type { EventMath } from "./event-math";
import type { EventDetail } from "./types";

/** Plain-text summary for pasting into WhatsApp (uses *bold*, which WhatsApp renders). */
export function summaryText(event: EventDetail, math: EventMath, money: (minor: number) => string, locale: string): string {
  const name = (id: string) => math.people.get(id)?.name ?? "?";
  const lines: string[] = [];
  lines.push(`*${event.emoji ? event.emoji + " " : ""}${event.name}*`);
  const range = formatRange(event.startDate, event.endDate, locale);
  if (range) lines.push(range);
  lines.push("");
  lines.push(`Total spent: *${money(math.total)}* across ${event.expenses.length} expense${event.expenses.length === 1 ? "" : "s"}`);
  lines.push("");
  lines.push("*Each person*");
  for (const b of math.balances) {
    const status = b.net > 0 ? `gets back ${money(b.net)}` : b.net < 0 ? `owes ${money(-b.net)}` : "all square";
    lines.push(`• ${name(b.personId)}: paid ${money(b.paid)}, share ${money(b.share)} → ${status}`);
  }
  lines.push("");
  if (math.transfers.length === 0) {
    lines.push("✅ Everyone is settled up!");
  } else {
    lines.push("*To settle up*");
    for (const t of math.transfers) lines.push(`• ${name(t.fromId)} → ${name(t.toId)}: *${money(t.amount)}*`);
  }
  if (event.settlements.length) {
    lines.push("");
    lines.push("*Already paid*");
    for (const s of [...event.settlements].reverse()) lines.push(`• ${name(s.fromId)} → ${name(s.toId)}: ${money(s.amount)} (${s.date})`);
  }
  lines.push("");
  lines.push("_Generated with MUNE Splits_");
  return lines.join("\n");
}
