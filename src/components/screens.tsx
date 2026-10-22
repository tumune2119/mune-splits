"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  return <EventsHome events={data.events} people={data.people} />;
}

export function EventScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(async (b) => ({ event: await b.getEvent(id), people: await b.listPeople() }), [id]);
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  if (!data.event) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-medium">This event doesn&apos;t exist any more</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
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
