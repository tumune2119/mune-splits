import { z } from "zod";

const Id = z.string().min(1).max(64);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const Minor = z.number().int();

export const EventFields = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  description: z.string().max(2000).default(""),
  emoji: z.string().max(16).default(""),
  color: z.string().max(16).default(""),
  currency: z.string().regex(/^[A-Z]{3}$/),
  startDate: DateStr.nullable().default(null),
  endDate: DateStr.nullable().default(null),
});
export type EventFields = z.infer<typeof EventFields>;

export const NewEventSchema = EventFields.extend({
  /** People ids to add; the owner is always included. */
  personIds: z.array(Id).default([]),
  /** New people to create and add, by name. */
  newPeople: z.array(z.string().trim().min(1).max(60)).default([]),
});
export type NewEvent = z.input<typeof NewEventSchema>;

export const ExpenseFields = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  amount: Minor.positive("Enter an amount greater than zero"),
  date: DateStr,
  category: z.string().trim().min(1).max(40),
  payers: z.array(z.object({ personId: Id, amount: Minor.nonnegative() })).min(1),
  mode: z.enum(["equal", "shares", "exact", "percent"]),
  split: z.array(z.object({ personId: Id, value: z.number().nonnegative().finite() })),
  notes: z.string().max(4000).default(""),
  receipt: z.string().max(120).nullable().default(null),
});
export type ExpenseFields = z.input<typeof ExpenseFields>;

export const EventActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update"), fields: EventFields.partial() }),
  z.object({ type: z.literal("add-participant"), personId: Id.optional(), name: z.string().trim().min(1).max(60).optional() }),
  z.object({ type: z.literal("remove-participant"), personId: Id }),
  z.object({ type: z.literal("add-expense"), expense: ExpenseFields }),
  z.object({ type: z.literal("update-expense"), id: Id, expense: ExpenseFields }),
  z.object({ type: z.literal("delete-expense"), id: Id }),
  z.object({ type: z.literal("restore-expense"), expense: ExpenseFields.extend({ id: Id, createdAt: z.number() }) }),
  z.object({
    type: z.literal("add-settlement"),
    fromId: Id,
    toId: Id,
    amount: Minor.positive("Enter an amount greater than zero"),
    date: DateStr.optional(),
    note: z.string().max(500).default(""),
  }),
  z.object({ type: z.literal("delete-settlement"), id: Id }),
  z.object({ type: z.literal("set-status"), status: z.enum(["active", "settled", "archived"]) }),
]);
export type EventAction = z.input<typeof EventActionSchema>;
