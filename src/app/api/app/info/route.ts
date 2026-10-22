import { AUTO_EXIT } from "@/lib/app-lifetime";
import { dataDir } from "@/lib/db";

/** What the browser needs to know about this desktop server. */
export async function GET() {
  return Response.json({ platform: "desktop", launched: AUTO_EXIT, dataLocation: dataDir(), native: false });
}
