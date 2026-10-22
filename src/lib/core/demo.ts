import { applyEventAction, createEvent, ensurePerson } from "./store";
import type { ExpenseFields } from "../event-actions";

/**
 * "Goa Trip": 4 people with weighted splits (Priya counts as 2, Rohan as 0.5 for food), a multi-payer
 * villa, every split mode, and one partial settlement. Amounts are in paise.
 */
export function createDemoTrip(): string {
  const aarav = ensurePerson("Aarav").id;
  const priya = ensurePerson("Priya").id;
  const rohan = ensurePerson("Rohan").id;
  const me = "me";
  const event = createEvent({
    name: "Goa Trip",
    description: "Long weekend in North Goa. Priya brought her partner, so she counts as 2 on shared stuff.",
    emoji: "🏝️",
    color: "#FFB38A",
    currency: "INR",
    startDate: "2026-09-12",
    endDate: "2026-09-16",
    personIds: [aarav, priya, rohan],
  });
  const rs = (n: number) => Math.round(n * 100);
  const all = [me, aarav, priya, rohan];

  const expenses: ExpenseFields[] = [
    {
      title: "Villa in Anjuna (4 nights)",
      amount: rs(30000),
      date: "2026-09-12",
      category: "Stay",
      payers: [
        { personId: me, amount: rs(18000) },
        { personId: aarav, amount: rs(12000) },
      ],
      mode: "shares",
      split: [
        { personId: me, value: 1 },
        { personId: aarav, value: 1 },
        { personId: priya, value: 2 },
        { personId: rohan, value: 1 },
      ],
      notes: "Booked together: I paid the deposit, Aarav paid the rest at check-in.",
    },
    {
      title: "Airport cab",
      amount: rs(2400),
      date: "2026-09-12",
      category: "Travel",
      payers: [{ personId: aarav, amount: rs(2400) }],
      mode: "equal",
      split: all.map((personId) => ({ personId, value: 1 })),
    },
    {
      title: "Seafood dinner at Britto's",
      amount: rs(6400),
      date: "2026-09-13",
      category: "Food",
      payers: [{ personId: priya, amount: rs(6400) }],
      mode: "shares",
      split: [
        { personId: me, value: 1 },
        { personId: aarav, value: 1 },
        { personId: priya, value: 2 },
        { personId: rohan, value: 0.5 },
      ],
      notes: "Rohan only had a starter.",
    },
    {
      title: "Scooter rentals",
      amount: rs(3600),
      date: "2026-09-13",
      category: "Travel",
      payers: [{ personId: rohan, amount: rs(3600) }],
      mode: "equal",
      split: [me, aarav, rohan].map((personId) => ({ personId, value: 1 })),
      notes: "Priya took cabs instead.",
    },
    {
      title: "Parasailing at Calangute",
      amount: rs(10000),
      date: "2026-09-14",
      category: "Activities",
      payers: [{ personId: me, amount: rs(10000) }],
      mode: "exact",
      split: [
        { personId: me, value: rs(2500) },
        { personId: aarav, value: rs(2500) },
        { personId: priya, value: rs(5000) },
      ],
    },
    {
      title: "Sunset drinks at the shack",
      amount: rs(4250),
      date: "2026-09-14",
      category: "Drinks",
      payers: [{ personId: aarav, amount: rs(4250) }],
      mode: "percent",
      split: [
        { personId: me, value: 30 },
        { personId: aarav, value: 30 },
        { personId: priya, value: 25 },
        { personId: rohan, value: 15 },
      ],
    },
    {
      title: "Groceries & breakfast stuff",
      amount: rs(1875.5),
      date: "2026-09-15",
      category: "Food",
      payers: [{ personId: me, amount: rs(1875.5) }],
      mode: "shares",
      split: [
        { personId: me, value: 1 },
        { personId: aarav, value: 1 },
        { personId: priya, value: 2 },
        { personId: rohan, value: 0.5 },
      ],
    },
    {
      title: "Cashew feni & souvenirs",
      amount: rs(1200),
      date: "2026-09-16",
      category: "Shopping",
      payers: [{ personId: priya, amount: rs(1200) }],
      mode: "exact",
      split: [
        { personId: me, value: rs(400) },
        { personId: rohan, value: rs(800) },
      ],
    },
  ];

  for (const expense of expenses) applyEventAction(event.id, { type: "add-expense", expense });
  applyEventAction(event.id, {
    type: "add-settlement",
    fromId: rohan,
    toId: me,
    amount: rs(3000),
    date: "2026-09-17",
    note: "UPI, part payment",
  });
  return event.id;
}
