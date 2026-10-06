import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, listPeople } from "@/lib/store";
import { EventPage } from "@/components/event/event-page";

export async function generateMetadata(props: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getEvent(id)?.name ?? "Event" };
}

export default async function Page(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const event = getEvent(id);
  if (!event) notFound();
  // Keyed by id so switching events resets all client state.
  return <EventPage key={event.id} initial={event} people={listPeople()} />;
}
