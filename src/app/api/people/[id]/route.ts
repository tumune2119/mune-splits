import { handle, readJson } from "@/lib/api";
import { deletePerson } from "@/lib/store";
import { editPerson } from "@/lib/core/service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(() => {
    editPerson(id, body);
    return { ok: true };
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  return handle(() => ({ result: deletePerson(id) }));
}
