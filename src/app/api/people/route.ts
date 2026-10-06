import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { ensurePerson, listPeople, updatePerson } from "@/lib/store";

export async function GET() {
  return handle(() => listPeople(true));
}

const Body = z.object({ name: z.string().trim().min(1, "Enter a name").max(60), color: z.string().max(16).optional() });

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(() => {
    const { name, color } = Body.parse(body);
    const person = ensurePerson(name, color);
    if (color) updatePerson(person.id, { color });
    return { ...person, color: color ?? person.color };
  });
}
