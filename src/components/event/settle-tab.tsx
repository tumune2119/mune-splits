"use client";

import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, HandCoins, Loader2, PartyPopper, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import { Field, NativeSelect, inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { currencySymbol, minorToInput, parseAmount } from "@/lib/money";
import { today } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EventMath } from "@/lib/event-math";
import type { Transfer } from "@/lib/splits";
import { cn } from "@/lib/utils";
import type { EventAction } from "@/lib/event-actions";
import type { EventDetail } from "@/lib/types";

type Run = (a: EventAction, success?: string) => Promise<EventDetail>;

export function SettleTab({ event, math, run, readOnly }: { event: EventDetail; math: EventMath; run: Run; readOnly: boolean }) {
  const { fmt, settings } = useApp();
  const [payment, setPayment] = useState<Partial<Transfer> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cur = event.currency;
  const name = (id: string) => math.people.get(id)?.name ?? "?";

  const markPaid = async (t: Transfer, amount = t.amount, date?: string, note = "") => {
    const key = `${t.fromId}-${t.toId}`;
    setBusy(key);
    try {
      const next = await run({ type: "add-settlement", fromId: t.fromId, toId: t.toId, amount, date, note });
      const created = next.settlements[0];
      toast.success(`${name(t.fromId)} paid ${name(t.toId)} ${fmt(amount, cur)}`, {
        action: created ? { label: "Undo", onClick: () => run({ type: "delete-settlement", id: created.id }).catch(() => {}) } : undefined,
      });
    } catch {
      // run() already showed the error
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        {math.settled && event.expenses.length > 0 && event.status !== "settled" && (
          <div className="surface-hero rounded-2xl p-6 text-center">
            <PartyPopper className="mx-auto size-9 text-brand" />
            <h2 className="mt-3 text-lg font-semibold">Everyone is square</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mark the event as settled to lock it. You can reopen it any time.</p>
            <Button className="mt-5 h-10 rounded-xl px-5" onClick={() => run({ type: "set-status", status: "settled" }, "Event marked as settled 🎉").catch(() => {})}>
              <CheckCircle2 /> Mark event as settled
            </Button>
          </div>
        )}

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Suggested payments</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {math.transfers.length
                  ? `${math.transfers.length} payment${math.transfers.length === 1 ? "" : "s"} · ${fmt(math.outstanding, cur)} outstanding`
                  : "Nothing outstanding."}
              </p>
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setPayment({})}>
                <Plus /> Record a payment
              </Button>
            )}
          </div>

          {math.transfers.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="size-10 text-owed" />
              <p className="mt-2 font-medium">All settled up</p>
              <p className="text-sm text-muted-foreground">{event.expenses.length ? "No one owes anything." : "Add expenses to see who owes whom."}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {math.transfers.map((t) => {
                const from = math.people.get(t.fromId)!;
                const to = math.people.get(t.toId)!;
                const key = `${t.fromId}-${t.toId}`;
                return (
                  <li key={key} className="rise rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        <Avatar person={from} size={36} ring />
                        <Avatar person={to} size={36} ring className="-ml-1.5" />
                      </div>
                      <p className="min-w-0 flex-1 text-sm">
                        <span className="font-semibold">{from.name}</span> <span className="text-muted-foreground">pays</span>{" "}
                        <span className="font-semibold">{to.name}</span>
                      </p>
                      <span className="money text-xl font-semibold text-brand">{fmt(t.amount, cur)}</span>
                    </div>
                    {!readOnly && (
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setPayment(t)}>
                          Partial…
                        </Button>
                        <Button size="sm" className="rounded-lg px-3" disabled={busy === key} onClick={() => markPaid(t)}>
                          {busy === key ? <Loader2 className="animate-spin" /> : <Check />} Mark as paid
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="surface h-fit rounded-2xl p-5">
        <h2 className="font-semibold">Payment history</h2>
        {event.settlements.length === 0 ? (
          <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">Payments you mark as paid show up here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {event.settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-owed/12 text-owed">
                  <HandCoins className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm">
                    {name(s.fromId)} <ArrowRight className="size-3.5 text-muted-foreground" /> {name(s.toId)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(s.date, settings.locale, { day: "numeric", month: "short", year: "numeric" })}
                    {s.note && ` · ${s.note}`}
                  </p>
                </div>
                <span className="money font-medium">{fmt(s.amount, cur)}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Undo this payment"
                    aria-label="Undo this payment"
                    onClick={() => run({ type: "delete-settlement", id: s.id }, "Payment removed").catch(() => {})}
                  >
                    <Undo2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaymentDialog
        initial={payment}
        onClose={() => setPayment(null)}
        event={event}
        onSave={async (t, amount, date, note) => {
          await markPaid(t, amount, date, note);
          setPayment(null);
        }}
      />
    </div>
  );
}

type PaymentProps = {
  initial: Partial<Transfer> | null;
  onClose: () => void;
  event: EventDetail;
  onSave: (t: Transfer, amount: number, date: string, note: string) => Promise<void>;
};

function PaymentDialog(props: PaymentProps) {
  return (
    <Dialog open={!!props.initial} onOpenChange={(o) => !o && props.onClose()}>
      {props.initial && <PaymentForm {...props} initial={props.initial} />}
    </Dialog>
  );
}

function PaymentForm({ initial, onClose, event, onSave }: PaymentProps & { initial: Partial<Transfer> }) {
  const { settings, fmt } = useApp();
  const people = event.participants;
  const [fromId, setFromId] = useState(initial.fromId ?? people.find((p) => !p.isMe)?.id ?? people[0]?.id ?? "");
  const [toId, setToId] = useState(initial.toId ?? people.find((p) => p.isMe)?.id ?? people[1]?.id ?? "");
  const [amountStr, setAmountStr] = useState(initial.amount ? minorToInput(initial.amount, event.currency) : "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const suggested = initial.amount;

  const amount = parseAmount(amountStr, event.currency) ?? 0;
  const valid = amount > 0 && fromId && toId && fromId !== toId;

  return (
    <>
      <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{suggested ? "Record a partial payment" : "Record a payment"}</DialogTitle>
          <DialogDescription>
            {suggested ? `Suggested: ${fmt(suggested, event.currency)}. Enter what was actually paid.` : "Any money handed over between two people."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setSaving(true);
            await onSave({ fromId, toId, amount }, amount, date, note.trim()).finally(() => setSaving(false));
          }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="From">
              <NativeSelect value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <ArrowRight className="mb-3 size-4 text-muted-foreground" />
            <Field label="To">
              <NativeSelect value={toId} onChange={(e) => setToId(e.target.value)}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <span className="relative block">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencySymbol(event.currency, settings.locale)}
                </span>
                <input
                  autoFocus
                  inputMode="decimal"
                  className={cn(inputClass, "money pl-7")}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0"
                />
              </span>
            </Field>
            <Field label="Date">
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value || today())} />
            </Field>
          </div>
          <Field label="Note" hint="optional">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash, bank transfer…" />
          </Field>
          {fromId === toId && <p className="text-xs text-owe">Choose two different people.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl px-5" disabled={!valid || saving}>
              {saving && <Loader2 className="animate-spin" />} Save payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </>
  );
}
