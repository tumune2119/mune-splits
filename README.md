# MUNE Splits

A local-first expense splitter, sibling to **MUNE TASKS**. Create an event or trip, add the people, log who paid for what, and MUNE Splits works out who owes whom, using the fewest possible payments to settle everyone up.

Everything stays on your computer. Data lives in a local SQLite file, the server only listens on `127.0.0.1`, and there are no accounts, cloud sync or tracking.

## Prerequisites

- **Node.js 20 or newer** (the current LTS is recommended). Check with `node -v`.
- Chrome or Edge, if you want the app to open in its own window.

## Run it

### The easy way: double-click

- **`Start MUNE Splits.bat`** installs dependencies on first run, builds the app (again whenever the source changes), starts it on **http://127.0.0.1:5174**, and opens it as a Chrome/Edge app window. Port 5174 means it never clashes with MUNE TASKS on 3777.
- **`launch-mune-splits.vbs`** does the same without a console window. The console only appears when an install or rebuild is needed. Server logs go to `logs\server.log`.
- **Desktop shortcut (recommended):** right-click `create-shortcut.ps1` and choose *Run with PowerShell*, or run:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\create-shortcut.ps1
  ```

**Closing:** close the MUNE Splits window or click **Quit MUNE Splits** in the sidebar. The server stops by itself about 5 seconds after the last window closes. Reloading the window doesn't stop it. If MUNE Splits is already running, the launcher just opens another window.

### From a terminal

```bash
npm install
npm run dev        # development, http://127.0.0.1:5175 (hot reload)
npm run build      # production build
npm run preview    # serve the production build on http://127.0.0.1:5174
npm test           # split/settle engine unit tests (Vitest)
```

`npm run dev` and `npm run preview` don't stop on their own (there's no Quit button). Stop them with Ctrl+C.

## Using it

- **Events:** name, dates, currency, an icon and colour. Filter by Active, Settled, Archived or All. Press **N** to create one.
- **People:** a reusable list of your regulars. Pick them when creating an event, or add new names on the spot. They're just labels.
- **Add expense** (floating button, or **N** on an event page): amount first, then title, date, category, who paid (one person or **multiple payers** with an amount each) and how to split it:
  - **Equal:** tick who shares it.
  - **Shares:** a weight per person *for this expense only*. Use `½`, `1`, `2` or any number: `2` counts as two people, `0.5` as a half portion, `0` leaves them out. Each person's amount updates as you type.
  - **Exact:** type each amount. Saving is blocked until they add up. Double-click a box to fill in what's left.
  - **Percent:** must total 100%.
  - Optional notes and a receipt photo or PDF, stored locally.
- **Balances:** each person's paid, share and net balance, plus who owes whom. Toggle between **Simplified** (fewest payments) and **Raw** (direct debts from each expense).
- **Settle up:** suggested payments ("Priya pays You ₹14,186.50"). Use **Mark as paid**, or **Partial…** for part-payments, or record any other payment. Every payment can be undone. When everyone is at zero, **Mark event as settled** locks the event as read-only. You can reopen it from the banner or the ⋯ menu.
- **Export PDF** (event header): a shareable report with summary cards, who owes whom (paid/unpaid), the category breakdown, every expense with each person's share and weights ("Priya ×2, Rohan ×0.5, others ×1"), and the settlement history. It saves as `MUNE-Splits_<event>_<date>.pdf`. The ⋯ menu also has **Print view** (browser print / Save as PDF), **Copy summary** (plain text for WhatsApp) and **Export CSV**.
- **Settings:** your name, default currency, number format, light/dark theme, categories (their order sets their chart colour), backup/restore, **Load demo trip** and **Clear all data**.

Not sure about the maths? **Settings → Load demo trip** (also on the empty home screen) creates "Goa Trip" with 4 people, weighted shares (Priya ×2, Rohan ×0.5), a multi-payer villa, every split mode and a partial settlement.

## How the maths works

- All amounts are stored as **integer minor units** (paise/cents), so there are no floating-point errors.
- Shares are `amount × weight / sum(weights)`. Leftover paise go to the largest remainders (ties by order), so shares always add up exactly to the total.
- **Net balance** = paid − share + payments sent − payments received.
- **Simplify debts:** greedily match the largest creditor with the largest debtor until everyone is at zero. This takes at most *people − 1* payments.
- The engine is a pure module, `src/lib/splits.ts`, covered by `src/lib/splits.test.ts`: equal, weighted with decimals, exact, percent, multi-payer, rounding remainders, partial settlements and the 5,000 / 2,000 example.

## Where your data is stored

| What | Where |
| --- | --- |
| Database | `data\mune-splits.db` (SQLite) |
| Receipts | `data\receipts\` |
| Server log (launcher) | `logs\server.log` |

To keep data somewhere else, set `MUNE_SPLITS_DATA_DIR` to a folder before starting.

> This folder is inside OneDrive. OneDrive syncing a live SQLite database can occasionally conflict. If that happens, pause syncing while MUNE Splits runs, or point `MUNE_SPLITS_DATA_DIR` at a folder outside OneDrive and rely on JSON backups.

## Backup and restore

- **Settings → Export all data (JSON)** downloads everything: events, people, payments, settings and receipt images.
- **Settings → Import backup** restores a backup. **Merge** keeps current data (events with the same id are replaced); **Replace everything** wipes first.
- **Event ⋯ menu → Export CSV** exports one event for spreadsheets.
- To copy the raw database by hand, stop MUNE Splits first, then copy the `data` folder.

## Install as a desktop app (PWA)

Start MUNE Splits with the launcher, then in its window open the browser menu and choose **Install MUNE Splits** (or click the install icon in the address bar). The installed app still needs the local server running, so start it with the launcher or shortcut first. No internet connection is needed.

## Tech

Same stack as MUNE TASKS: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4 with design tokens as CSS variables, shadcn/ui-style components (Radix), SQLite via `better-sqlite3`, Recharts, jsPDF + jspdf-autotable (with embedded Inter, so ₹ renders), and Vitest.

- `src/lib/splits.ts`: split and settle engine (pure)
- `src/lib/event-math.ts`: balances, transfers and totals per event (shared by the UI, PDF and CSV)
- `src/lib/store.ts`: all database reads and writes. Every event edit is one typed action (`src/lib/event-actions.ts`) sent to `PATCH /api/events/[id]`.
- `src/lib/pdf.ts`: PDF report
- `src/proxy.ts`: rejects foreign `Host` headers and cross-site writes, so other websites can't drive your local server
- `scripts/`: launcher helpers and `npm run icons` (regenerates `public/icons` from the logo)

`better-sqlite3` is pinned to `12.9.0`, which ships prebuilt binaries for Node 20 (same as MUNE TASKS).
