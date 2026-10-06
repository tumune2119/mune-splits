import { handle, readJson } from "@/lib/api";
import { createEvent, listEventSummaries } from "@/lib/store";

export async function GET() {
  return handle(() => listEventSummaries());
}

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(() => createEvent(body));
}
