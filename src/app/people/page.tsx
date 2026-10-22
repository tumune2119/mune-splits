import type { Metadata } from "next";
import { PeopleScreen } from "@/components/screens";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return <PeopleScreen />;
}
