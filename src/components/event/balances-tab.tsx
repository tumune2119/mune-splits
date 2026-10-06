"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Segmented } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import type { EventMath } from "@/lib/event-math";
import type { Transfer } from "@/lib/splits";
import { cn } from "@/lib/utils";
import type { EventDetail } from "@/lib/types";

export function BalancesTab({ event, math }: { event: EventDetail; math: EventMath }) {
  const { fmt } = useApp();
  const [view, setView] = useState<"simplified" | "raw">("simplified");
  const cur = event.currency;
  const maxAbs = Math.max(1, ...math.balances.map((b) => Math.abs(b.net)));
  const transfers = view === "simplified" ? math.transfers : math.rawTransfers;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <section className="surface rounded-2xl p-5">
        <h2 className="font-semibold">Balances</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Paid − share, adjusted for payments already made.</p>
        <ul className="mt-5 space-y-5">
          {event.participants.map((p) => {
            const b = math.balanceOf(p.id);
            const width = (Math.abs(b.net) / maxAbs) * 50;
            return (
              <li key={p.id}>
                <div className="flex items-center gap-3">
                  <Avatar person={p} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="money truncate text-xs text-muted-foreground">
                      paid {fmt(b.paid, cur)} · share {fmt(b.share, cur)}
                      {b.sent > 0 && ` · sent ${fmt(b.sent, cur)}`}
                      {b.received > 0 && ` · received ${fmt(b.received, cur)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("money text-lg font-semibold", b.net > 0 ? "text-owed" : b.net < 0 ? "text-owe" : "text-even")}>
                      {fmt(b.net, cur, { sign: true })}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">{b.net > 0 ? "gets back" : b.net < 0 ? "owes" : "settled"}</p>
                  </div>
                </div>
                {/* Diverging bar: owes to the left of centre, owed to the right. */}
                <div className="relative mt-2.5 h-1.5 rounded-full bg-muted" title={`${p.name}: ${fmt(b.net, cur, { sign: true })}`}>
                  <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-border" />
                  <span
                    className={cn("absolute top-0 h-1.5 transition-all duration-700", b.net > 0 ? "rounded-r-full bg-owed" : "rounded-l-full bg-owe")}
                    style={b.net >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Who owes whom</h2>
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "simplified", label: "Simplified" },
              { value: "raw", label: "Raw" },
            ]}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {view === "simplified"
            ? `The fewest payments that settle everyone: ${math.transfers.length}${math.rawTransfers.length > math.transfers.length ? ` instead of ${math.rawTransfers.length}` : ""}.`
            : "Direct debts from each expense, netted per pair."}
        </p>
        <TransferList transfers={transfers} event={event} math={math} />
      </section>
    </div>
  );
}

export function TransferList({ transfers, event, math }: { transfers: Transfer[]; event: EventDetail; math: EventMath }) {
  const { fmt } = useApp();
  if (transfers.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center py-8 text-center">
        <CheckCircle2 className="size-9 text-owed" />
        <p className="mt-2 font-medium">Everyone is square</p>
        <p className="text-sm text-muted-foreground">No payments needed.</p>
      </div>
    );
  }
  return (
    <ul className="mt-4 space-y-2">
      {transfers.map((t) => {
        const from = math.people.get(t.fromId)!;
        const to = math.people.get(t.toId)!;
        return (
          <li key={`${t.fromId}-${t.toId}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2.5">
            <Avatar person={from} size={28} />
            <span className="min-w-0 truncate text-sm font-medium">{from.name}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <Avatar person={to} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{to.name}</span>
            <span className="money font-semibold text-brand">{fmt(t.amount, event.currency)}</span>
          </li>
        );
      })}
    </ul>
  );
}
