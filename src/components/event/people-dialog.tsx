"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/components/fields";
import type { EventAction } from "@/lib/event-actions";
import type { EventDetail, Person } from "@/lib/types";

export function PeopleDialog({
  open,
  onOpenChange,
  event,
  people,
  run,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventDetail;
  people: Person[];
  run: (a: EventAction, success?: string) => Promise<EventDetail>;
  readOnly: boolean;
}) {
  const [name, setName] = useState("");
  const inEvent = new Set(event.participants.map((p) => p.id));
  // Shared events have their own people, so match your saved list by name there.
  const namesInEvent = new Set(event.participants.map((p) => p.name.toLowerCase()));
  const available = people.filter(
    (p) => !p.hidden && (event.shared ? !p.isMe && !namesInEvent.has(p.name.toLowerCase()) : !inEvent.has(p.id)),
  );

  const used = (id: string) =>
    event.expenses.some((e) => e.payers.some((p) => p.personId === id) || e.split.some((s) => s.personId === id)) ||
    event.settlements.some((s) => s.fromId === id || s.toId === id);

  const addNew = async () => {
    const n = name.trim();
    if (!n) return;
    // Clear straight away so the next name can be typed while this one saves; put it back if it fails.
    setName("");
    await run({ type: "add-participant", name: n }, `${n} added`).catch(() => setName((cur) => cur || n));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">People in this event</DialogTitle>
          <DialogDescription>Everyone here can pay for and share expenses.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-1">
          {event.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent/50">
              <Avatar person={p} size={30} />
              <span className="flex-1 text-sm">
                {p.name}
                {p.isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
              </span>
              {!p.isMe && !readOnly && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={used(p.id)}
                  title={used(p.id) ? "In expenses or payments, so they can't be removed" : `Remove ${p.name}`}
                  onClick={() => run({ type: "remove-participant", personId: p.id }, `${p.name} removed`).catch(() => {})}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {!readOnly && (
          <div className="space-y-3 border-t border-border pt-4">
            {available.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => run(event.shared ? { type: "add-participant", name: p.name } : { type: "add-participant", personId: p.id }, `${p.name} added`).catch(() => {})}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pr-3 pl-1 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
                  >
                    <Avatar person={p} size={22} />
                    {p.name}
                    <Plus className="size-3.5" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNew())}
                placeholder="New person's name"
              />
              <Button
                className="h-10 rounded-xl"
                // Keep the field focused (and the keyboard open) to add several people in a row.
                onPointerDown={(e) => e.pointerType !== "mouse" && e.preventDefault()}
                onClick={addNew}
                disabled={!name.trim()}
              >
                <Plus /> Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
