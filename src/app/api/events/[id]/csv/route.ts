import { eventToCsv } from "@/lib/csv";
import { getEvent } from "@/lib/store";
import { fileSafe } from "@/lib/format";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/csv">) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });
  const stamp = new Date().toLocaleDateString("sv-SE");
  return new Response(eventToCsv(event), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="MUNE-Splits_${fileSafe(event.name)}_${stamp}.csv"`,
    },
  });
}
