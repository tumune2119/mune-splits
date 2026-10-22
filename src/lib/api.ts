import "server-only";
import { ZodError } from "zod";
import { NotFoundError, UserError } from "./core/store";

/** Runs a route handler body and turns known errors into JSON responses. */
export async function handle(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof ZodError) return Response.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    console.error("[MUNE Splits]", err);
    return Response.json({ error: (err as Error).message || "Something went wrong" }, { status: 500 });
  }
}

export const readJson = (request: Request) => request.json().catch(() => null);
