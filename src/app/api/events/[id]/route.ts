import { handle, readJson } from "@/lib/api";
import { NotFoundError, applyEventAction, deleteEvent, getEvent } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  return handle(() => {
    const event = getEvent(id);
    if (!event) throw new NotFoundError("Event not found");
    return event;
  });
}

/** Applies one edit action (see src/lib/event-actions.ts) and returns the updated event. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(() => applyEventAction(id, body));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  return handle(() => deleteEvent(id));
}
