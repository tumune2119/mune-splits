import { Suspense } from "react";
import { EventScreen, Loading } from "@/components/screens";

// /event?id=… (a query string rather than /events/[id], so the phone app can ship as static files)
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <EventScreen />
    </Suspense>
  );
}
