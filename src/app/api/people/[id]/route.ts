import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { deletePerson, updatePerson } from "@/lib/store";

const Body = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60).optional(),
  color: z.string().max(16).optional(),
  hidden: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(() => {
    updatePerson(id, Body.parse(body));
    return { ok: true };
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  return handle(() => ({ result: deletePerson(id) }));
}
