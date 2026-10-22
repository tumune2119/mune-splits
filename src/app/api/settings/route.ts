import { handle, readJson } from "@/lib/api";
import { getSettings } from "@/lib/store";
import { patchSettings } from "@/lib/core/service";

export async function GET() {
  return handle(() => getSettings());
}

/** Partial update: anything left out keeps its current value. */
export async function PATCH(request: Request) {
  const body = await readJson(request);
  return handle(() => patchSettings(body));
}
