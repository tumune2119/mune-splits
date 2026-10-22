"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { backend, invalidate } from "@/lib/client/backend";
import { shareText } from "@/lib/client/platform";
import { shareLink } from "@/lib/shared/config";
import { upsertMembership } from "@/lib/shared/memberships";
import type { EventDetail } from "@/lib/types";

/**
 * Local event → "Share online": uploads it and turns it into a shared event.
 * Shared event → the invite link to send to the group.
 */
export function ShareDialog({ open, onOpenChange, event }: { open: boolean; onOpenChange: (o: boolean) => void; event: EventDetail }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (event.shared ? <InviteBody event={event} /> : <ShareBody event={event} onDone={() => onOpenChange(false)} />)}
    </Dialog>
  );
}

function ShareBody({ event, onDone }: { event: EventDetail; onDone: () => void }) {
  const router = useRouter();
  const { settings } = useApp();
  const [busy, setBusy] = useState(false);
  const [myName, setMyName] = useState(settings.myName === "You" ? "" : settings.myName);
  const clash = event.participants.some((p) => !p.isMe && p.name.toLowerCase() === myName.trim().toLowerCase());
  const nameOk = myName.trim().length > 0 && myName.trim().toLowerCase() !== "you" && !clash;

  const share = async () => {
    setBusy(true);
    try {
      const { shareLocalEvent } = await import("@/lib/shared/client");
      const b = await backend();
      const { sid, me } = await shareLocalEvent(
        event,
        async (name) => {
          const url = await b.receiptUrl(name);
          return url ? (await fetch(url)).blob() : null;
        },
        myName.trim(),
      );
      upsertMembership({ sid, me, name: event.name });
      // The shared copy replaces the one on this device.
      await b.deleteEvent(event.id);
      invalidate();
      onDone();
      router.replace(`/event?s=${encodeURIComponent(sid)}&invite=1`);
      toast.success("Event shared");
    } catch (err) {
      toast.error(`Couldn't share it: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
      <DialogHeader>
        <span className="mb-1 grid size-11 place-items-center rounded-xl bg-brand/15 text-brand">
          <Globe className="size-5" />
        </span>
        <DialogTitle className="text-lg font-semibold">Share “{event.name}” with the group</DialogTitle>
        <DialogDescription>Everyone with the link sees the same event and can add expenses and mark payments. Changes show up for everyone straight away.</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-owed" /> Friends open the link, tap who they are, and they&apos;re in. No sign-ups.
        </li>
        <li className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-owed" /> The event moves online (Google Firebase). Your other events stay only on this device.
        </li>
        <li className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-owed" /> Anyone with the link can see and edit it, so send it only to the group.
        </li>
      </ul>
      <Field label="Your name in this event" hint="friends see it when they pick who they are">
        <input className={inputClass} value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" maxLength={60} />
      </Field>
      {clash && <p className="text-xs text-owe">Someone in this event already has that name.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" className="h-10 rounded-xl" onClick={onDone} disabled={busy}>
          Not now
        </Button>
        <Button className="h-10 rounded-xl px-5" onClick={share} disabled={busy || !nameOk}>
          {busy ? <Loader2 className="animate-spin" /> : <Share2 />} Share online
        </Button>
      </div>
    </DialogContent>
  );
}

function InviteBody({ event }: { event: EventDetail }) {
  const link = shareLink(event.shared!.sid);
  const [copied, setCopied] = useState(false);
  const message = `Join “${event.name}” on MUNE Splits to add what you paid and see who owes whom: ${link}`;

  return (
    <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Invite the group</DialogTitle>
        <DialogDescription>Send this link to everyone in “{event.name}”. They tap who they are, then everything stays in sync.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2 pl-3">
        <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button
        className="h-11 rounded-xl"
        onClick={async () => {
          const how = await shareText(message).catch(() => null);
          if (how === "copied") toast.success("Invite copied. Paste it into WhatsApp.");
        }}
      >
        <Share2 /> Send invite
      </Button>
      <p className="text-xs text-muted-foreground">Anyone with the link can see and edit this event. It opens in any browser, and Android or Windows friends can paste it into the app under “Join with a link”.</p>
    </DialogContent>
  );
}
