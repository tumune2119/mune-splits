import { handle, readJson } from "@/lib/api";
import { listPeople } from "@/lib/store";
import { addPerson } from "@/lib/core/service";

export async function GET() {
  return handle(() => listPeople(true));
}

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(() => addPerson(body));
}
