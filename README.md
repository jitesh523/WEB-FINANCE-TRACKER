# DD Finance Calculator

A personal finance tracker with real, cumulative account balances (not just a
monthly budget sheet), automatic recurring salary and SIP investments, and an
AI chat (powered by Groq) that answers questions about your actual data.
Each person who signs up gets their own private account — nothing is ever
shared or queryable across users.

Live at: https://ddfinancetracker.vercel.app

## Features

### Accounts
The app tracks three real, cumulative running balances — not month-scoped
snapshots that reset when a new month starts:

- **Salary account** — your everyday spending money. Credited by salary and
  any income routed here; debited by expenses, transfers to Savings, and
  salary-funded SIP contributions.
- **Savings account** — money set aside, separate from what you can spend.
  Credited by savings deposits, income routed here, and transfers from
  Salary; debited by transfers back to Salary and savings-funded SIP
  contributions.
- **SIP account** — a lifetime running total of everything you've
  contributed to your recurring investments (Systematic Investment Plans).

All three balances persist across months automatically — money you didn't
spend or move out stays in the account, exactly like a real bank balance.

### Automatic monthly salary
**Set salary** takes an amount *and* a day of the month it's credited (e.g.
the 1st, the 7th, the 28th — whatever your actual payday is). Every month,
once that day arrives, the amount is automatically added to your Salary
account — you never have to add it by hand. A day like 31 automatically
clamps to the last day of shorter months (Feb, April, etc.). Changing the
amount or day going forward doesn't rewrite salary you've already been
credited.

### Expenses
- **Add expenses** with a title, amount, a free-text category (type anything
  — not limited to a fixed list), and any date (not just today).
- **Bulk add**: the Add Expense modal lets you add several expenses at once
  — a shared date up top, a repeatable list of rows (+ Add another), and one
  "Save N expenses" button. Log a whole day's spending in one sitting instead
  of reopening the modal for every purchase.
- Spending is broken down by category with a visual bar chart, and a
  day-by-day chart for the currently viewed month (click any day to see that
  day's transactions).

### Income
- **Add income** from any source (freelance, gifts, refunds, etc.), routed
  into either your Salary or Savings account.
- Same **bulk add** pattern as expenses: multiple income entries, a shared
  date, each with its own destination account, saved together.

### Transfers
Move money between your Salary and Savings accounts in either direction.
A transfer out of Salary correctly reduces the Salary balance and increases
Savings, and vice versa — real money movement, not just a note.

### SIPs (recurring investments)
- Set up a SIP with a name, amount, day of the month it's due, and which
  account it's cut from (Salary or Savings).
- **Auto-execution**: on or after the due day each month, the amount is
  automatically deducted from the chosen account and credited to the SIP
  account — the same mechanism as a manual transfer, just date-triggered. It
  fires at most once per month per plan.
- **Manual contribution logging**: for SIP payments you already made before
  setting this up, or an extra one-off top-up, you can log a specific amount
  against a SIP (or unlinked) with its own date. Choose whether it also
  deducts from Salary, Savings, or neither (for backfilling old payments that
  already left an account you weren't tracking here).
- Deleting a SIP plan stops future reminders/executions but never erases the
  contribution history already recorded.

### Reset a day
Pick any date and see every expense, income, and savings/transfer entry from
that day as a checklist. Select exactly which ones to delete — nothing is
bulk-wiped automatically, and account balances update to match once you
confirm.

### Notifications
A live notification bell (no push notifications or background jobs — just
recomputed from your current data whenever the app is open) flags:
- A SIP due in the next 2 days ("keep ₹X ready in your Salary account")
- Salary or Savings account balance dropping below ₹10,000
- Spending more than ₹10,000 in a single day

### AI chat insights
Ask questions in plain English about your real financial data for the month
you're viewing ("Where am I overspending?", "How's my savings rate?"). Runs
server-side via Groq — your data and the API key never reach the browser as
anything other than the assistant's reply text. Answers are educational only,
never personalized investment advice.

### Month browsing
Switch to any past month to see that month's own spending chart, category
breakdown, and transaction statement. Account balances always show your
current, real-time totals regardless of which month you're browsing —
they're not a snapshot from that month.

### Personalization
- **Dynamic greeting**: changes with the time of day and adds a light
  Japanese touch — "Ohayo" (morning), "Konnichiwa" (afternoon), "Konbanwa"
  (evening) — in English text.
- **Dark mode**: toggle from the header; your choice is remembered and
  applied instantly on every future visit, with no flash of the wrong theme.
- **Lavender theme**: a custom color palette throughout, light and dark.
- Fully responsive — mobile, tablet, and desktop layouts.

### Accounts & privacy
Email/password sign-up, each user's data fully isolated at the database
query level — there is no code path that can return another user's rows.
Passwords are never stored in plain text (handled by better-auth).

## Stack
- **Next.js 16 + React 19 + Tailwind CSS + shadcn/ui-style components** — the app itself
- **better-auth** — email/password authentication
- **drizzle-orm + Postgres** — database (works with Neon, or any Postgres)
- **groq-sdk** — server-side AI chat (the API key never reaches the browser)
- Deployed on **Vercel**, database on **Neon** (serverless Postgres)

## Data model
All money-moving tables (`expenses`, `savings`, `income`, `salary_credits`,
`sip_contributions`) are append-only ledgers scoped by `user_id` — account
balances are always computed by summing history, never stored as a mutable
number, so they can't drift out of sync with what actually happened.

- `salary` — one row per rate change (amount + pay day + the month it took
  effect); the latest row on or before a given month is the rate in force.
- `salary_credits` — one row per month the salary has actually been paid in,
  auto-backfilled by `lib/accounts.ts` up through the current month.
- `expenses` — always debits the Salary account.
- `savings` — `fund_source` of `'salary'` or `'outside'` determines whether a
  deposit also debits Salary; a transfer back to Salary is stored as a
  negative row.
- `income` — `destination` of `'salary'` or `'savings'` determines which
  account is credited.
- `sip_plans` — recurring plan config; `last_executed_month` prevents a plan
  firing twice in the same month.
- `sip_contributions` — the ledger backing the SIP account's lifetime total;
  survives deletion of the plan that created it.

## One-time setup

### 1. Get a Postgres database
Easiest free option: [neon.tech](https://neon.tech) — sign up, create a
project, copy the connection string it gives you (starts with `postgresql://`).

### 2. Get a Groq API key
[console.groq.com](https://console.groq.com) — sign up, create an API key.

### 3. Configure environment variables
Copy `.env.example` to `.env.local` and fill in:
```
DATABASE_URL=<your Neon connection string>
BETTER_AUTH_SECRET=<random string, e.g. output of: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000   # your deployed URL in production
GROQ_API_KEY=<your Groq key>
```

### 4. Create the database tables
```bash
npm install
npx drizzle-kit push
```
This creates the app's own tables (salary, expenses, savings, income, SIPs,
etc.) and better-auth's tables (user, session, account, verification) from
`lib/db/schema.ts`.

### 5. Run it
```bash
npm run dev
```
Open http://localhost:3000 — you'll be redirected to sign up/log in.

## Deploying
Push to GitHub, import into Vercel, set the four environment variables above
in the Vercel project settings (using your production URL for
`BETTER_AUTH_URL`), and deploy. After any schema change, run
`npx drizzle-kit push` against the production `DATABASE_URL` as well as
local before deploying.
