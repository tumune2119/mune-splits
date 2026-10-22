import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen, Loading } from "@/components/screens";

export const metadata: Metadata = { title: "Join event" };

// The share link: /join?e=<share id>
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <JoinScreen />
    </Suspense>
  );
}
