# DD Finance Calculator

Track salary, extra income (gifts, freelance, etc.), daily expenses, and
savings, with an AI chat (powered by Groq) that can answer questions about
your real spending data. Click any day in the spending chart to see that
day's transactions, or use the month picker to browse past months and see
that month's own chart, category breakdown, and statement. Each person who
signs up gets their own private account — nothing is shared between users.

## Stack
- **Next.js 16 + React 19 + Tailwind + shadcn/ui** — the app itself
- **better-auth** — email/password authentication
- **drizzle-orm + Postgres** — database (works with Neon, or any Postgres)
- **groq-sdk** — server-side AI insights (the API key never reaches the browser)

## One-time setup

### 1. Get a Postgres database
Easiest free option: [neon.tech](https://neon.tech) — sign up, create a project,
copy the connection string it gives you (starts with `postgresql://`).

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
pnpm install
npx drizzle-kit push
```
This creates both the app's tables (salary, expenses, savings) and better-auth's
own tables (user, session, account, verification) from `lib/db/schema.ts`.

### 5. Run it
```bash
pnpm dev
```
Open http://localhost:3000 — you'll be redirected to sign up/log in.

## Deploying (Vercel, free tier)
1. Push this project to a GitHub repo.
2. Import it into [vercel.com](https://vercel.com).
3. In the project's Environment Variables settings, add the same four variables
   from step 3 above (set `BETTER_AUTH_URL` to your real `*.vercel.app` URL).
4. Deploy. Share the resulting URL — anyone can sign up for their own account.

## How data stays private
Every database query in `app/api/*/route.ts` and `app/page.tsx` filters by the
signed-in user's id (from `better-auth`'s session) — there is no query path
that can return another user's rows. The Groq insights endpoint
(`app/api/insights/route.ts`) reads the same session-scoped data server-side
and only ever sends that one user's numbers to Groq.
