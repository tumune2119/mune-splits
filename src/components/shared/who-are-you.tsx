"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/components/fields";
import type { EventDetail } from "@/lib/types";

/** "Which one are you?" — tap your name, or add yourself if you're not on the list. */
export function WhoAreYou({
  event,
  onPick,
  onAddSelf,
}: {
  event: EventDetail;
  onPick: (personId: string) => void;
  onAddSelf: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="surface-hero rise rounded-3xl p-6">
        <span className="grid size-14 place-items-center rounded-2xl text-3xl" style={{ background: `${event.color || "#FFB38A"}22` }}>
          {event.emoji || "🧾"}
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;ve been invited. Which one are you?</p>

        <div className="mt-6 grid gap-2">
          {event.participants.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3 text-left transition-colors hover:border-brand/60 hover:bg-brand/8"
            >
              <Avatar person={p} size={34} />
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
        </div>

        <form
          className="mt-6 space-y-2 border-t border-border pt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            try {
              await onAddSelf(name.trim());
            } catch (err) {
              toast.error((err as Error).message);
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">Not on the list?</p>
          <div className="flex gap-2">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} />
            <Button type="submit" className="h-10 rounded-xl" disabled={!name.trim() || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Join
            </Button>
          </div>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Your choice is remembered on this device. Expenses you add are marked as yours.</p>
    </div>
  );
}
