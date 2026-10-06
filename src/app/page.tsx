import { EventsHome } from "@/components/events/events-home";
import { listEventSummaries, listPeople } from "@/lib/store";

export default function HomePage() {
  return <EventsHome events={listEventSummaries()} people={listPeople()} />;
}
