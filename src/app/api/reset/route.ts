import { handle, readJson } from "@/lib/api";
import { UserError, clearAll } from "@/lib/store";

/** Settings → Clear all data. Requires { confirm: "DELETE" } so it can't fire by accident. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(() => {
    if (body?.confirm !== "DELETE") throw new UserError("Type DELETE to confirm.");
    clearAll();
    return { ok: true };
  });
}
