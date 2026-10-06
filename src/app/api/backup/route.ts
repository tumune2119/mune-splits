import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { exportAll, importBackup, type BackupFile } from "@/lib/store";

export async function GET() {
  const stamp = new Date().toLocaleDateString("sv-SE");
  return new Response(JSON.stringify(exportAll(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mune-splits-backup-${stamp}.json"`,
    },
  });
}

const Backup = z.looseObject({
  app: z.literal("mune-splits"),
  version: z.literal(1),
  people: z.array(
    z.looseObject({ id: z.string().min(1), name: z.string(), color: z.string(), isMe: z.boolean(), hidden: z.boolean(), createdAt: z.number() }),
  ),
  events: z.array(
    z.looseObject({
      id: z.string().min(1),
      name: z.string(),
      currency: z.string(),
      status: z.enum(["active", "settled", "archived"]),
      expenses: z.array(z.looseObject({ id: z.string(), amount: z.number().int() })),
      settlements: z.array(z.looseObject({ id: z.string(), amount: z.number().int() })),
    }),
  ),
});

export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "replace" ? "replace" : "merge";
  const body = await readJson(request);
  return handle(() => {
    const parsed = Backup.safeParse(body);
    if (!parsed.success) return Response.json({ error: "That file isn't a MUNE Splits backup." }, { status: 400 });
    return { ...importBackup(parsed.data as unknown as BackupFile, mode), mode };
  });
}
