# Build: MUNE Splits — a local-first expense splitter

Build a local-first, personal-use web app called **MUNE Splits**, a sibling to my existing app **Mune Tasks**. It works like Splitwise / KittySplit: I create an event or trip, add the people involved, log who paid for what, and the app works out who owes whom. It should use the fewest possible payments to settle everyone up.

Install and run it the same way as Mune Tasks. If you can't see that project, use the defaults in the "Install & run" section below.

---

## 1. Core concepts

- **Event / Trip**: name, optional description, date range, currency (set per event, with a default chosen in Settings), cover emoji or colour tag, status (`Active` / `Settled` / `Archived`).
- **Participants**: people in an event. Just a name, plus an optional colour or initials avatar. No accounts or logins. These are labels I manage myself. Keep a reusable "People" list so I can add frequent friends to a new event in one click.
- **Expense**: title, amount, date, category (Food, Travel, Stay, Activities, Shopping, Drinks, Other; editable), **paid by** (one person, or several people with an amount each), **split between** (some or all participants), notes, and an optional receipt image stored locally.
- **Settlement / Payment**: a record that person A paid person B some amount. It reduces their balances.

## 2. Splitting logic (the most important part, so get this right)

Each expense supports these split modes:

1. **Equal**: everyone selected shares it equally.
2. **Weighted shares (counts)**: each person has a weight for *this expense only*. The default is `1`. I can set any positive decimal: `2` (counts as two people, e.g. someone with their partner), `0.5` (half portion, e.g. a kid or someone who only had a little), `1.5`, `3`, and so on. Weight `0` excludes the person. Each person's share is `amount × weight / sum(weights)`.
   - The UI shows a small stepper or input next to each person, with quick chips: `½`, `1`, `2`, plus custom.
   - Show each person's computed amount live as weights change.
3. **Exact amounts**: enter each person's amount. Show the remaining amount and block saving until it adds up to the total.
4. **Percentages**: must total 100%.

Rules:
- Store money as **integer minor units** (cents/paise) to avoid floating-point errors. Spread rounding remainders deterministically (largest-remainder method) so shares always add up exactly to the total.
- Support **multiple payers** on one expense.
- **Net balance** per person = total paid − total share + settlements sent − settlements received.
- **Simplify debts**: turn net balances into the minimum set of transfers with a greedy algorithm that matches the largest creditor with the largest debtor. Example: I paid 5,000 and a friend paid 2,000 on shared costs, so the app shows a single transfer that balances us out, not two opposite debts.
- Include a toggle to show the "raw" pairwise debts instead of the simplified ones.
- Write **unit tests** for the split and settle engine: equal, weighted with decimals (0.5/2/1.5), exact, percentage, multi-payer, rounding remainders, partial settlements, and the 5k/2k example.

## 3. Settling up

- An event's "Settle up" view lists the suggested transfers ("Alex pays You ₹1,500").
- Each transfer has a **Mark as paid** button. It creates a settlement record with a timestamp, and the balances update.
- Support partial payments, and undoing a settlement.
- When everyone is at zero, the event can be marked **Settled**. It gets a settled badge and date and becomes read-only (it can be reopened).
- Event list filters: Active / Settled / Archived / All.

## 4. PDF / print export (to send to friends)

- An **Export PDF** button on each event generates a clean, shareable report:
  - MUNE Splits header with logo, event name, dates, currency, generated-on date.
  - Summary cards: total spent, per-person spent, per-person share, net balance.
  - **Who owes whom**: final simplified transfers, with paid/unpaid status.
  - Full expense table: date, title, category, paid by, amount, split mode, and each person's share. Show weights where they apply, e.g. "Sam ×2, Lee ×0.5".
  - Category breakdown, with a small chart if feasible.
  - Settlement history.
  - Footer: "Generated with MUNE Splits" and page numbers.
- Generate a real `.pdf` file client-side (e.g. `@react-pdf/renderer`, or `jsPDF` + `jspdf-autotable`) with filename `MUNE-Splits_<event-name>_<date>.pdf`. Also include a print-friendly view (`window.print()` with a print stylesheet) as a fallback.
- The PDF uses a light, print-friendly version of the brand: white background, pastel orange accents, so it prints well and reads well on phones.
- Optional extra: "Copy summary" puts a plain-text summary on the clipboard for pasting into WhatsApp.

