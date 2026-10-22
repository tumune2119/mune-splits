import { describe, expect, it } from "vitest";
import { planSharedAction } from "./actions";
import { toEventDetail, type SharedEventDoc } from "./model";
import { eventMath } from "../event-math";
import type { EventDetail } from "../types";

const base: SharedEventDoc = {
  v: 1,
  name: "Goa",
  description: "",
  emoji: "🏝️",
  color: "#FFB38A",
  currency: "INR",
  startDate: null,
  endDate: null,
  status: "active",
  settledAt: null,
  createdAt: 1,
  updatedAt: 1,
  people: [
    { id: "ana", name: "Ana", color: "#fff" },
    { id: "ben", name: "Ben", color: "#fff" },
  ],
};
const fresh = (me = "ana"): EventDetail => toEventDetail("sid-123456789012345678901", base, [], [], me);
let n = 0;
const opts = (me = "ana") => ({ me, now: 1000, newId: () => `id${++n}` });
const equal = (amount: number, payer: string) => ({
  title: "Dinner",
  amount,
  date: "2026-10-01",
  category: "Food",
  payers: [{ personId: payer, amount }],
  mode: "equal" as const,
  split: [
    { personId: "ana", value: 1 },
    { personId: "ben", value: 1 },
  ],
});

describe("shared events: planning edits", () => {
  it("marks which person this device is", () => {
    const e = fresh("ben");
    expect(e.participants.find((p) => p.isMe)?.name).toBe("Ben");
    expect(e.shared).toEqual({ sid: "sid-123456789012345678901", me: "ben" });
  });

  it("adding an expense writes one expense doc, records who added it, and only touches the event doc", () => {
    const { next, writes } = planSharedAction(fresh(), { type: "add-expense", expense: equal(5000, "ana") }, opts());
    expect(writes.map((w) => w.kind)).toEqual(["touch-event", "set-expense"]);
    const x = writes[1];
    expect(x.kind === "set-expense" && x.data.by).toBe("ana");
    expect(eventMath(next).balanceOf("ana").net).toBe(2500);
  });

  it("the 5k / 2k example settles to one transfer, with two people adding from their own devices", () => {
    const a = planSharedAction(fresh("ana"), { type: "add-expense", expense: equal(500000, "ana") }, opts("ana")).next;
    const b = planSharedAction(a, { type: "add-expense", expense: equal(200000, "ben") }, opts("ben")).next;
    expect(eventMath(b).transfers).toEqual([{ fromId: "ben", toId: "ana", amount: 150000 }]);
  });

  it("validates exactly like the local app", () => {
    expect(() => planSharedAction(fresh(), { type: "add-expense", expense: { ...equal(1000, "ana"), mode: "exact", split: [{ personId: "ana", value: 300 }] } }, opts())).toThrow(/less than the total/);
    expect(() => planSharedAction(fresh(), { type: "add-expense", expense: equal(1000, "zed") }, opts())).toThrow(/must be in the event/);
    expect(() => planSharedAction(fresh(), { type: "set-status", status: "settled" }, opts())).not.toThrow();
  });

  it("people changes rewrite the event doc; duplicates and removing someone with expenses are refused", () => {
    const { next, writes } = planSharedAction(fresh(), { type: "add-participant", name: "Cara" }, opts());
    expect(writes[0].kind).toBe("set-event");
    expect(next.participants.map((p) => p.name)).toEqual(["Ana", "Ben", "Cara"]);
    expect(() => planSharedAction(next, { type: "add-participant", name: "cara" }, opts())).toThrow(/already in/);
    const withDinner = planSharedAction(fresh(), { type: "add-expense", expense: equal(1000, "ana") }, opts()).next;
    expect(() => planSharedAction(withDinner, { type: "remove-participant", personId: "ben" }, opts())).toThrow(/part of expenses/);
  });

  it("settled events are read-only until reopened", () => {
    const settled = planSharedAction(fresh(), { type: "set-status", status: "settled" }, opts()).next;
    expect(() => planSharedAction(settled, { type: "add-expense", expense: equal(100, "ana") }, opts())).toThrow(/read-only/);
    expect(planSharedAction(settled, { type: "set-status", status: "active" }, opts()).next.status).toBe("active");
  });

  it("editing an expense someone else deleted explains what happened", () => {
    expect(() => planSharedAction(fresh(), { type: "update-expense", id: "gone", expense: equal(100, "ana") }, opts())).toThrow(/deleted by someone else/);
  });

  it("payments record who marked them", () => {
    const { writes } = planSharedAction(fresh("ben"), { type: "add-settlement", fromId: "ben", toId: "ana", amount: 500 }, opts("ben"));
    const s = writes[1];
    expect(s.kind === "set-settlement" && s.data.by).toBe("ben");
  });
});
