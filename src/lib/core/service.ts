/**
 * Input validation shared by the desktop API routes and the on-device (phone/web) backend, so both
 * platforms accept and reject exactly the same things.
 */
import { z } from "zod";
import { UserError, ensurePerson, getSettings, saveSettings, updatePerson, type BackupFile } from "./store";
import type { AppSettings, Person } from "../types";

const SettingsSchema = z.object({
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().min(2).max(20),
  myName: z.string().trim().min(1, "Enter your name").max(60),
  theme: z.enum(["dark", "light"]),
  categories: z
    .array(z.object({ name: z.string().trim().min(1, "Categories need a name").max(40), emoji: z.string().max(16), color: z.string().max(16) }))
    .min(1, "Keep at least one category"),
});

/** Partial update: anything left out keeps its current value. */
export function patchSettings(patch: unknown): AppSettings {
  const next = SettingsSchema.parse({ ...getSettings(), ...((patch as object) ?? {}) });
  const names = next.categories.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new UserError("Category names must be unique.");
  saveSettings(next);
  return next;
}

const NewPerson = z.object({ name: z.string().trim().min(1, "Enter a name").max(60), color: z.string().max(16).optional() });

export function addPerson(body: unknown): Person {
  const { name, color } = NewPerson.parse(body);
  const person = ensurePerson(name, color);
  if (color) updatePerson(person.id, { color });
  return { ...person, color: color ?? person.color };
}

const PersonPatch = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60).optional(),
  color: z.string().max(16).optional(),
  hidden: z.boolean().optional(),
});

export function editPerson(id: string, body: unknown) {
  updatePerson(id, PersonPatch.parse(body));
}

const Backup = z.looseObject({
  app: z.literal("mune-splits"),
  version: z.literal(1),
  people: z.array(
    z.looseObject({ id: z.string().min(1), name: z.string(), color: z.string(), isMe: z.boolean(), hidden: z.boolean(), createdAt: z.number() }),
  ),
  events: z.array(
    z.looseObject({
      id: z.string().min(1),
      name: z.string(),
      currency: z.string(),
      status: z.enum(["active", "settled", "archived"]),
      expenses: z.array(z.looseObject({ id: z.string(), amount: z.number().int() })),
      settlements: z.array(z.looseObject({ id: z.string(), amount: z.number().int() })),
    }),
  ),
});

export function parseBackup(body: unknown): BackupFile {
  const parsed = Backup.safeParse(body);
  if (!parsed.success) throw new UserError("That file isn't a MUNE Splits backup.");
  return parsed.data as unknown as BackupFile;
}