## 5. Design: modern fintech, dark mode, Mune branding

- **Dark mode by default** (a light mode toggle is a nice extra). It should feel like a premium banking app (think Revolut / Monzo / Linear): calm, spacious, precise.
- **Primary colour: pastel orange**, roughly `#FFB38A` / `#FFA66B`, with a slightly deeper hover `#FF9455`. Use it for primary buttons, key numbers, active states and charts. Don't overuse it.
- Background: near-black with a warm tint (`#0E0E10` / `#141417`). Surfaces: `#1A1A1F` / `#212127` with subtle 1px borders (`#2A2A31`). Text: `#F5F5F7` primary, `#9A9AA3` secondary.
- Semantic colours: soft mint green for "you are owed", soft coral/red for "you owe", neutral grey for settled.
- Typography: Inter or Geist for UI. Use **tabular numerals** for all amounts so columns line up. Show large, confident amounts on balance cards.
- Rounded cards (12–16px radius), soft shadows or glow on key cards, small micro-interactions (hover lifts, number count-up, smooth transitions). Respect `prefers-reduced-motion`.
- **Branding**: the "MUNE" wordmark plus "Splits", in the same style family as Mune Tasks. Use a simple logomark (e.g. a geometric "M" or a split-circle icon in pastel orange). Add a favicon and app icon.
- Layout: a left sidebar (Events, People, Settings) on desktop that turns into a bottom nav on mobile. The event detail page has tabs: **Overview · Expenses · Balances · Settle up**.
- Overview dashboard: total spent, your balance, a spend-by-category donut, spend-by-person bars, and recent expenses.
- Fast entry: a floating **+ Add expense** button and a keyboard shortcut (`N`). The add-expense form opens as a modal or sheet with an amount-first input.
- Responsive down to phone width. Empty states should have friendly copy.

## 6. Local-first data

- All data stays **on my machine**. No accounts, no cloud, no tracking.
- Use the same storage approach as Mune Tasks. If it's unknown, use IndexedDB via Dexie.
- **Backup**: export and import all data as JSON, and export a single event as CSV.
- Settings: default currency, currency formatting/locale, my own name ("You"), theme, manage categories, and clear all data (with confirmation).

## 7. Tech stack (unless Mune Tasks uses something different; if so, match it)

- Vite + React + TypeScript
- Tailwind CSS (design tokens as CSS variables) + shadcn/ui-style components
- Dexie (IndexedDB) for storage
- Zustand or React context for state
- Recharts for charts
- `@react-pdf/renderer` or jsPDF for PDFs
- Vitest for the split engine tests
- Installable as a **PWA**, so it can run in its own window offline

Keep the split and settle logic in a pure, framework-free module (`src/lib/splits.ts`) with full tests.

## 8. Install & run (match Mune Tasks)

- `npm install` then `npm run dev` for development; `npm run build` + `npm run preview` for a production build.
- A double-click **Windows launcher** `Start MUNE Splits.bat`. It installs dependencies on first run if `node_modules` is missing, starts the app on a fixed port (e.g. `5174`, so it doesn't clash with Mune Tasks), and opens the browser automatically.
- A clear **README.md** covering prerequisites (Node LTS version), install, run, the launcher, where data is stored, how to back up and restore, and how to install as a desktop PWA.

## 9. Seed / demo

- A "Load demo trip" button (in Settings or the empty state) that creates a sample trip, e.g. "Goa Trip" with 4 people. It should include weighted expenses (someone counted as 2, someone as 0.5), a multi-payer expense, and one partial settlement, so I can check the maths and PDF output at a glance.

## 10. Definition of done

- I can create an event, add people, and add expenses using all four split modes (including custom weights like 0.5 and 2).
- Balances and simplified transfers are correct, and the tests pass.
- I can mark transfers as paid and mark the whole event as settled.
- I can export a polished PDF and send it to friends.
- Dark, modern, pastel-orange MUNE look throughout.
- Runs locally with one double-click, same as Mune Tasks.

Build it step by step: the split engine and tests first, then data and storage, then UI, then PDF export, then polish. Show me the app running at the end.
