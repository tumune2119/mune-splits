import fs from "node:fs";
import { receiptMime, receiptPath } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/receipts/[name]">) {
  const { name } = await ctx.params;
  const file = receiptPath(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(/*turbopackIgnore: true*/ file)), {
    headers: { "Content-Type": receiptMime(name), "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
