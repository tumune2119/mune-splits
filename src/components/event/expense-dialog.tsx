"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ImagePlus, Loader2, Minus, Paperclip, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { Field, Segmented, inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { uploadReceipt } from "@/lib/client/api";
import { currencySymbol, minorToInput, parseAmount } from "@/lib/money";
import { previewShares, validateExpense, type SplitEntry, type SplitMode } from "@/lib/splits";
import { SPLIT_MODE_LABELS, today } from "@/lib/constants";
import { trimNum } from "@/lib/event-math";
import { cn } from "@/lib/utils";
import type { ExpenseFields } from "@/lib/event-actions";
import type { EventDetail, Expense } from "@/lib/types";

type NumMap = Record<string, string>;

const WEIGHT_CHIPS = [
  { label: "½", value: "0.5" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventDetail;
  expense?: Expense | null;
  onSubmit: (fields: ExpenseFields) => Promise<void>;
  onDelete?: () => void;
};

/** The form mounts only while open (keyed by expense), so every open starts from fresh state. */
export function ExpenseDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <ExpenseForm key={props.expense?.id ?? "new"} {...props} />}
    </Dialog>
  );
}

function initialState(event: EventDetail, expense: Expense | null | undefined, defaultCategory: string) {
  const people = event.participants;
  const cur = event.currency;
  const defaultPayer = people.find((p) => p.isMe)?.id ?? people[0]?.id ?? "";
  const all = Object.fromEntries(people.map((p) => [p.id, true]));
  const ones: NumMap = Object.fromEntries(people.map((p) => [p.id, "1"]));
  if (!expense) {
    return {
      amountStr: "", title: "", date: today(), category: defaultCategory, multiPayer: false, payerId: defaultPayer,
      payerAmounts: {} as NumMap, mode: "equal" as SplitMode, included: all, weights: ones, exacts: {} as NumMap,
      percents: {} as NumMap, notes: "", receipt: null as string | null,
    };
  }
  const e = expense;
  const byId = (pick: (s: SplitEntry) => string): NumMap => Object.fromEntries(e.split.map((s) => [s.personId, pick(s)]));
  return {
    amountStr: minorToInput(e.amount, cur),
    title: e.title,
    date: e.date,
    category: e.category,
    multiPayer: e.payers.length > 1,
    payerId: e.payers[0]?.personId ?? defaultPayer,
    payerAmounts: Object.fromEntries(e.payers.map((p) => [p.personId, minorToInput(p.amount, cur)])) as NumMap,
    mode: e.mode,
    included: e.mode === "equal" ? Object.fromEntries(people.map((p) => [p.id, e.split.some((s) => s.personId === p.id)])) : all,
    weights: e.mode === "shares" ? { ...Object.fromEntries(people.map((p) => [p.id, "0"])), ...byId((s) => trimNum(s.value)) } : ones,
    exacts: e.mode === "exact" ? byId((s) => minorToInput(s.value, cur)) : ({} as NumMap),
    percents: e.mode === "percent" ? byId((s) => trimNum(s.value)) : ({} as NumMap),
    notes: e.notes,
    receipt: e.receipt,
  };
}

