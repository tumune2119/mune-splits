"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Globe, Link as LinkIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/kbd";
import { AvatarStack } from "@/components/avatar";
import { Money } from "@/components/money";
import { Segmented } from "@/components/fields";
import { LogoMark } from "@/components/logo";
import { useApp } from "@/components/app-provider";
import { NEW_EVENT } from "@/components/app-shell";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { JoinDialog } from "@/components/shared/join-dialog";
import { sharingEnabled } from "@/lib/shared/config";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventStatus, EventSummary, Person } from "@/lib/types";

type Filter = EventStatus | "all";

export function EventsHome({ events, people }: { events: EventSummary[]; people: Person[] }) {
  const { settings } = useApp();
  const [filter, setFilter] = useState<Filter>("active");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const open = () => setCreating(true);
    window.addEventListener(NEW_EVENT, open);
    return () => window.removeEventListener(NEW_EVENT, open);
  }, []);

  const counts = useMemo(() => {
    const c = { active: 0, settled: 0, archived: 0, all: events.length };
    for (const e of events) c[e.status]++;
    return c;
  }, [events]);
  const visible = filter === "all" ? events : events.filter((e) => e.status === filter);

  // Totals across active events in the default currency (others can't be added together).
  const totals = useMemo(() => {
    const cur = settings.defaultCurrency;
    const active = events.filter((e) => e.status === "active");
    const same = active.filter((e) => e.currency === cur);
    return {
      currency: cur,
      owed: same.reduce((s, e) => s + Math.max(0, e.myNet ?? 0), 0),
      owe: same.reduce((s, e) => s + Math.min(0, e.myNet ?? 0), 0),
      spent: same.reduce((s, e) => s + e.total, 0),
      otherCurrencies: active.length - same.length,
    };
  }, [events, settings.defaultCurrency]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Trips, dinners and everything in between.</p>
        </div>
        <div className="flex gap-2">
          {sharingEnabled() && (
            <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => setJoining(true)}>
              <LinkIcon /> Join with a link
            </Button>
          )}
          <Button className="h-10 rounded-xl px-4" onClick={() => setCreating(true)}>
            <Plus /> New event <Kbd className="ml-1 border-black/15 bg-black/10 text-primary-foreground">N</Kbd>
          </Button>
        </div>
      </header>
      <JoinDialog open={joining} onOpenChange={setJoining} />

      {events.length === 0 ? (
        <EmptyHome onCreate={() => setCreating(true)} />
      ) : (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="You're owed" hint="across active events">
              <Money value={totals.owed} currency={totals.currency} countUp className={cn("text-3xl font-semibold", totals.owed > 0 ? "text-owed" : "text-even")} />
            </SummaryTile>
            <SummaryTile label="You owe" hint="across active events">
              <Money value={Math.abs(totals.owe)} currency={totals.currency} countUp className={cn("text-3xl font-semibold", totals.owe < 0 ? "text-owe" : "text-even")} />
            </SummaryTile>
            <SummaryTile
              label="Spent together"
              hint={totals.otherCurrencies ? `${totals.otherCurrencies} event${totals.otherCurrencies > 1 ? "s" : ""} in other currencies not included` : "active events, everyone's share"}
            >
              <Money value={totals.spent} currency={totals.currency} countUp className="text-3xl font-semibold" />
            </SummaryTile>
          </section>

          <div className="mb-5 flex items-center justify-between gap-3 overflow-x-auto">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active", count: counts.active },
                { value: "settled", label: "Settled", count: counts.settled },
                { value: "archived", label: "Archived", count: counts.archived },
                { value: "all", label: "All", count: counts.all },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-medium">{filter === "settled" ? "Nothing settled yet" : filter === "archived" ? "No archived events" : "No active events"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === "settled"
                  ? "Once everyone's square, mark an event settled and it lands here."
                  : filter === "archived"
                    ? "Archive old events to tidy up without deleting them."
                    : "Start a new one when the next plan comes together."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((e, i) => (
                <EventCard key={e.id} event={e} index={i} />
              ))}
            </div>
          )}
        </>
      )}

      <EventFormDialog open={creating} onOpenChange={setCreating} people={people} />
    </div>
  );
}

function SummaryTile({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
      <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
    </div>
  );
}

function EventCard({ event: e, index }: { event: EventSummary; index: number }) {
  const { settings } = useApp();
  const accent = e.color || "#FFB38A";
  return (
    <Link
      href={e.shared ? `/event?s=${encodeURIComponent(e.id)}` : `/event?id=${encodeURIComponent(e.id)}`}
      className="surface lift rise group relative block overflow-hidden rounded-2xl p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: accent }} />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl text-[1.35rem]" style={{ background: `${accent}1f` }}>
          {e.emoji || "🧾"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{e.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {formatRange(e.startDate, e.endDate, settings.locale) || `${e.expenseCount} expense${e.expenseCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {e.status === "settled" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-even/15 px-2 py-0.5 text-[0.7rem] font-medium text-even">
            <CheckCircle2 className="size-3" /> Settled
          </span>
        )}
        {e.status === "archived" && <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">Archived</span>}
        {e.shared && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-2 py-0.5 text-[0.7rem] font-medium text-brand" title="Shared with the group">
            <Globe className="size-3" /> Shared
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total spent</p>
          <Money value={e.total} currency={e.currency} className="text-2xl font-semibold" />
        </div>
        <AvatarStack people={e.participants} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">{e.expenseCount} expense{e.expenseCount === 1 ? "" : "s"}</span>
        <BalancePill net={e.myNet} currency={e.currency} />
      </div>
    </Link>
  );
}

export function BalancePill({ net, currency }: { net: number | null; currency: string }) {
  const { fmt } = useApp();
  if (net === null) return <span className="text-xs text-muted-foreground">You&apos;re not in this one</span>;
  if (net === 0) return <span className="text-xs font-medium text-even">All square</span>;
  return (
    <span className={cn("money text-xs font-semibold", net > 0 ? "text-owed" : "text-owe")}>
      {net > 0 ? "You're owed " : "You owe "}
      {fmt(Math.abs(net), currency)}
    </span>
  );
}

function EmptyHome({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="surface-hero rise relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20">
      <LogoMark className="mx-auto mb-6 size-16 drop-shadow-[0_0_24px_rgb(255_148_85/0.45)]" />
      <h2 className="text-2xl font-semibold tracking-tight">Split your first trip</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Create an event, add your friends, and log who paid for what. MUNE Splits works out the fewest payments to settle everyone up.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button className="h-11 rounded-xl px-5" onClick={onCreate}>
          <Plus /> Create an event
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Everything stays on this computer. No accounts, no cloud.</p>
    </div>
  );
}
