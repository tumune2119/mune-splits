import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { UserError, getSettings, saveSettings } from "@/lib/store";

const Settings = z.object({
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().min(2).max(20),
  myName: z.string().trim().min(1, "Enter your name").max(60),
  theme: z.enum(["dark", "light"]),
  categories: z
    .array(z.object({ name: z.string().trim().min(1, "Categories need a name").max(40), emoji: z.string().max(16), color: z.string().max(16) }))
    .min(1, "Keep at least one category"),
});

export async function GET() {
  return handle(() => getSettings());
}

/** Partial update: anything left out keeps its current value. */
export async function PATCH(request: Request) {
  const body = await readJson(request);
  return handle(() => {
    const next = Settings.parse({ ...getSettings(), ...(body ?? {}) });
    const names = next.categories.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new UserError("Category names must be unique.");
    saveSettings(next);
    return next;
  });
}
