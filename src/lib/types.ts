import type { Payer, SplitEntry, SplitMode } from "./splits";

export type EventStatus = "active" | "settled" | "archived";

export interface Person {
  id: string;
  name: string;
  color: string;
  /** The app's owner ("You"). Exactly one person has this. */
  isMe: boolean;
  /** Hidden from the quick-add list (kept because past events still reference them). */
  hidden: boolean;
  createdAt: number;
}

export interface EventBase {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  settledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: string;
  eventId: string;
  title: string;
  /** Minor units. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  category: string;
  payers: Payer[];
  mode: SplitMode;
  split: SplitEntry[];
  notes: string;
  /** File name under data/receipts, served from /api/receipts/<name>. */
  receipt: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Settlement {
  id: string;
  eventId: string;
  fromId: string;
  toId: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  createdAt: number;
}

export interface EventDetail extends EventBase {
  participants: Person[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface EventSummary extends EventBase {
  participants: Pick<Person, "id" | "name" | "color" | "isMe">[];
  total: number;
  expenseCount: number;
  /** The owner's net balance in this event (null if they're not in it). */
  myNet: number | null;
  /** Sum of outstanding simplified transfers. */
  outstanding: number;
  lastExpenseAt: number | null;
}

export interface Category {
  name: string;
  emoji: string;
  color: string;
}

export interface AppSettings {
  defaultCurrency: string;
  locale: string;
  myName: string;
  theme: "dark" | "light";
  categories: Category[];
}
