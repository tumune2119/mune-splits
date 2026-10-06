"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/confirm-button";
import { AvatarStack } from "@/components/avatar";
import { Kbd } from "@/components/kbd";
import { useApp } from "@/components/app-provider";
import { NEW_EVENT } from "@/components/app-shell";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { ExpenseDialog } from "@/components/event/expense-dialog";
import { PeopleDialog } from "@/components/event/people-dialog";
import { OverviewTab } from "@/components/event/overview-tab";
import { ExpensesTab } from "@/components/event/expenses-tab";
import { BalancesTab } from "@/components/event/balances-tab";
import { SettleTab } from "@/components/event/settle-tab";
import { deleteEventRequest, download, patchEvent } from "@/lib/client/api";
import { eventMath } from "@/lib/event-math";
import { formatRange, formatTimestamp } from "@/lib/format";
import { summaryText } from "@/lib/summary-text";
import { cn } from "@/lib/utils";
import type { EventAction, ExpenseFields } from "@/lib/event-actions";
import type { EventDetail, Expense, Person } from "@/lib/types";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "expenses", label: "Expenses" },
  { value: "balances", label: "Balances" },
  { value: "settle", label: "Settle up" },
] as const;
export type Tab = (typeof TABS)[number]["value"];

export function EventPage({ initial, people }: { initial: EventDetail; people: Person[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, fmt } = useApp();
  const [event, setEvent] = useState(initial);
  const math = useMemo(() => eventMath(event), [event]);
  const [tab, setTabState] = useState<Tab>(() => (TABS.some((t) => t.value === params.get("tab")) ? (params.get("tab") as Tab) : "overview"));
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editEvent, setEditEvent] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const readOnly = event.status === "settled";

  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  const run = useCallback(
    async (action: EventAction, success?: string) => {
      try {
        const next = await patchEvent(event.id, action);
        setEvent(next);
        if (success) toast.success(success);
        return next;
      } catch (err) {
        toast.error((err as Error).message);
        throw err;
      }
    },
    [event.id],
  );

  const addExpense = useCallback(() => {
    if (readOnly) return toast.info("This event is settled. Reopen it to add expenses.");
    setEditing(null);
    setExpenseOpen(true);
  }, [readOnly]);

  useEffect(() => {
    window.addEventListener(NEW_EVENT, addExpense);
    return () => window.removeEventListener(NEW_EVENT, addExpense);
  }, [addExpense]);

  const openExpense = (e: Expense) => {
    if (readOnly) return toast.info("This event is settled. Reopen it to edit expenses.");
    setEditing(e);
    setExpenseOpen(true);
  };

  const saveExpense = async (fields: ExpenseFields) => {
    if (editing) await run({ type: "update-expense", id: editing.id, expense: fields }, "Expense updated");
    else await run({ type: "add-expense", expense: fields }, "Expense added");
  };

  const deleteExpense = async (e: Expense) => {
    await run({ type: "delete-expense", id: e.id });
    setExpenseOpen(false);
    toast.success(`Deleted “${e.title}”`, {
      action: {
        label: "Undo",
        onClick: () =>
          run({
            type: "restore-expense",
            expense: {
              id: e.id,
              createdAt: e.createdAt,
              title: e.title,
              amount: e.amount,
              date: e.date,
              category: e.category,
              payers: e.payers,
              mode: e.mode,
              split: e.split,
              notes: e.notes,
              receipt: e.receipt,
            },
          }).catch(() => {}),
      },
    });
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { exportEventPdf } = await import("@/lib/pdf");
      await exportEventPdf(event, settings);
    } catch (err) {
      console.error(err);
      toast.error(`Couldn't create the PDF: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(event, math, (v) => fmt(v, event.currency), settings.locale));
      toast.success("Summary copied. Paste it into WhatsApp.");
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const accent = event.color || "#FFB38A";
  const range = formatRange(event.startDate, event.endDate, settings.locale);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-8 sm:pt-8">
      <Link href="/" className="no-print mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Events
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}44` }}>
          {event.emoji || "🧾"}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{event.name}</h1>
            {event.status === "settled" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-owed/12 px-2.5 py-0.5 text-xs font-medium text-owed">
                <CheckCircle2 className="size-3.5" /> Settled
              </span>
            )}
            {event.status === "archived" && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Archived</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[range, event.currency, `${event.participants.length} people`].filter(Boolean).join(" · ")}
          </p>
          {event.description && <p className="mt-1.5 max-w-2xl text-sm text-foreground/80">{event.description}</p>}
        </div>

        <div className="no-print flex items-center gap-2 max-sm:w-full max-sm:justify-end">
          <button
            onClick={() => setPeopleOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 transition-colors hover:bg-accent"
            aria-label="Manage people"
          >
            <AvatarStack people={event.participants} max={5} size={26} />
            <UserPlus className="size-4 text-muted-foreground" />
          </button>
          <Button variant="outline" className="h-10 rounded-xl" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-lg" className="size-10 rounded-xl" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem disabled={readOnly} onSelect={() => setEditEvent(true)}>
                <Pencil /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copySummary}>
                <ClipboardCopy /> Copy summary
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open(`/events/${event.id}/print`, "_blank")}>
                <Printer /> Print view
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(`/api/events/${event.id}/csv`)}>
                <FileSpreadsheet /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {event.status === "settled" ? (
                <DropdownMenuItem onSelect={() => run({ type: "set-status", status: "active" }, "Event reopened")}>
                  <RotateCcw /> Reopen event
                </DropdownMenuItem>
              ) : event.status === "archived" ? (
                <DropdownMenuItem onSelect={() => run({ type: "set-status", status: "active" }, "Moved back to active")}>
                  <ArchiveRestore /> Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => run({ type: "set-status", status: "archived" }, "Event archived")}>
                  <Archive /> Archive
                </DropdownMenuItem>
              )}
              <ConfirmButton
                title={`Delete “${event.name}”?`}
                description="All its expenses and payments are deleted for good. Export a PDF or backup first if you want to keep a record."
                confirmLabel="Delete event"
                destructive
                onConfirm={async () => {
                  await deleteEventRequest(event.id);
                  toast.success("Event deleted");
                  router.push("/");
                  router.refresh();
                }}
              >
                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 /> Delete event
                </DropdownMenuItem>
              </ConfirmButton>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {readOnly && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-owed/30 bg-owed/8 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-owed" />
            Settled{event.settledAt ? ` on ${formatTimestamp(event.settledAt, settings.locale)}` : ""}. This event is read-only.
          </span>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => run({ type: "set-status", status: "active" }, "Event reopened")}>
            <RotateCcw /> Reopen
          </Button>
        </div>
      )}

      <nav className="no-print sticky top-0 z-20 -mx-4 mt-6 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "relative px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.value === "settle" && math.transfers.length > 0 && (
                <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.68rem] font-semibold text-brand tabular-nums">{math.transfers.length}</span>
              )}
              {tab === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      </nav>

      <div key={tab} className="rise mt-6">
        {tab === "overview" && <OverviewTab event={event} math={math} onOpenExpense={openExpense} onGoTo={setTab} onAdd={addExpense} readOnly={readOnly} />}
        {tab === "expenses" && <ExpensesTab event={event} math={math} onOpenExpense={openExpense} onAdd={addExpense} readOnly={readOnly} />}
        {tab === "balances" && <BalancesTab event={event} math={math} />}
        {tab === "settle" && <SettleTab event={event} math={math} run={run} readOnly={readOnly} />}
      </div>

      {!readOnly && (
        <button
          onClick={addExpense}
          className="no-print group fixed right-5 bottom-24 z-30 flex items-center gap-2 rounded-2xl bg-primary p-4 sm:py-3.5 sm:pr-5 sm:pl-4 font-semibold text-primary-foreground shadow-[0_12px_32px_-8px_rgb(255_148_85/0.7)] transition-all hover:-translate-y-0.5 hover:bg-brand-deep md:right-8 md:bottom-8"
        >
          <Plus className="size-5" strokeWidth={2.5} />
          <span className="max-sm:sr-only">Add expense</span>
          <Kbd className="ml-1 hidden border-black/15 bg-black/10 text-primary-foreground md:inline-flex">N</Kbd>
        </button>
      )}

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        event={event}
        expense={editing}
        onSubmit={saveExpense}
        onDelete={editing && !readOnly ? () => deleteExpense(editing) : undefined}
      />
      <EventFormDialog open={editEvent} onOpenChange={setEditEvent} people={people} event={event} onSaved={setEvent} />
      <PeopleDialog open={peopleOpen} onOpenChange={setPeopleOpen} event={event} people={people} run={run} readOnly={readOnly} />
    </div>
  );
}
