import { handle } from "@/lib/api";
import { createDemoTrip } from "@/lib/demo";

export async function POST() {
  return handle(() => ({ id: createDemoTrip() }));
}
