import { handle, readJson } from "@/lib/api";
import { exportAll, importBackup } from "@/lib/store";
import { parseBackup } from "@/lib/core/service";

export async function GET() {
  return handle(() => exportAll());
}

export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "replace" ? "replace" : "merge";
  const body = await readJson(request);
  return handle(() => ({ ...importBackup(parseBackup(body), mode), mode }));
}
