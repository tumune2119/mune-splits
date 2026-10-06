import { describe, expect, it } from "vitest";
import {
  allocate,
  computeBalances,
  computeShares,
  isAllSettled,
  pairwiseDebts,
  previewShares,
  simplifyDebts,
  validateExpense,
  type ExpenseInput,
  type SettlementInput,
} from "./splits";
import { formatMoney, minorDigits, parseAmount } from "./money";

const shares = (e: ExpenseInput) => Object.fromEntries(computeShares(e));
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const equal = (amount: number, payer: string, people: string[]): ExpenseInput => ({
  amount,
  payers: [{ personId: payer, amount }],
  mode: "equal",
  split: people.map((personId) => ({ personId, value: 1 })),
});
const net = (people: string[], expenses: ExpenseInput[], settlements: SettlementInput[] = []) =>
  Object.fromEntries(computeBalances(people, expenses, settlements).map((b) => [b.personId, b.net]));

describe("allocate (largest remainder)", () => {
  it("splits evenly when it divides", () => {
    expect(allocate(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it("hands leftover units to the largest remainders, ties by order", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(200, [1, 1, 1])).toEqual([67, 67, 66]);
  });

  it("always sums exactly to the total", () => {
    for (const total of [1, 7, 99, 1001, 123457, 999999]) {
      for (const w of [[1, 1, 1], [2, 0.5, 1.5], [0.3, 0.3, 0.4], [1, 2, 3, 4, 5, 6, 7], [0.5]]) {
        const parts = allocate(total, w);
        expect(sum(parts)).toBe(total);
        expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
      }
    }
  });

  it("gives zero to zero weights", () => {
    expect(allocate(1000, [1, 0, 1])).toEqual([500, 0, 500]);
  });

  it("handles negative totals symmetrically", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("rejects all-zero weights for a non-zero total", () => {
    expect(() => allocate(100, [0, 0])).toThrow();
  });
});

describe("split modes", () => {
  it("equal", () => {
    expect(shares(equal(120000, "a", ["a", "b", "c", "d"]))).toEqual({ a: 30000, b: 30000, c: 30000, d: 30000 });
  });

  it("equal with a remainder", () => {
    const s = shares(equal(1000, "a", ["a", "b", "c"]));
    expect(s).toEqual({ a: 334, b: 333, c: 333 });
  });

  it("weighted shares with decimals (2, 0.5, 1, 1.5)", () => {
    // weights sum 5 → ₹1000 per unit of weight
    const e: ExpenseInput = {
      amount: 500000,
      payers: [{ personId: "you", amount: 500000 }],
      mode: "shares",
      split: [
        { personId: "sam", value: 2 },
        { personId: "lee", value: 0.5 },
        { personId: "you", value: 1 },
        { personId: "kim", value: 1.5 },
      ],
    };
    expect(shares(e)).toEqual({ sam: 200000, lee: 50000, you: 100000, kim: 150000 });
  });

  it("weight 0 excludes a person", () => {
    const e: ExpenseInput = {
      amount: 10000,
      payers: [{ personId: "a", amount: 10000 }],
      mode: "shares",
      split: [
        { personId: "a", value: 1 },
        { personId: "b", value: 0 },
        { personId: "c", value: 1 },
      ],
    };
    expect(shares(e)).toEqual({ a: 5000, c: 5000 });
  });

  it("weighted shares with an awkward remainder still add up", () => {
    const e: ExpenseInput = {
      amount: 100001,
      payers: [{ personId: "a", amount: 100001 }],
      mode: "shares",
      split: [
        { personId: "a", value: 0.5 },
        { personId: "b", value: 1.5 },
        { personId: "c", value: 2 },
      ],
    };
    const s = computeShares(e);
    expect(sum([...s.values()])).toBe(100001);
    // 100001 × 0.5/4 = 12500.125, × 1.5/4 = 37500.375, × 2/4 = 50000.5 → the extra unit goes to c (.5)
    expect(Object.fromEntries(s)).toEqual({ a: 12500, b: 37500, c: 50001 });
  });

  it("exact amounts", () => {
    const e: ExpenseInput = {
      amount: 10000,
      payers: [{ personId: "a", amount: 10000 }],
      mode: "exact",
      split: [
        { personId: "a", value: 2500 },
        { personId: "b", value: 7500 },
      ],
    };
    expect(shares(e)).toEqual({ a: 2500, b: 7500 });
  });

  it("exact amounts must add up to the total", () => {
    const e: ExpenseInput = {
      amount: 10000,
      payers: [{ personId: "a", amount: 10000 }],
      mode: "exact",
      split: [
        { personId: "a", value: 2500 },
        { personId: "b", value: 7000 },
      ],
    };
    expect(validateExpense(e)).toMatch(/less than the total/);
    expect(() => computeShares(e)).toThrow();
  });

  it("percentages", () => {
    const e: ExpenseInput = {
      amount: 20000,
      payers: [{ personId: "a", amount: 20000 }],
      mode: "percent",
      split: [
        { personId: "a", value: 50 },
        { personId: "b", value: 30 },
        { personId: "c", value: 20 },
      ],
    };
    expect(shares(e)).toEqual({ a: 10000, b: 6000, c: 4000 });
  });

  it("percentages must total 100", () => {
    const e: ExpenseInput = {
      amount: 20000,
      payers: [{ personId: "a", amount: 20000 }],
      mode: "percent",
      split: [
        { personId: "a", value: 50 },
        { personId: "b", value: 40 },
      ],
    };
    expect(validateExpense(e)).toMatch(/100%/);
  });

  it("thirds in percent (33.33 × 3) are accepted and add up", () => {
    const e: ExpenseInput = {
      amount: 10000,
      payers: [{ personId: "a", amount: 10000 }],
      mode: "percent",
      split: [
        { personId: "a", value: 33.34 },
        { personId: "b", value: 33.33 },
        { personId: "c", value: 33.33 },
      ],
    };
    expect(validateExpense(e)).toBeNull();
    expect(sum([...computeShares(e).values()])).toBe(10000);
  });

  it("rejects payer totals that don't match", () => {
    const e = equal(1000, "a", ["a", "b"]);
    e.payers = [{ personId: "a", amount: 900 }];
    expect(validateExpense(e)).toMatch(/less than the total/);
  });
});

describe("balances", () => {
  it("net = paid − share + sent − received, and sums to zero", () => {
    const e = equal(90000, "a", ["a", "b", "c"]);
    const b = computeBalances(["a", "b", "c"], [e], [{ fromId: "b", toId: "a", amount: 10000 }]);
    const a = b.find((x) => x.personId === "a")!;
    const bb = b.find((x) => x.personId === "b")!;
    expect(a).toMatchObject({ paid: 90000, share: 30000, received: 10000, net: 50000 });
    expect(bb).toMatchObject({ paid: 0, share: 30000, sent: 10000, net: -20000 });
    expect(sum(b.map((x) => x.net))).toBe(0);
  });

  it("multiple payers on one expense", () => {
    // Hotel ₹30,000: you paid 18,000, Aarav 12,000. Split equally across 3.
    const e: ExpenseInput = {
      amount: 3000000,
      payers: [
        { personId: "you", amount: 1800000 },
        { personId: "aarav", amount: 1200000 },
      ],
      mode: "equal",
      split: ["you", "aarav", "priya"].map((personId) => ({ personId, value: 1 })),
    };
    expect(net(["you", "aarav", "priya"], [e])).toEqual({ you: 800000, aarav: 200000, priya: -1000000 });
    expect(simplifyDebts(computeBalances(["you", "aarav", "priya"], [e], []))).toEqual([
      { fromId: "priya", toId: "you", amount: 800000 },
      { fromId: "priya", toId: "aarav", amount: 200000 },
    ]);
  });

  it("people with no activity are included with zero", () => {
    expect(net(["a", "b", "z"], [equal(100, "a", ["a", "b"])])).toEqual({ a: 50, b: -50, z: 0 });
  });
});

describe("simplify debts", () => {
  it("the 5k / 2k example: one transfer, not two opposite debts", () => {
    const people = ["you", "friend"];
    const expenses = [equal(500000, "you", people), equal(200000, "friend", people)];
    const balances = computeBalances(people, expenses, []);
    expect(Object.fromEntries(balances.map((b) => [b.personId, b.net]))).toEqual({ you: 150000, friend: -150000 });
    expect(simplifyDebts(balances)).toEqual([{ fromId: "friend", toId: "you", amount: 150000 }]);
  });

  it("collapses a chain A→B→C into A→C", () => {
    // A owes B 10, B owes C 10 → A pays C 10.
    expect(
      simplifyDebts([
        { personId: "A", net: -1000 },
        { personId: "B", net: 0 },
        { personId: "C", net: 1000 },
      ]),
    ).toEqual([{ fromId: "A", toId: "C", amount: 1000 }]);
  });

  it("matches largest creditor with largest debtor and uses at most n−1 transfers", () => {
    const t = simplifyDebts([
      { personId: "a", net: 5000 },
      { personId: "b", net: 3000 },
      { personId: "c", net: -6000 },
      { personId: "d", net: -2000 },
    ]);
    expect(t[0]).toEqual({ fromId: "c", toId: "a", amount: 5000 });
    expect(t.length).toBeLessThanOrEqual(3);
    // applying the transfers zeroes everyone
    const after = { a: 5000, b: 3000, c: -6000, d: -2000 } as Record<string, number>;
    for (const x of t) {
      after[x.fromId] += x.amount;
      after[x.toId] -= x.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it("returns nothing when everyone is even", () => {
    expect(simplifyDebts([{ personId: "a", net: 0 }, { personId: "b", net: 0 }])).toEqual([]);
  });
});

describe("pairwise (raw) debts", () => {
  it("nets debts in both directions per pair", () => {
    const people = ["you", "friend"];
    const expenses = [equal(500000, "you", people), equal(200000, "friend", people)];
    expect(pairwiseDebts(expenses, [], people)).toEqual([{ fromId: "friend", toId: "you", amount: 150000 }]);
  });

  it("keeps the chain unsimplified", () => {
    const expenses = [equal(2000, "B", ["A", "B"]), equal(2000, "C", ["B", "C"])];
    expect(pairwiseDebts(expenses, [], ["A", "B", "C"])).toEqual([
      { fromId: "A", toId: "B", amount: 1000 },
      { fromId: "B", toId: "C", amount: 1000 },
    ]);
  });

  it("splits a debtor's share across multiple payers by what they paid", () => {
    const e: ExpenseInput = {
      amount: 3000,
      payers: [
        { personId: "a", amount: 2000 },
        { personId: "b", amount: 1000 },
      ],
      mode: "equal",
      split: [{ personId: "c", value: 1 }],
    };
    expect(pairwiseDebts([e], [], ["a", "b", "c"])).toEqual([
      { fromId: "c", toId: "a", amount: 2000 },
      { fromId: "c", toId: "b", amount: 1000 },
    ]);
  });

  it("settlements reduce the matching pair", () => {
    const people = ["a", "b"];
    expect(pairwiseDebts([equal(1000, "a", people)], [{ fromId: "b", toId: "a", amount: 200 }], people)).toEqual([
      { fromId: "b", toId: "a", amount: 300 },
    ]);
  });
});

describe("settling up", () => {
  const people = ["you", "alex", "sam"];
  const expenses = [equal(90000, "you", people)];

  it("partial settlement leaves the remainder outstanding", () => {
    const settlements = [{ fromId: "alex", toId: "you", amount: 10000 }];
    const balances = computeBalances(people, expenses, settlements);
    expect(Object.fromEntries(balances.map((b) => [b.personId, b.net]))).toEqual({ you: 50000, alex: -20000, sam: -30000 });
    expect(simplifyDebts(balances)).toEqual([
      { fromId: "sam", toId: "you", amount: 30000 },
      { fromId: "alex", toId: "you", amount: 20000 },
    ]);
    expect(isAllSettled(balances)).toBe(false);
  });

  it("paying every suggested transfer settles the group", () => {
    const transfers = simplifyDebts(computeBalances(people, expenses, []));
    const after = computeBalances(people, expenses, transfers);
    expect(isAllSettled(after)).toBe(true);
    expect(simplifyDebts(after)).toEqual([]);
  });

  it("overpaying flips the direction", () => {
    const balances = computeBalances(["a", "b"], [equal(1000, "a", ["a", "b"])], [{ fromId: "b", toId: "a", amount: 700 }]);
    expect(simplifyDebts(balances)).toEqual([{ fromId: "a", toId: "b", amount: 200 }]);
  });
});

describe("demo-style scenario: weights, multi-payer, partial settlement", () => {
  it("everything reconciles", () => {
    const people = ["you", "aarav", "priya", "rohan"];
    const expenses: ExpenseInput[] = [
      {
        amount: 3000000,
        payers: [
          { personId: "you", amount: 1800000 },
          { personId: "aarav", amount: 1200000 },
        ],
        mode: "shares",
        split: [
          { personId: "you", value: 1 },
          { personId: "aarav", value: 1 },
          { personId: "priya", value: 2 },
          { personId: "rohan", value: 1 },
        ],
      },
      {
        amount: 640000,
        payers: [{ personId: "priya", amount: 640000 }],
        mode: "shares",
        split: [
          { personId: "you", value: 1 },
          { personId: "aarav", value: 1 },
          { personId: "priya", value: 2 },
          { personId: "rohan", value: 0.5 },
        ],
      },
    ];
    const settlements = [{ fromId: "rohan", toId: "you", amount: 300000 }];
    const balances = computeBalances(people, expenses, settlements);
    expect(sum(balances.map((b) => b.net))).toBe(0);
    expect(sum(balances.map((b) => b.share))).toBe(3640000);
    const transfers = simplifyDebts(balances);
    const settled = computeBalances(people, expenses, [...settlements, ...transfers]);
    expect(isAllSettled(settled)).toBe(true);
  });
});

describe("previewShares", () => {
  it("shows live amounts for weights without throwing on bad input", () => {
    const p = previewShares(10000, "shares", [
      { personId: "a", value: 2 },
      { personId: "b", value: 0.5 },
      { personId: "c", value: 0 },
    ]);
    expect(Object.fromEntries(p)).toEqual({ a: 8000, b: 2000 });
    expect(previewShares(0, "equal", [{ personId: "a", value: 1 }]).size).toBe(0);
    expect(previewShares(100, "shares", [{ personId: "a", value: 0 }]).size).toBe(0);
  });
});

describe("money helpers", () => {
  it("knows minor digits per currency", () => {
    expect(minorDigits("INR")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
  });

  it("parses typed amounts into minor units", () => {
    expect(parseAmount("1,500.50", "INR")).toBe(150050);
    expect(parseAmount("0.1", "INR")).toBe(10);
    expect(parseAmount("19.99", "USD")).toBe(1999);
    expect(parseAmount("1200", "JPY")).toBe(1200);
    expect(parseAmount("abc", "INR")).toBeNull();
    expect(parseAmount("", "INR")).toBeNull();
  });

  it("formats with Indian grouping and drops .00 on whole amounts", () => {
    expect(formatMoney(150000, "INR", "en-IN")).toBe("₹1,500");
    expect(formatMoney(15000050, "INR", "en-IN")).toBe("₹1,50,000.50");
  });
});
