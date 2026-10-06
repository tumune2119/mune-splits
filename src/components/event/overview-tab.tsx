"use client";

import { useState } from "react";
import { ArrowRight, Plus, Receipt } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { Money } from "@/components/money";
import { useApp } from "@/components/app-provider";
import { ExpenseRow } from "@/components/event/expense-row";
import { categoryColor, findCategory } from "@/lib/constants";
import type { EventMath } from "@/lib/event-math";
import { cn } from "@/lib/utils";
import type { EventDetail, Expense } from "@/lib/types";
import type { Tab } from "@/components/event/event-page";

export function OverviewTab({
  event,
  math,
  onOpenExpense,
  onGoTo,
  onAdd,
  readOnly,
}: {
  event: EventDetail;
  math: EventMath;
  onOpenExpense: (e: Expense) => void;
  onGoTo: (t: Tab) => void;
  onAdd: () => void;
  readOnly: boolean;
}) {
  const { fmt } = useApp();
  const cur = event.currency;
  const me = event.participants.find((p) => p.isMe);
  const mine = me ? math.balanceOf(me.id) : null;
  const days = math.byDay.length;

  if (event.expenses.length === 0) {
    return (
      <div className="surface-hero rounded-3xl px-6 py-16 text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-brand/15 text-brand">
          <Receipt className="size-7" />
        </span>
        <h2 className="text-xl font-semibold">No expenses yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Add the first one — the villa, the cab from the airport, that dinner nobody wants to talk about.
        </p>
        {!readOnly && (
          <Button className="mt-6 h-11 rounded-xl px-5" onClick={onAdd}>
            <Plus /> Add expense
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="surface-hero relative overflow-hidden rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">Total spent</p>
          <Money value={math.total} currency={cur} countUp className="mt-1 block text-[2.6rem] leading-tight font-semibold tracking-tight" />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="money text-foreground">{event.expenses.length}</span> expenses
            </span>
            <span>
              <span className="money text-foreground">{fmt(Math.round(math.total / Math.max(1, event.participants.length)), cur)}</span> per person avg
            </span>
            {days > 1 && (
              <span>
                <span className="money text-foreground">{fmt(Math.round(math.total / days), cur)}</span> per day
              </span>
            )}
          </div>
        </div>

        <div className="surface rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">Your balance</p>
          {mine ? (
            <>
              <Money value={mine.net} currency={cur} sign tone countUp className="mt-1 block text-[2.6rem] leading-tight font-semibold tracking-tight" />
              <p className={cn("text-sm font-medium", mine.net > 0 ? "text-owed" : mine.net < 0 ? "text-owe" : "text-even")}>
                {mine.net > 0 ? "You are owed" : mine.net < 0 ? "You owe" : "You're all square"}
              </p>
              <div className="mt-3 flex gap-6 text-sm text-muted-foreground">
                <span>
                  Paid <span className="money text-foreground">{fmt(mine.paid, cur)}</span>
                </span>
                <span>
                  Share <span className="money text-foreground">{fmt(mine.share, cur)}</span>
                </span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">You&apos;re not part of this event.</p>
          )}
          {math.transfers.length > 0 && (
            <button onClick={() => onGoTo("settle")} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              {math.transfers.length} payment{math.transfers.length === 1 ? "" : "s"} to settle up <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut event={event} math={math} />
        <PersonBars event={event} math={math} />
      </section>

      <section className="surface rounded-2xl p-3">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <h2 className="font-semibold">Recent expenses</h2>
          <button onClick={() => onGoTo("expenses")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            See all <ArrowRight className="size-3.5" />
          </button>
        </div>
        {[...event.expenses]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5)
          .map((e) => (
            <ExpenseRow key={e.id} expense={e} event={event} math={math} onOpen={onOpenExpense} showDate />
          ))}
      </section>
    </div>
  );
}

function ChartTooltip({ active, payload, render }: { active?: boolean; payload?: { payload: unknown }[]; render: (p: never) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-xl">{render(payload[0].payload as never)}</div>;
}

function CategoryDonut({ event, math }: { event: EventDetail; math: EventMath }) {
  const { settings, fmt, theme } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const data = math.byCategory.map((c) => ({
    ...c,
    color: categoryColor(settings.categories, c.name, theme),
    emoji: findCategory(settings.categories, c.name).emoji,
    pct: math.total ? (c.amount / math.total) * 100 : 0,
  }));
  const focus = data.find((d) => d.name === hover);

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="font-semibold">Spend by category</h2>
      <div className="mt-3 grid items-center gap-4 sm:grid-cols-[200px_1fr]">
        <div className="relative mx-auto size-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="name"
                innerRadius={66}
                outerRadius={94}
                paddingAngle={data.length > 1 ? 1.5 : 0}
                cornerRadius={4}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
                onMouseEnter={(d: { name?: string }) => setHover(d.name ?? null)}
                onMouseLeave={() => setHover(null)}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} opacity={hover && hover !== d.name ? 0.35 : 1} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <ChartTooltip
                    render={(d: (typeof data)[number]) => (
                      <>
                        <p className="font-medium">
                          {d.emoji} {d.name}
                        </p>
                        <p className="money text-muted-foreground">
                          {fmt(d.amount, event.currency)} · {d.pct.toFixed(1)}% · {d.count} expense{d.count === 1 ? "" : "s"}
                        </p>
                      </>
                    )}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-xs text-muted-foreground">{focus ? focus.name : "Total"}</p>
              <p className="money text-lg font-semibold">{fmt(focus ? focus.amount : math.total, event.currency, { compact: (focus ? focus.amount : math.total) >= 10_000_000 })}</p>
            </div>
          </div>
        </div>
        <ul className="space-y-1">
          {data.map((d) => (
            <li
              key={d.name}
              onMouseEnter={() => setHover(d.name)}
              onMouseLeave={() => setHover(null)}
              className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-opacity", hover && hover !== d.name && "opacity-50")}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 truncate">
                {d.emoji} {d.name}
              </span>
              <span className="money text-muted-foreground">{d.pct.toFixed(0)}%</span>
              <span className="money w-24 text-right font-medium">{fmt(d.amount, event.currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Paid vs share per person, as paired horizontal bars on one shared scale. */
function PersonBars({ event, math }: { event: EventDetail; math: EventMath }) {
  const { fmt } = useApp();
  const max = Math.max(1, ...math.balances.flatMap((b) => [b.paid, b.share]));
  const rows = event.participants.map((p) => ({ person: p, b: math.balanceOf(p.id) }));

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Spend by person</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-brand" /> Paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-even/70" /> Share
          </span>
        </div>
      </div>
      <ul className="mt-4 space-y-4">
        {rows.map(({ person, b }) => (
          <li key={person.id} className="flex items-center gap-3">
            <Avatar person={person} size={28} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate">{person.name}</span>
                <span className="money text-xs text-muted-foreground">
                  paid <span className="text-foreground">{fmt(b.paid, event.currency)}</span> · share{" "}
                  <span className="text-foreground">{fmt(b.share, event.currency)}</span>
                </span>
              </div>
              <Bar value={b.paid} max={max} className="bg-brand" label={`${person.name} paid ${fmt(b.paid, event.currency)}`} />
              <Bar value={b.share} max={max} className="bg-even/70" label={`${person.name}'s share ${fmt(b.share, event.currency)}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
  return (
    <div className="group/bar py-0.5" title={label}>
      <div
        className={cn("h-2 rounded-r-[4px] transition-[width] duration-700 ease-out group-hover/bar:brightness-110", className)}
        style={{ width: `${value ? Math.max(1.5, (value / max) * 100) : 0}%` }}
      />
    </div>
  );
}
