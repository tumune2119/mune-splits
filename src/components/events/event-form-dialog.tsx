"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { Field, NativeSelect, inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { createEventRequest, patchEvent } from "@/lib/client/api";
import { CURRENCIES } from "@/lib/money";
import { EVENT_COLORS, EVENT_EMOJIS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { EventFields } from "@/lib/event-actions";
import type { EventBase, EventDetail, Person } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  people: Person[];
  event?: EventBase;
  onSaved?: (e: EventDetail) => void;
  /** Shared events save their details through the cloud instead of this device's database. */
  saveUpdate?: (fields: Partial<EventFields>) => Promise<EventDetail>;
};

/** Create a new event (with people) or edit an existing event's details. Fresh form state on every open. */
export function EventFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <EventForm {...props} />}
    </Dialog>
  );
}

function EventForm({ onOpenChange, people, event, onSaved, saveUpdate }: Props) {
  const router = useRouter();
  const { settings } = useApp();
  const editing = !!event;
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [emoji, setEmoji] = useState(event?.emoji || EVENT_EMOJIS[0]);
  const [color, setColor] = useState(event?.color || EVENT_COLORS[0]);
  const [currency, setCurrency] = useState(event?.currency ?? settings.defaultCurrency);
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [newPeople, setNewPeople] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const others = people.filter((p) => !p.isMe && !p.hidden);
  const me = people.find((p) => p.isMe);

  const addNewName = () => {
    const n = newName.trim();
    if (!n) return;
    const match = others.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (match) setSelected((s) => (s.includes(match.id) ? s : [...s, match.id]));
    else if (!newPeople.some((x) => x.toLowerCase() === n.toLowerCase()) && n.toLowerCase() !== me?.name.toLowerCase()) {
      setNewPeople((x) => [...x, n]);
    }
    setNewName("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the event a name.");
    if (startDate && endDate && endDate < startDate) return toast.error("The end date is before the start date.");
    setSaving(true);
    const fields = {
      name: name.trim(),
      description: description.trim(),
      emoji,
      color,
      currency,
      startDate: startDate || null,
      endDate: endDate || null,
    };
    try {
      if (editing) {
        const updated = saveUpdate ? await saveUpdate(fields) : await patchEvent(event!.id, { type: "update", fields });
        onSaved?.(updated);
        onOpenChange(false);
        toast.success("Event updated");
      } else {
        const pending = newName.trim() ? [...newPeople, newName.trim()] : newPeople;
        const created = await createEventRequest({ ...fields, personIds: selected, newPeople: pending });
        onOpenChange(false);
        router.push(`/event?id=${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl border border-border p-0 sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-lg font-semibold">{editing ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>{editing ? "Change the details. Amounts stay as they are." : "A trip, a dinner, a flat — anything you split."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="flex gap-3">
              <EmojiPicker value={emoji} onChange={setEmoji} color={color} />
              <Field label="Name" className="flex-1">
                <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa Trip" maxLength={120} />
              </Field>
            </div>

            <Field label="Description" hint="optional">
              <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Long weekend with the crew" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Ends">
                <input type="date" className={inputClass} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label="Currency">
                <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">Colour</span>
                <div className="flex h-10 items-center gap-1.5">
                  {EVENT_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      aria-label={`Colour ${c}`}
                      onClick={() => setColor(c)}
                      className={cn("size-5 rounded-full transition-transform hover:scale-110", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-popover")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {!editing && (
              <div className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground">People</span>
                <div className="flex flex-wrap gap-2">
                  {me && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 py-1 pr-3 pl-1 text-sm">
                      <Avatar person={me} size={22} />
                      {me.name}
                      <Lock className="size-3 text-muted-foreground" />
                    </span>
                  )}
                  {others.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                          on ? "border-brand/50 bg-brand/12 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                        )}
                      >
                        <Avatar person={p} size={22} />
                        {p.name}
                        {on && <Check className="size-3.5 text-brand" />}
                      </button>
                    );
                  })}
                  {newPeople.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/12 py-1 pr-1.5 pl-3 text-sm">
                      {n}
                      <button type="button" aria-label={`Remove ${n}`} onClick={() => setNewPeople((x) => x.filter((y) => y !== n))} className="rounded-full p-0.5 hover:bg-foreground/10">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNewName();
                      }
                    }}
                    placeholder="Add someone new — type a name, press Enter"
                  />
                  <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={addNewName} disabled={!newName.trim()}>
                    <Plus /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
            <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl px-5" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Save" : "Create event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </>
  );
}

function EmojiPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">Icon</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-xl border border-input text-xl transition-transform hover:scale-105"
        style={{ background: `${color}22` }}
        aria-label="Choose icon"
      >
        {value}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-10 mt-2 grid w-64 grid-cols-8 gap-1 rounded-xl border border-border bg-popover p-2 shadow-xl">
          {EVENT_EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className={cn("grid size-7 place-items-center rounded-lg text-lg hover:bg-accent", value === e && "bg-accent")}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
