/**
 * MUNE Splits engine: who owes what, and the fewest payments to settle it.
 *
 * Pure and framework-free. All money is integer minor units (paise/cents) so totals always add up
 * exactly; anything that has to be divided goes through `allocate` (largest-remainder method).
 */

export type Minor = number;
export type PersonId = string;

export type SplitMode = "equal" | "shares" | "exact" | "percent";

/**
 * How one person takes part in an expense's split. The meaning of `value` depends on the mode:
 * - equal:   ignored (anyone listed shares equally)
 * - shares:  weight for this expense (1 = one person, 2 = two people, 0.5 = half portion, 0 = excluded)
 * - exact:   amount in minor units
 * - percent: percentage of the total (all entries sum to 100)
 */
export interface SplitEntry {
  personId: PersonId;
  value: number;
}

export interface Payer {
  personId: PersonId;
  amount: Minor;
}

export interface ExpenseInput {
  amount: Minor;
  payers: Payer[];
  mode: SplitMode;
  split: SplitEntry[];
}

export interface SettlementInput {
  fromId: PersonId;
  toId: PersonId;
  amount: Minor;
}

export interface Balance {
  personId: PersonId;
  /** Total this person paid for expenses. */
  paid: Minor;
  /** Total of this person's shares of expenses. */
  share: Minor;
  /** Settlement payments this person made. */
  sent: Minor;
  /** Settlement payments this person received. */
  received: Minor;
  /** Positive: is owed money. Negative: owes money. */
  net: Minor;
}

export interface Transfer {
  fromId: PersonId;
  toId: PersonId;
  amount: Minor;
}

/** Percent totals within this tolerance of 100 count as 100 (e.g. three × 33.333…). */
const PERCENT_EPSILON = 0.01;

/**
 * Splits `total` in proportion to `weights` so the parts are integers that sum exactly to `total`.
 * Each part gets the floor of its exact share; the leftover units go to the largest fractional
 * remainders, ties broken by input order, so the result is deterministic.
 */
export function allocate(total: Minor, weights: number[]): Minor[] {
  if (!Number.isInteger(total)) throw new Error("allocate: total must be an integer number of minor units");
  const sum = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0);
  if (weights.length === 0 || sum <= 0) {
    if (total === 0) return weights.map(() => 0);
    throw new Error("allocate: need at least one positive weight");
  }
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = weights.map((w) => (w > 0 ? (abs * w) / sum : 0));
  const parts = exact.map((x) => Math.floor(x));
  let left = abs - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x), w: weights[i] }))
    .filter((o) => o.w > 0)
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k].i] += 1;
  return parts.map((p) => p * sign || 0);
}

/** Returns a human-readable problem with the expense, or null if it can be saved. */
export function validateExpense(e: ExpenseInput): string | null {
  if (!Number.isInteger(e.amount) || e.amount <= 0) return "Enter an amount greater than zero.";
  if (e.payers.length === 0) return "Choose who paid.";
  if (e.payers.some((p) => !Number.isInteger(p.amount) || p.amount < 0)) return "Payer amounts can't be negative.";
  const paid = e.payers.reduce((s, p) => s + p.amount, 0);
  if (paid !== e.amount) {
    return paid < e.amount ? "Payers' amounts are less than the total." : "Payers' amounts are more than the total.";
  }
  if (new Set(e.payers.map((p) => p.personId)).size !== e.payers.length) return "A payer is listed twice.";
  if (new Set(e.split.map((s) => s.personId)).size !== e.split.length) return "A person is listed twice in the split.";
  if (e.split.some((s) => !Number.isFinite(s.value) || s.value < 0)) return "Split values can't be negative.";

  switch (e.mode) {
    case "equal":
      if (e.split.length === 0) return "Choose at least one person to split with.";
      return null;
    case "shares":
      if (!e.split.some((s) => s.value > 0)) return "Give at least one person a share above zero.";
      return null;
    case "exact": {
      if (e.split.some((s) => !Number.isInteger(s.value))) return "Exact amounts must be whole minor units.";
      const sum = e.split.reduce((s, x) => s + x.value, 0);
      if (sum !== e.amount) return sum < e.amount ? "The amounts add up to less than the total." : "The amounts add up to more than the total.";
      return null;
    }
    case "percent": {
      const sum = e.split.reduce((s, x) => s + x.value, 0);
      if (Math.abs(sum - 100) > PERCENT_EPSILON) return "Percentages must add up to 100%.";
      return null;
    }
  }
}

/** Each participant's share of one expense (minor units). People with a zero share are omitted. */
export function computeShares(e: ExpenseInput): Map<PersonId, Minor> {
  const problem = validateExpense(e);
  if (problem) throw new Error(problem);
  let parts: Minor[];
  switch (e.mode) {
    case "equal":
      parts = allocate(e.amount, e.split.map(() => 1));
      break;
    case "shares":
    case "percent":
      parts = allocate(e.amount, e.split.map((s) => s.value));
      break;
    case "exact":
      parts = e.split.map((s) => s.value);
      break;
  }
  const out = new Map<PersonId, Minor>();
  e.split.forEach((s, i) => {
    if (parts[i] !== 0) out.set(s.personId, (out.get(s.personId) ?? 0) + parts[i]);
  });
  return out;
}