function ExpenseForm({ onOpenChange, event, expense, onSubmit, onDelete }: Props) {
  const { settings, fmt } = useApp();
  const cur = event.currency;
  const people = event.participants;
  const [init] = useState(() => initialState(event, expense, settings.categories[0]?.name ?? "Other"));

  const [amountStr, setAmountStr] = useState(init.amountStr);
  const [title, setTitle] = useState(init.title);
  const [date, setDate] = useState(init.date);
  const [category, setCategory] = useState(init.category);
  const [multiPayer, setMultiPayer] = useState(init.multiPayer);
  const [payerId, setPayerId] = useState(init.payerId);
  const [payerAmounts, setPayerAmounts] = useState<NumMap>(init.payerAmounts);
  const [mode, setMode] = useState<SplitMode>(init.mode);
  const [included, setIncluded] = useState<Record<string, boolean>>(init.included);
  const [weights, setWeights] = useState<NumMap>(init.weights);
  const [exacts, setExacts] = useState<NumMap>(init.exacts);
  const [percents, setPercents] = useState<NumMap>(init.percents);
  const [notes, setNotes] = useState(init.notes);
  const [receipt, setReceipt] = useState<string | null>(init.receipt);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountStr, cur) ?? 0;

  const payers = useMemo(
    () =>
      multiPayer
        ? people.map((p) => ({ personId: p.id, amount: parseAmount(payerAmounts[p.id] ?? "", cur) ?? 0 })).filter((p) => p.amount > 0)
        : [{ personId: payerId, amount }],
    [multiPayer, people, payerAmounts, cur, payerId, amount],
  );

  const split = useMemo<SplitEntry[]>(() => {
    switch (mode) {
      case "equal":
        return people.filter((p) => included[p.id]).map((p) => ({ personId: p.id, value: 1 }));
      case "shares":
        return people.map((p) => ({ personId: p.id, value: Math.max(0, Number(weights[p.id] ?? "0") || 0) }));
      case "exact":
        return people.map((p) => ({ personId: p.id, value: parseAmount(exacts[p.id] ?? "", cur) ?? 0 }));
      case "percent":
        return people.map((p) => ({ personId: p.id, value: Math.max(0, Number(percents[p.id] ?? "0") || 0) }));
    }
  }, [mode, people, included, weights, exacts, percents, cur]);

  const cleanSplit = mode === "equal" ? split : split.filter((s) => s.value > 0);
  const preview = useMemo(() => previewShares(amount, mode, split), [amount, mode, split]);
  const problem = !title.trim() ? "Add a title." : validateExpense({ amount, payers, mode, split: cleanSplit });

  const paidSum = payers.reduce((s, p) => s + p.amount, 0);
  const exactSum = mode === "exact" ? split.reduce((s, x) => s + x.value, 0) : 0;
  const pctSum = mode === "percent" ? split.reduce((s, x) => s + x.value, 0) : 0;
  const weightSum = mode === "shares" ? split.reduce((s, x) => s + x.value, 0) : 0;

  const submit = async () => {
    if (problem) {
      setShowErrors(true);
      if (!amount) amountRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), amount, date, category, payers, mode, split: cleanSplit, notes: notes.trim(), receipt });
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setReceipt(await uploadReceipt(file));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** When switching to multiple payers, start with the current payer covering the whole amount. */
  const toggleMulti = () => {
    if (!multiPayer) setPayerAmounts({ [payerId]: minorToInput(amount, cur) });
    else {
      const top = [...payers].sort((a, b) => b.amount - a.amount)[0];
      if (top) setPayerId(top.personId);
    }
    setMultiPayer(!multiPayer);
  };

  /** Fill the last empty exact/percent row with whatever is left. */
  const fillRemainder = (id: string) => {
    if (mode === "exact") {
      const others = split.filter((s) => s.personId !== id).reduce((s, x) => s + x.value, 0);
      if (amount - others > 0) setExacts((m) => ({ ...m, [id]: minorToInput(amount - others, cur) }));
    } else if (mode === "percent") {
      const others = split.filter((s) => s.personId !== id).reduce((s, x) => s + x.value, 0);
      if (100 - others > 0) setPercents((m) => ({ ...m, [id]: trimNum(100 - others) }));
    }
  };

  const symbol = currencySymbol(cur, settings.locale);

  return (
    <>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden rounded-2xl border border-border p-0 sm:max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <DialogTitle className="text-base font-semibold">{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription className="sr-only">Amount, who paid and how to split it.</DialogDescription>
          <button onClick={() => onOpenChange(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Amount first */}
          <div className="text-center">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-3xl font-medium text-muted-foreground">{symbol}</span>
              <input
                ref={amountRef}
                autoFocus
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0"
                aria-label="Amount"
                className="money max-w-[70vw] bg-transparent text-center text-5xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
                style={{ width: `${Math.max(2, amountStr.length + 1)}ch` }}
              />
            </div>
            {showErrors && !amount && <p className="mt-1 text-xs text-owe">Enter an amount</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <Field label="What for?">
              <input className={cn(inputClass, showErrors && !title.trim() && "border-owe")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, cab, tickets…" maxLength={160} />
            </Field>
            <Field label="Date">
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value || today())} />
            </Field>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-muted-foreground">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {settings.categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    category === c.name ? "border-brand/60 bg-brand/12 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{c.emoji}</span>
                  {c.name}
                </button>
              ))}
              {!settings.categories.some((c) => c.name === category) && (
                <span className="inline-flex items-center rounded-full border border-brand/60 bg-brand/12 px-3 py-1.5 text-sm">{category}</span>
              )}
            </div>
          </div>

          {/* Paid by */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Paid by</span>
              <button type="button" onClick={toggleMulti} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Users className="size-3.5" />
                {multiPayer ? "Single payer" : "Multiple payers"}
              </button>
            </div>
            {!multiPayer ? (
              <div className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPayerId(p.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                      payerId === p.id ? "border-brand/60 bg-brand/12 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Avatar person={p} size={22} />
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border p-2">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-1">
                    <Avatar person={p} size={26} />
                    <span className="flex-1 truncate text-sm">{p.name}</span>
                    <MoneyInput symbol={symbol} value={payerAmounts[p.id] ?? ""} onChange={(v) => setPayerAmounts((m) => ({ ...m, [p.id]: v }))} />
                  </div>
                ))}
                <Remaining label="Paid" have={paidSum} need={amount} format={(v) => fmt(v, cur)} />
              </div>
            )}
          </section>

          {/* Split */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Split</span>
              <Segmented<SplitMode>
                size="sm"
                value={mode}
                onChange={setMode}
                options={(["equal", "shares", "exact", "percent"] as const).map((m) => ({ value: m, label: SPLIT_MODE_LABELS[m] }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "equal" && "Everyone ticked pays the same."}
              {mode === "shares" && "Set a weight per person: 2 counts as two people, ½ as a half portion, 0 leaves them out."}
              {mode === "exact" && "Type each person's amount. It has to add up to the total."}
              {mode === "percent" && "Give each person a percentage. It has to add up to 100%."}
            </p>

            <div className="divide-y divide-border rounded-xl border border-border">
              {people.map((p) => {
                const share = preview.get(p.id) ?? 0;
                const off = mode === "equal" ? !included[p.id] : (split.find((s) => s.personId === p.id)?.value ?? 0) === 0;
                return (
                  <div key={p.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-opacity", off && "opacity-55")}>
                    {mode === "equal" ? (
                      <button
                        type="button"
                        onClick={() => setIncluded((m) => ({ ...m, [p.id]: !m[p.id] }))}
                        className="flex min-w-28 flex-1 items-center gap-3 text-left"
                        aria-pressed={!!included[p.id]}
                      >
                        <span className={cn("grid size-5 place-items-center rounded-md border", included[p.id] ? "border-brand bg-brand text-primary-foreground" : "border-input")}>
                          {included[p.id] && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <Avatar person={p} size={26} />
                        <span className="truncate text-sm">{p.name}</span>
                      </button>
                    ) : (
                      <span className="flex min-w-28 flex-1 items-center gap-3">
                        <Avatar person={p} size={26} />
                        <span className="truncate text-sm">{p.name}</span>
                      </span>
                    )}

                    {mode === "shares" && (
                      <WeightControl value={weights[p.id] ?? "0"} onChange={(v) => setWeights((m) => ({ ...m, [p.id]: v }))} />
                    )}
                    {mode === "exact" && (
                      <MoneyInput
                        symbol={symbol}
                        value={exacts[p.id] ?? ""}
                        onChange={(v) => setExacts((m) => ({ ...m, [p.id]: v }))}
                        onDoubleClick={() => fillRemainder(p.id)}
                      />
                    )}
                    {mode === "percent" && (
                      <span className="relative">
                        <input
                          inputMode="decimal"
                          value={percents[p.id] ?? ""}
                          onChange={(e) => setPercents((m) => ({ ...m, [p.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                          onDoubleClick={() => fillRemainder(p.id)}
                          placeholder="0"
                          className={cn(inputClass, "money h-9 w-24 pr-7 text-right")}
                          aria-label={`${p.name} percent`}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </span>
                    )}

                    <span className={cn("money w-24 text-right text-sm font-medium", share ? "text-foreground" : "text-muted-foreground/60")}>
                      {fmt(share, cur)}
                    </span>
                  </div>
                );
              })}
              {mode === "exact" && (
                <div className="px-3 py-2">
                  <Remaining label="Assigned" have={exactSum} need={amount} format={(v) => fmt(v, cur)} />
                </div>
              )}
              {mode === "percent" && (
                <div className="px-3 py-2">
                  <Remaining label="Total" have={Math.round(pctSum * 100)} need={10000} format={(v) => `${trimNum(v / 100)}%`} />
                </div>
              )}
              {mode === "shares" && (
                <div className="flex justify-between px-3 py-2 text-xs text-muted-foreground">
                  <span>Total weight {trimNum(weightSum)}</span>
                  {weightSum > 0 && amount > 0 && <span className="money">{fmt(Math.round(amount / weightSum), cur)} per 1×</span>}
                </div>
              )}
              {mode === "equal" && (
                <div className="flex justify-between px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {split.length} of {people.length} people
                  </span>
                  <button
                    type="button"
                    className="font-medium text-brand hover:underline"
                    onClick={() => setIncluded(Object.fromEntries(people.map((p) => [p.id, split.length !== people.length])))}
                  >
                    {split.length === people.length ? "Select none" : "Select all"}
                  </button>
                </div>
              )}
            </div>
            {(mode === "exact" || mode === "percent") && <p className="text-[0.7rem] text-muted-foreground">Tip: double-click a box to fill in what&apos;s left.</p>}
          </section>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Notes" hint="optional">
              <textarea className={cn(inputClass, "h-auto min-h-10 py-2")} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering" />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Receipt</span>
              {receipt ? (
                <div className="relative">
                  <a href={`/api/receipts/${receipt}`} target="_blank" rel="noreferrer" className="block">
                    {receipt.endsWith(".pdf") || receipt.endsWith(".heic") ? (
                      <span className="grid size-16 place-items-center rounded-xl border border-border bg-muted text-xs text-muted-foreground">
                        <Paperclip className="size-5" />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/receipts/${receipt}`} alt="Receipt" className="size-16 rounded-xl border border-border object-cover" />
                    )}
                  </a>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="absolute -top-1.5 -right-1.5 rounded-full border border-border bg-popover p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Remove receipt"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-5 py-3.5">
          {expense && onDelete && (
            <Button type="button" variant="ghost" size="icon-lg" className="rounded-xl text-owe hover:text-owe" onClick={onDelete} aria-label="Delete expense">
              <Trash2 />
            </Button>
          )}
          <p className={cn("min-w-0 flex-1 truncate text-xs", problem && (showErrors || amount > 0) ? "text-owe" : "text-muted-foreground")}>
            {problem && (showErrors || amount > 0) ? (
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="size-3.5 shrink-0" /> {problem}
              </span>
            ) : (
              <span className="hidden sm:inline">Ctrl + Enter to save</span>
            )}
          </p>
          <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-10 rounded-xl px-5" onClick={submit} disabled={saving || uploading || (!!problem && (showErrors || amount > 0))}>
            {saving && <Loader2 className="animate-spin" />}
            {expense ? "Save" : "Add expense"}
          </Button>
        </div>
      </DialogContent>
    </>
  );
}

function MoneyInput({ symbol, value, onChange, onDoubleClick }: { symbol: string; value: string; onChange: (v: string) => void; onDoubleClick?: () => void }) {
  return (
    <span className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        onDoubleClick={onDoubleClick}
        placeholder="0"
        className={cn(inputClass, "money h-9 w-32 pl-7 text-right")}
      />
    </span>
  );
}

function WeightControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value) || 0;
  const step = (d: number) => onChange(trimNum(Math.max(0, Math.round((n + d) * 2) / 2)));
  return (
    <span className="flex items-center gap-1">
      {WEIGHT_CHIPS.map((c) => (
        <button
          type="button"
          key={c.value}
          onClick={() => onChange(c.value)}
          className={cn(
            "h-7 min-w-7 rounded-lg border px-1.5 text-xs font-semibold transition-colors",
            Number(c.value) === n ? "border-brand bg-brand text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {c.label}
        </button>
      ))}
      <span className="ml-1 flex items-center rounded-lg border border-input">
        <button type="button" onClick={() => step(-0.5)} className="grid h-7 w-6 place-items-center text-muted-foreground hover:text-foreground" aria-label="Less">
          <Minus className="size-3" />
        </button>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          className="money h-7 w-10 bg-transparent text-center text-sm outline-none"
          aria-label="Weight"
        />
        <button type="button" onClick={() => step(0.5)} className="grid h-7 w-6 place-items-center text-muted-foreground hover:text-foreground" aria-label="More">
          <Plus className="size-3" />
        </button>
      </span>
    </span>
  );
}

function Remaining({ label, have, need, format }: { label: string; have: number; need: number; format: (v: number) => string }) {
  const diff = need - have;
  return (
    <div className="flex justify-between px-1 pt-1 text-xs">
      <span className="text-muted-foreground">
        {label} <span className="money">{format(have)}</span> of <span className="money">{format(need)}</span>
      </span>
      <span className={cn("money font-medium", diff === 0 ? "text-owed" : "text-owe")}>
        {diff === 0 ? "Adds up ✓" : diff > 0 ? `${format(diff)} left` : `${format(-diff)} over`}
      </span>
    </div>
  );
}

