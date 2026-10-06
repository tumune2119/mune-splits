"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { ExpenseRow } from "@/components/event/expense-row";
import { findCategory } from "@/lib/constants";
import { formatDateLong } from "@/lib/format";
import type { EventMath } from "@/lib/event-math";
import { cn } from "@/lib/utils";
import type { EventDetail, Expense } from "@/lib/types";

export function ExpensesTab({
  event,
  math,
  onOpenExpense,
  onAdd,
  readOnly,
}: {
  event: EventDetail;
  math: EventMath;
  onOpenExpense: (e: Expense) => void;
  onAdd: () => void;
  readOnly: boolean;
}) {
  const { settings, fmt } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return event.expenses.filter((e) => {
      if (category && e.category !== category) return false;
      if (!q) return true;
      const names = e.payers.map((p) => math.people.get(p.personId)?.name ?? "").join(" ");
      return `${e.title} ${e.notes} ${e.category} ${names}`.toLowerCase().includes(q);
    });
  }, [event.expenses, query, category, math.people]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const used = math.byCategory.map((c) => c.name);
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  if (event.expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="font-medium">Nothing logged yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Every expense you add shows up here, grouped by day.</p>
        {!readOnly && (
          <Button className="mt-5 h-10 rounded-xl" onClick={onAdd}>
            <Plus /> Add expense
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className={cn(inputClass, "pl-9")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses, notes, people" />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {event.expenses.length} · <span className="money font-medium text-foreground">{fmt(total, event.currency)}</span>
        </p>
      </div>

      {used.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {used.map((name) => (
            <Chip key={name} active={category === name} onClick={() => setCategory(category === name ? null : name)}>
              {findCategory(settings.categories, name).emoji} {name}
            </Chip>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No expenses match that.</p>
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="surface rounded-2xl p-2">
            <header className="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
              <span>{formatDateLong(date, settings.locale)}</span>
              <span className="money">{fmt(items.reduce((s, e) => s + e.amount, 0), event.currency)}</span>
            </header>
            {items.map((e) => (
              <ExpenseRow key={e.id} expense={e} event={event} math={math} onOpen={onOpenExpense} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-brand/60 bg-brand/12 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
