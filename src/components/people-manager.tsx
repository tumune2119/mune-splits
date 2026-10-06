"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/components/fields";
import { NEW_EVENT } from "@/components/app-shell";
import { send } from "@/lib/client/api";
import { PERSON_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PersonWithStats } from "@/lib/store";

export function PeopleManager({ people }: { people: PersonWithStats[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    const focus = () => document.querySelector<HTMLInputElement>("#new-person")?.focus();
    window.addEventListener(NEW_EVENT, focus);
    return () => window.removeEventListener(NEW_EVENT, focus);
  }, []);

  const call = async (p: Promise<unknown>, success?: string) => {
    try {
      await p;
      if (success) toast.success(success);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await call(send("/api/people", { name: n }), `${n} added`);
    setName("");
  };

  const hiddenCount = people.filter((p) => p.hidden).length;
  const visible = people.filter((p) => showHidden || !p.hidden);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your regulars, ready to add to any event in one click. Just labels — no accounts.</p>
      </header>

      <form onSubmit={add} className="mb-6 flex gap-2">
        <input id="new-person" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a friend's name" maxLength={60} />
        <Button type="submit" className="h-10 rounded-xl px-4" disabled={!name.trim()}>
          <Plus /> Add
        </Button>
      </form>

      {people.length <= 1 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
          <Users className="size-5 shrink-0" />
          Nobody here but you. Add friends above, or create an event and add them there.
        </div>
      )}

      <ul className="surface divide-y divide-border rounded-2xl">
        {visible.map((p) => (
          <PersonRow key={p.id} person={p} call={call} />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button onClick={() => setShowHidden((s) => !s)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Eye className="size-4" />
          {showHidden ? "Hide" : "Show"} {hiddenCount} hidden {hiddenCount === 1 ? "person" : "people"}
        </button>
      )}
    </div>
  );
}

function PersonRow({ person: p, call }: { person: PersonWithStats; call: (p: Promise<unknown>, s?: string) => Promise<void> }) {
  const [name, setName] = useState(p.name);
  const [picking, setPicking] = useState(false);

  const saveName = () => {
    const n = name.trim();
    if (!n || n === p.name) return setName(p.name);
    call(send(`/api/people/${p.id}`, { name: n }, "PATCH"), "Renamed");
  };

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", p.hidden && "opacity-60")}>
      <div className="relative">
        <button onClick={() => setPicking((x) => !x)} aria-label="Change colour" className="rounded-full transition-transform hover:scale-105">
          <Avatar person={p} size={38} />
        </button>
        {picking && (
          <div className="absolute top-full left-0 z-10 mt-2 grid w-44 grid-cols-5 gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-xl">
            {PERSON_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Colour ${c}`}
                onClick={() => {
                  setPicking(false);
                  call(send(`/api/people/${p.id}`, { color: c }, "PATCH"));
                }}
                className={cn("size-7 rounded-full", p.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-popover")}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full rounded-md bg-transparent px-1 py-0.5 font-medium outline-none hover:bg-accent/50 focus:bg-accent/60"
          aria-label="Name"
        />
        <p className="px-1 text-xs text-muted-foreground">
          {p.isMe ? "That's you · " : ""}
          {p.eventCount} event{p.eventCount === 1 ? "" : "s"}
          {p.hidden && " · hidden from quick-add"}
        </p>
      </div>
      {!p.isMe &&
        (p.hidden ? (
          <Button variant="ghost" size="sm" onClick={() => call(send(`/api/people/${p.id}`, { hidden: false }, "PATCH"), `${p.name} is back in quick-add`)}>
            Unhide
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            title={p.eventCount ? "Hide (they're in events, so they're kept)" : "Delete"}
            aria-label={`Remove ${p.name}`}
            onClick={() =>
              call(
                send<{ result: string }>(`/api/people/${p.id}`, undefined, "DELETE"),
                p.eventCount ? `${p.name} hidden (still in past events)` : `${p.name} deleted`,
              )
            }
          >
            <Trash2 />
          </Button>
        ))}
    </li>
  );
}
