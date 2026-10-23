"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  FileSpreadsheet,
  Globe,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/action-menu";
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
import { useSwipeTabs } from "@/components/event/use-swipe-tabs";
import { deleteEventRequest, patchEvent } from "@/lib/client/api";
import { saveText, shareText } from "@/lib/client/platform";
import { fileSafe } from "@/lib/format";
import { eventMath } from "@/lib/event-math";
import { formatRange, formatTimestamp } from "@/lib/format";
import { summaryText } from "@/lib/summary-text";
import { eventToCsv } from "@/lib/csv";
import { sharingEnabled } from "@/lib/shared/config";
import { removeMembership, upsertMembership } from "@/lib/shared/memberships";
import { ShareDialog } from "@/components/shared/share-dialog";
import { EventDataProvider, type EventData } from "@/components/event/event-data";
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

export function EventPage({ initial, people, openInvite = false }: { initial: EventDetail; people: Person[]; openInvite?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, fmt, info } = useApp();
  const shared = initial.shared ?? null;
  // A shared event follows the live copy its screen keeps up to date; a local one is held here.
  const [localEvent, setLocalEvent] = useState(initial);
  const event = shared ? initial : localEvent;
  const setEvent = useCallback((e: EventDetail) => setLocalEvent(e), []);
  const math = useMemo(() => eventMath(event), [event]);
  const [shareOpen, setShareOpen] = useState(openInvite);
  const eventData = useMemo<EventData | null>(
    () =>
      shared
        ? {
            uploadReceipt: async (file) => (await import("@/lib/shared/client")).uploadSharedReceipt(shared.sid, file),
            receiptUrl: async (name) => (await import("@/lib/shared/client")).sharedReceiptUrl(shared.sid, name),
          }
        : null,
    [shared],
  );
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
  // Swipe left / right between tabs on phones; the new tab slides in from that side.
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);
  const swipeArea = useRef<HTMLDivElement>(null);
  const swipeContent = useRef<HTMLDivElement>(null);
  useSwipeTabs(swipeArea, swipeContent, TABS.map((t) => t.value), tab, (t, from) => {
    setSlideFrom(from);
    setTab(t);
  });
  const pickTab = (t: Tab) => {
    setSlideFrom(null);
    setTab(t);
  };

  const run = useCallback(
    async (action: EventAction, success?: string) => {
      try {
        const next = event.shared
          ? await (await import("@/lib/shared/client")).applySharedAction(event, action)
          : await patchEvent(event.id, action);
        setEvent(next);
        if (success) toast.success(success);
        return next;
      } catch (err) {
        toast.error(friendlyError(err));
        throw err;
      }
    },
    [event, setEvent],
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
      const how = await shareText(summaryText(event, math, (v) => fmt(v, event.currency), settings.locale));
      if (how === "copied") toast.success("Summary copied. Paste it into WhatsApp.");
    } catch {
      toast.error("Couldn't share the summary.");
    }
  };

  const exportCsv = async () => {
    try {
      const csv = eventToCsv(event).replace(/^﻿/, "");
      // The BOM makes Excel read the file as UTF-8 (₹, names with accents).
      await saveText(String.fromCharCode(0xfeff) + csv, `MUNE-Splits_${fileSafe(event.name)}_${new Date().toLocaleDateString("sv-SE")}.csv`, "text/csv");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const accent = event.color || "#FFB38A";
  const range = formatRange(event.startDate, event.endDate, settings.locale);
  const me = shared ? event.participants.find((p) => p.isMe) : undefined;

  const page = (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-8 sm:pt-8">
      <Link href="/" className="no-print mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pointer-coarse:-mx-2 pointer-coarse:mb-3 pointer-coarse:min-h-12 pointer-coarse:px-2 pointer-coarse:text-base">
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
            {shared && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-2.5 py-0.5 text-xs font-medium text-brand">
                <Globe className="size-3.5" /> Shared · live
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[range, event.currency, `${event.participants.length} people`].filter(Boolean).join(" · ")}
            {me && (
              <>
                {" · "}you&apos;re <span className="font-medium text-foreground">{me.name}</span>{" "}
                <button className="text-brand hover:underline" onClick={() => shared && upsertMembership({ sid: shared.sid, me: null, name: event.name })}>
                  (change)
                </button>
              </>
            )}
          </p>
          {event.description && <p className="mt-1.5 max-w-2xl text-sm text-foreground/80">{event.description}</p>}
        </div>

        <div className="no-print flex items-center gap-2 max-sm:w-full max-sm:justify-end">
          <button
            onClick={() => setPeopleOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 transition-colors hover:bg-accent pointer-coarse:min-h-12 pointer-coarse:px-3"
            aria-label="Manage people"
          >
            <AvatarStack people={event.participants} max={5} size={26} />
            <UserPlus className="size-4 text-muted-foreground" />
          </button>
          {(shared || sharingEnabled()) && (
            <Button className="h-10 rounded-xl" onClick={() => setShareOpen(true)} aria-label={shared ? "Invite" : "Share"}>
              <Share2 />
              <span className="hidden sm:inline">{shared ? "Invite" : "Share"}</span>
            </Button>
          )}
          <Button variant="outline" className="h-10 rounded-xl" onClick={exportPdf} disabled={exporting} aria-label="Export PDF">
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
          <ActionMenu
            title={event.name}
            trigger={
              <Button variant="outline" size="icon-lg" className="size-10 rounded-xl" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            }
            actions={[
              { key: "edit", label: "Edit details", icon: <Pencil />, disabled: readOnly, onSelect: () => setEditEvent(true) },
              { key: "summary", label: info.platform === "desktop" ? "Copy summary" : "Share summary", icon: <ClipboardCopy />, onSelect: copySummary },
              ...(!info.native && !shared
                ? [
                    {
                      key: "print",
                      label: "Print view",
                      icon: <Printer />,
                      onSelect: () => window.open(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/event/print?id=${encodeURIComponent(event.id)}`, "_blank"),
                    },
                  ]
                : []),
              { key: "csv", label: "Export CSV", icon: <FileSpreadsheet />, onSelect: exportCsv },
              event.status === "settled"
                ? { key: "status", group: true, label: "Reopen event", icon: <RotateCcw />, onSelect: () => void run({ type: "set-status", status: "active" }, "Event reopened") }
                : event.status === "archived"
                  ? { key: "status", group: true, label: "Unarchive", icon: <ArchiveRestore />, onSelect: () => void run({ type: "set-status", status: "active" }, "Moved back to active") }
                  : { key: "status", group: true, label: "Archive", icon: <Archive />, onSelect: () => void run({ type: "set-status", status: "archived" }, "Event archived") },
              ...(shared
                ? [
                    {
                      key: "leave",
                      label: "Leave event",
                      icon: <LogOut />,
                      confirm: {
                        title: `Leave “${event.name}”?`,
                        description: "It disappears from this device only. Everyone else keeps it, and you can rejoin with the link.",
                        confirmLabel: "Leave",
                        onConfirm: () => {
                          removeMembership(shared.sid);
                          toast.success("You left the event");
                          router.push("/");
                        },
                      },
                    },
                  ]
                : []),
              {
                key: "delete",
                label: shared ? "Delete for everyone" : "Delete event",
                icon: <Trash2 />,
                destructive: true,
                confirm: {
                  title: shared ? `Delete “${event.name}” for everyone?` : `Delete “${event.name}”?`,
                  description: shared
                    ? "Everyone in the group loses it, with all its expenses and payments. Export a PDF first if anyone wants a record."
                    : "All its expenses and payments are deleted for good. Export a PDF or backup first if you want to keep a record.",
                  confirmLabel: shared ? "Delete for everyone" : "Delete event",
                  destructive: true,
                  onConfirm: async () => {
                    try {
                      if (shared) {
                        await (await import("@/lib/shared/client")).deleteSharedEvent(shared.sid);
                        removeMembership(shared.sid);
                      } else {
                        await deleteEventRequest(event.id);
                      }
                      toast.success("Event deleted");
                      router.push("/");
                    } catch (err) {
                      toast.error(friendlyError(err));
                    }
                  },
                },
              },
            ]}
          />
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

      <div ref={swipeArea} className="touch-pan-y touch-pinch-zoom">
        <nav className="no-print sticky top-[env(safe-area-inset-top)] z-20 -mx-4 mt-6 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
          <div className="flex overflow-x-auto sm:gap-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => pickTab(t.value)}
                className={cn(
                  "relative px-1.5 py-3 text-sm font-medium whitespace-nowrap transition-colors max-sm:flex-auto sm:px-3.5 pointer-coarse:min-h-12 sm:pointer-coarse:px-4 sm:pointer-coarse:text-[15px]",
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

        <div ref={swipeContent} className="mt-6">
          <div key={tab} className={slideFrom === "right" ? "slide-from-right" : slideFrom === "left" ? "slide-from-left" : "rise"}>
            {tab === "overview" && <OverviewTab event={event} math={math} onOpenExpense={openExpense} onGoTo={pickTab} onAdd={addExpense} readOnly={readOnly} />}
            {tab === "expenses" && <ExpensesTab event={event} math={math} onOpenExpense={openExpense} onAdd={addExpense} readOnly={readOnly} />}
            {tab === "balances" && <BalancesTab event={event} math={math} />}
            {tab === "settle" && <SettleTab event={event} math={math} run={run} readOnly={readOnly} />}
          </div>
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={addExpense}
          className="no-print group fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-2 rounded-2xl bg-primary max-sm:size-14 sm:py-3.5 sm:pr-5 sm:pl-4 font-semibold text-primary-foreground shadow-[0_12px_32px_-8px_rgb(255_148_85/0.7)] transition-all hover:-translate-y-0.5 hover:bg-brand-deep md:right-8 md:bottom-8"
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
      <EventFormDialog
        open={editEvent}
        onOpenChange={setEditEvent}
        people={people}
        event={event}
        onSaved={setEvent}
        saveUpdate={shared ? (fields) => run({ type: "update", fields }) : undefined}
      />
      <PeopleDialog open={peopleOpen} onOpenChange={setPeopleOpen} event={event} people={people} run={run} readOnly={readOnly} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} event={event} />
    </div>
  );
  return eventData ? <EventDataProvider value={eventData}>{page}</EventDataProvider> : page;
}

/** Validation errors from shared edits arrive as zod errors; show their message like the server would. */
function friendlyError(err: unknown): string {
  const issues = (err as { issues?: { message?: string }[] })?.issues;
  return issues?.[0]?.message ?? (err as Error)?.message ?? "Something went wrong";
}
