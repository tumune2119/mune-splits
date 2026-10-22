"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/fields";
import { parseShareInput } from "@/lib/shared/config";

/** Paste an invite link (for the Android and Windows apps, where tapping the link opens a browser). */
export function JoinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const sid = parseShareInput(text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Join a shared event</DialogTitle>
          <DialogDescription>Paste the invite link someone sent you.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sid) return;
            onOpenChange(false);
            setText("");
            router.push(`/join?e=${encodeURIComponent(sid)}`);
          }}
        >
          <input
            autoFocus
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://tumune2119.github.io/mune-splits/join?e=…"
          />
          {text && !sid && <p className="text-xs text-owe">That doesn&apos;t look like an invite link.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl px-5" disabled={!sid}>
              <LogIn /> Join
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
