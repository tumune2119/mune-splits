"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhoAreYou } from "@/components/shared/who-are-you";
import { parseShareInput, sharingEnabled } from "@/lib/shared/config";
import { getMembership, listMemberships, onMembershipsChanged, removeMembership, upsertMembership } from "@/lib/shared/memberships";
import type { EventDetail, EventSummary } from "@/lib/types";
import { useData } from "@/lib/client/api";
import { EventsHome } from "@/components/events/events-home";
import { EventPage } from "@/components/event/event-page";
import { PeopleManager } from "@/components/people-manager";
import { SettingsForm } from "@/components/settings-form";
import { useApp } from "@/components/app-provider";

/**
 * Screen loaders: each page fetches its data through the backend (desktop server or on-device
 * database), so the same pages work as a server app and as static files inside the phone app.
 */

export function Loading() {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

function Failed({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  );
}

export function HomeScreen() {
  const { data, error } = useData(async (b) => ({ events: await b.listEvents(), people: await b.listPeople() }));
  const shared = useSharedSummaries();
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  const events = [...data.events, ...shared].sort((a, b) => b.updatedAt - a.updatedAt);
  return <EventsHome events={events} people={data.people} />;
}

/** Summaries of the shared events this device has joined (read from Firestore, or its offline copy). */
function useSharedSummaries(): EventSummary[] {
  const [list, setList] = useState<EventSummary[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => onMembershipsChanged(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    const memberships = listMemberships();
    if (!sharingEnabled() || memberships.length === 0) return;
    let alive = true;
    import("@/lib/shared/client").then(async (c) => {
      const results = await Promise.allSettled(memberships.map((m) => c.getSharedEvent(m.sid, m.me)));
      const out = results.flatMap((r) => (r.status === "fulfilled" && r.value ? [c.summarize(r.value)] : []));
      if (alive) setList(out);
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  return sharingEnabled() && listMemberships().length > 0 ? list : [];
}

export function EventScreen() {
  const sid = useSearchParams().get("s");
  if (sid) return sharingEnabled() ? <SharedEventScreen sid={sid} /> : <SharingOff />;
  return <LocalEventScreen />;
}

function LocalEventScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(async (b) => ({ event: await b.getEvent(id), people: await b.listPeople() }), [id]);
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  if (!data.event) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-medium">This event doesn&apos;t exist any more</p>
        <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">
          Back to events
        </Link>
      </div>
    );
  }
  // Keyed by id so switching events resets all client state.
  return <EventPage key={data.event.id} initial={data.event} people={data.people} />;
}

export function PeopleScreen() {
  const { data, error } = useData((b) => b.listPeople(true));
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  return <PeopleManager people={data} />;
}

export function SettingsScreen() {
  const { info } = useApp();
  return <SettingsForm dataPath={info.dataLocation} />;
}

/* ---- shared events ------------------------------------------------------------------------- */

function SharingOff() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="font-medium">Shared events aren&apos;t available in this version</p>
      <p className="mt-1 text-sm text-muted-foreground">Update MUNE Splits, or open the link in a browser.</p>
    </div>
  );
}

/** /event?s=<share id>: a live shared event. Asks "who are you?" the first time on this device. */
export function SharedEventScreen({ sid }: { sid: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [membership, setMembership] = useState(() => getMembership(sid));
  const [event, setEvent] = useState<EventDetail | null | undefined>(undefined);
  const [failed, setFailed] = useState<Error | null>(null);
  const me = membership?.me ?? null;
  const people = useData((b) => b.listPeople()).data ?? [];

  useEffect(() => onMembershipsChanged(() => setMembership(getMembership(sid))), [sid]);

  useEffect(() => {
    let stop = () => {};
    let alive = true;
    import("@/lib/shared/client").then((c) => {
      if (!alive) return;
      stop = c.subscribeEvent(
        sid,
        me,
        (e) => {
          setEvent(e);
          if (e && getMembership(sid)?.name !== e.name) upsertMembership({ sid, me: getMembership(sid)?.me ?? null, name: e.name });
        },
        (change) => toast(change.text),
        (err) => setFailed(err),
      );
      const offErr = c.onSyncError((m) => toast.error(`A change didn't sync: ${m}`));
      const prev = stop;
      stop = () => {
        prev();
        offErr();
      };
    });
    return () => {
      alive = false;
      stop();
    };
  }, [sid, me]);

  if (failed) return <Failed error={failed} />;
  if (event === undefined) return <Loading />;
  if (event === null) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-medium">This shared event no longer exists</p>
        <p className="mt-1 text-sm text-muted-foreground">Someone deleted it for everyone.</p>
        <Button
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={() => {
            removeMembership(sid);
            router.replace("/");
          }}
        >
          Remove it from my list
        </Button>
      </div>
    );
  }
  if (!me || !event.participants.some((p) => p.id === me)) {
    return (
      <WhoAreYou
        event={event}
        onPick={(id) => upsertMembership({ sid, me: id, name: event.name })}
        onAddSelf={async (name) => {
          const { joinAsNewPerson } = await import("@/lib/shared/client");
          const id = await joinAsNewPerson(sid, name);
          upsertMembership({ sid, me: id, name: event.name });
        }}
      />
    );
  }
  return <EventPage key={sid} initial={event} people={people} openInvite={params.get("invite") === "1"} />;
}

/** /join?e=<share id>: the link people receive. Remembers the event, then opens it. */
export function JoinScreen() {
  const router = useRouter();
  const sid = parseShareInput(useSearchParams().get("e") ?? "");
  useEffect(() => {
    if (!sid || !sharingEnabled()) return;
    if (!getMembership(sid)) upsertMembership({ sid, me: null, name: "" });
    router.replace(`/event?s=${encodeURIComponent(sid)}`);
  }, [sid, router]);
  if (!sharingEnabled()) return <SharingOff />;
  if (!sid) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-medium">That link isn&apos;t complete</p>
        <p className="mt-1 text-sm text-muted-foreground">Ask whoever sent it to copy the whole link again.</p>
      </div>
    );
  }
  return <Loading />;
}
