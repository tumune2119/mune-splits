"use client";

import { Paperclip } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { categoryColor, findCategory } from "@/lib/constants";
import { describeSplit, payersLabel, type EventMath } from "@/lib/event-math";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventDetail, Expense } from "@/lib/types";

/** One expense: category tile, title, who paid / how it's split, amount and what it means for you. */
export function ExpenseRow({
  expense: e,
  event,
  math,
  onOpen,
  showDate = false,
}: {
  expense: Expense;
  event: EventDetail;
  math: EventMath;
  onOpen: (e: Expense) => void;
  showDate?: boolean;
}) {
  const { settings, fmt, theme } = useApp();
  const cat = findCategory(settings.categories, e.category);
  const color = categoryColor(settings.categories, e.category, theme);
  const me = event.participants.find((p) => p.isMe);
  const myPaid = me ? (e.payers.find((p) => p.personId === me.id)?.amount ?? 0) : 0;
  const myShare = me ? (math.sharesByExpense.get(e.id)?.get(me.id) ?? 0) : 0;
  const delta = myPaid - myShare;

  return (
    <button
      onClick={() => onOpen(e)}
      className="group flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60"
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${color}24` }}>
        {cat.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{e.title}</span>
          {e.receipt && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has receipt" />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {showDate && `${formatDate(e.date, settings.locale)} · `}
          {payersLabel(e, math.people)} paid · {e.mode === "exact" ? "Exact: " : e.mode === "shares" ? "Shares: " : ""}
          {describeSplit(e, math.people)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="money block font-semibold">{fmt(e.amount, event.currency)}</span>
        {me && (
          <span className={cn("money block text-xs", delta > 0 ? "text-owed" : delta < 0 ? "text-owe" : "text-muted-foreground")}>
            {delta > 0 ? `you lent ${fmt(delta, event.currency)}` : delta < 0 ? `you owe ${fmt(-delta, event.currency)}` : myShare || myPaid ? "you're even" : "not involved"}
          </span>
        )}
      </span>
    </button>
  );
}
