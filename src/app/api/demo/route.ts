import { handle } from "@/lib/api";
import "@/lib/store"; // registers the desktop database
import { createDemoTrip } from "@/lib/core/demo";

export async function POST() {
  return handle(() => ({ id: createDemoTrip() }));
}