/**
 * Live preview for the expense form: each person's share even while the split is still incomplete
 * (e.g. exact amounts that don't add up yet). Never throws.
 */
export function previewShares(amount: Minor, mode: SplitMode, split: SplitEntry[]): Map<PersonId, Minor> {
  const out = new Map<PersonId, Minor>();
  if (!Number.isInteger(amount) || amount <= 0) return out;
  try {
    if (mode === "exact") {
      for (const s of split) if (s.value > 0) out.set(s.personId, Math.round(s.value));
      return out;
    }
    const weights = mode === "equal" ? split.map(() => 1) : split.map((s) => Math.max(0, s.value));
    if (mode === "percent") {
      // Show what each percentage is worth, without normalising an incomplete total.
      split.forEach((s) => s.value > 0 && out.set(s.personId, Math.round((amount * s.value) / 100)));
      return out;
    }
    if (!weights.some((w) => w > 0)) return out;
    allocate(amount, weights).forEach((p, i) => p && out.set(split[i].personId, p));
  } catch {
    // incomplete input: show nothing
  }
  return out;
}

/** Per-person totals and net balance for a group. */
export function computeBalances(
  people: PersonId[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[],
): Balance[] {
  const map = new Map<PersonId, Balance>();
  const get = (id: PersonId) => {
    let b = map.get(id);
    if (!b) {
      b = { personId: id, paid: 0, share: 0, sent: 0, received: 0, net: 0 };
      map.set(id, b);
    }
    return b;
  };
  people.forEach(get);
  for (const e of expenses) {
    for (const p of e.payers) get(p.personId).paid += p.amount;
    for (const [id, s] of computeShares(e)) get(id).share += s;
  }
  for (const s of settlements) {
    get(s.fromId).sent += s.amount;
    get(s.toId).received += s.amount;
  }
  for (const b of map.values()) b.net = b.paid - b.share + b.sent - b.received;
  return [...map.values()];
}

/**
 * Turns net balances into the fewest transfers: repeatedly match the largest creditor with the
 * largest debtor. Ties are broken by the order of `balances`, so the output is stable.
 */
export function simplifyDebts(balances: Pick<Balance, "personId" | "net">[]): Transfer[] {
  const order = new Map(balances.map((b, i) => [b.personId, i]));
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.personId, amt: b.net }));
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.personId, amt: -b.net }));
  const byLargest = (a: { id: string; amt: number }, b: { id: string; amt: number }) =>
    b.amt - a.amt || order.get(a.id)! - order.get(b.id)!;

  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byLargest);
    debtors.sort(byLargest);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.amt, d.amt);
    out.push({ fromId: d.id, toId: c.id, amount });
    c.amt -= amount;
    d.amt -= amount;
    if (c.amt === 0) creditors.shift();
    if (d.amt === 0) debtors.shift();
  }
  return out;
}

/**
 * The unsimplified view: who owes whom directly, from each expense (a person's share is owed to the
 * payers in proportion to what they paid), less settlements between the same two people. Debts in
 * both directions between a pair are netted, so each pair appears at most once.
 */
export function pairwiseDebts(
  expenses: ExpenseInput[],
  settlements: SettlementInput[],
  order: PersonId[] = [],
): Transfer[] {
  // owed[a|b] > 0 means a owes b. Stored once per unordered pair.
  const owed = new Map<string, number>();
  const rank = (id: PersonId) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const key = (a: PersonId, b: PersonId) => (rank(a) < rank(b) || (rank(a) === rank(b) && a < b) ? [a, b, 1] : [b, a, -1]) as [string, string, number];
  const add = (from: PersonId, to: PersonId, amount: Minor) => {
    if (from === to || amount === 0) return;
    const [a, b, sign] = key(from, to);
    const k = `${a}\u0000${b}`;
    owed.set(k, (owed.get(k) ?? 0) + sign * amount);
  };

  for (const e of expenses) {
    const payers = e.payers.filter((p) => p.amount > 0);
    for (const [debtor, share] of computeShares(e)) {
      allocate(share, payers.map((p) => p.amount)).forEach((part, i) => add(debtor, payers[i].personId, part));
    }
  }
  for (const s of settlements) add(s.toId, s.fromId, s.amount); // a payment cancels debt in the other direction

  const out: Transfer[] = [];
  for (const [k, v] of owed) {
    if (v === 0) continue;
    const [a, b] = k.split("\u0000");
    out.push(v > 0 ? { fromId: a, toId: b, amount: v } : { fromId: b, toId: a, amount: -v });
  }
  return out.sort((x, y) => y.amount - x.amount || rank(x.fromId) - rank(y.fromId) || rank(x.toId) - rank(y.toId));
}

/** True when every balance is exactly zero. */
export function isAllSettled(balances: Pick<Balance, "net">[]): boolean {
  return balances.every((b) => b.net === 0);
}
