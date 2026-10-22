import { Suspense } from "react";
import { Loading } from "@/components/screens";
import { PrintView } from "./print-view";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PrintView />
    </Suspense>
  );
}
