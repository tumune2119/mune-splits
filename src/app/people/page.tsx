import type { Metadata } from "next";
import { listPeople } from "@/lib/store";
import { PeopleManager } from "@/components/people-manager";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return <PeopleManager people={listPeople(true)} />;
}
