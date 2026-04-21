# WeekFlow

WeekFlow is a personal execution dashboard for a single power user first.

The core model has five distinct lanes:

- Fixed commitments
- Active tasks
- This Week / Today
- Future
- Recurring task templates

Imported calendar events are not tasks. Future items are not backlog. Recurring commitments generate calendar pressure; recurring task templates generate real tasks.

## What's Included

| Area | Highlights |
| --- | --- |
| Dashboard | Big rocks, review reminders, fixed commitments today, weekly load reality check |
| Tasks | Manual tasks plus badges for recurring/promoted sources |
| Weekly Review | Capacity math that subtracts fixed commitments before comparing task load |
| Daily Planner | Big rocks from active work only |
| Calendar | Manual blocks, imported synced events, recurring commitments, source filters, conflict visibility |
| Future | Someday / future items with review dates, snooze, promote, archive, done |
| Templates | Recurring commitments and recurring task templates |
| Analytics | Fixed commitment hours, work vs commitments, future-item promotion/review trends, recurring task completion, calendar conflicts |
| Settings | Capacity assumptions plus Calendar Connections and sync preferences |

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Prisma v7 + PostgreSQL
- NextAuth v5
- shadcn/ui
- Recharts
- date-fns
- React Hook Form + Zod

## Product Notes

- Backlog is not the week.
- The week is not the day.
- Fixed commitments are not tasks.
- Future items are not active commitments.
- Analytics separates task execution from imported schedule pressure.

---

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp .env.example .env.local
```

Both files are needed:

- `.env` — read by `prisma.config.ts` for migrations and seeding
- `.env.local` — read by Next.js at runtime

For local dev, you only need `DATABASE_URL`:

```
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/weekflow"
NEXTAUTH_SECRET="any-local-dev-string"
NEXTAUTH_URL="http://localhost:3000"
DEMO_USER_EMAIL="demo@weekflow.app"
DEMO_USER_PASSWORD="weekflow2024"
```

Leave `DIRECT_URL` blank locally — `prisma.config.ts` falls back to `DATABASE_URL` when `DIRECT_URL` is unset.

### 3. Create the database

```bash
createdb weekflow
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use:

- Email: `demo@weekflow.app`
- Password: `weekflow2024`

---

## Production Deployment — Vercel + Neon

### Step 1 — Create a Neon project

1. Go to [neon.tech](https://neon.tech) and create a project.
2. Choose a region close to your Vercel deployment region.
3. Neon creates a default `main` branch with a database named `neondb` (you can rename it or use as-is).

### Step 2 — Get your connection strings

In the Neon console, open your project → **Connection Details**.

You need two strings:

**Pooled connection (DATABASE_URL)**
- Select "Pooled connection" — the host contains `-pooler` in the name.
- Example: `postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
- This is used for all application queries at runtime.

**Direct connection (DIRECT_URL)**
- Select "Direct connection" — the host does NOT contain `-pooler`.
- Example: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
- This is used only for Prisma migrations (`prisma migrate deploy`).

**Why two URLs?** Neon's pgBouncer runs in transaction mode. Prisma migrations use advisory locks which require a persistent session. The direct URL bypasses pgBouncer and gives Prisma a real session connection.

### Step 3 — Run migrations against Neon

From your local machine with both env vars set:

```bash
DIRECT_URL="postgresql://..." DATABASE_URL="postgresql://..." npm run db:deploy
```

Or add them temporarily to your `.env`, run `npm run db:deploy`, then remove.

`db:deploy` runs `prisma migrate deploy` — applies only committed migration files without generating new ones. Never run `db:migrate` (migrate dev) against a production database.

### Step 4 — Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in the Vercel dashboard.
3. Set these **Environment Variables** in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `NEXTAUTH_SECRET` | Output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (no trailing slash) |
| `DEMO_USER_EMAIL` | `demo@weekflow.app` |
| `DEMO_USER_PASSWORD` | Your chosen password |
| `GOOGLE_CLIENT_ID` | (optional) |
| `GOOGLE_CLIENT_SECRET` | (optional) |

4. Deploy. Vercel runs `npm install` → `postinstall` (`prisma generate`) → `next build` automatically.

**Important:** Changing env vars in Vercel does not take effect until you redeploy. Trigger a manual redeploy after updating any env var.

### Step 5 — Verify

```
GET https://your-app.vercel.app/api/health
```

Should return:

```json
{ "status": "ok", "db": "connected" }
```

If `db` is `"unreachable"`, the most common causes are:

- `DATABASE_URL` is missing or has a typo in Vercel env vars
- You used the direct URL instead of the pooled URL for `DATABASE_URL`
- Migrations haven't been applied yet (`npm run db:deploy`)

### Step 6 — Re-deploying after schema changes

1. Create a migration locally: `npm run db:migrate`
2. Commit the generated files in `prisma/migrations/`
3. Run against Neon: `DIRECT_URL="..." npm run db:deploy`
4. Push + redeploy on Vercel.

---

## Prisma v7 Architecture Note

This app uses **Prisma v7 with driver adapters** (`@prisma/adapter-pg`). This is why:

- `prisma/schema.prisma` has `datasource db { provider = "postgresql" }` with no `url` field — Prisma v7 requires the URL to live in `prisma.config.ts` when using driver adapters.
- `prisma.config.ts` controls CLI connections (migrations, studio). It uses `DIRECT_URL` for migrations.
- `lib/prisma.ts` controls the runtime client. It uses `DATABASE_URL` (pooled) via `pg.Pool`.

If you ever see a Prisma error about "url in datasource" (P1012), do not add `url` back to `schema.prisma` — that breaks the v7 driver adapter setup.

---

## Google Calendar Integration

WeekFlow supports optional Google Calendar import for fixed commitments.

### Required Google setup

1. Create OAuth credentials in Google Cloud.
2. Add authorized redirect URIs:

```text
http://localhost:3000/api/calendar/google/callback        (dev)
https://your-app.vercel.app/api/calendar/google/callback  (prod)
```

3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel env vars.

### What the sync does

- Connects a Google account from Settings
- Fetches available calendars
- Stores calendar selection and capacity flags locally
- Imports events as `ExternalEvent`
- Expands basic recurring Google events via Google's `singleEvents=true` instances
- Keeps imported events visually distinct from manual work blocks
- Uses selected calendars in weekly capacity and conflict detection

---

## Future: Background Worker

Recurring task generation and calendar sync currently run on-demand. To schedule them, add a worker that calls `generateRecurringTasksForUser` and calendar sync for all users on a cron schedule. The worker needs only `DATABASE_URL` to connect to Neon.

---

## New Data Model

Prisma now includes:

- `CalendarConnection`
- `ExternalCalendar`
- `ExternalEvent`
- `RecurringCommitmentTemplate`
- `RecurringTaskTemplate`
- `SomedayItem`

Task metadata now also tracks:

- `sourceType`
- `originRecurringTemplateId`
- `promotedFromSomedayId`
- `reviewDate`

## Project Structure

```text
app/
  (app)/
    analytics/
    calendar/
    daily-planner/
    dashboard/
    future/
    health/
    settings/
    tasks/
    templates/
    weekly-review/
  api/
    auth/
    calendar/google/
    health/
actions/
  calendar-sync.ts
  future.ts
  templates.ts
  tasks.ts
  time-blocks.ts
  weekly-review.ts
components/
  calendar/
  dashboard/
  future/
  settings/
  tasks/
  templates/
lib/
  calendar-sync.ts
  commitments.ts
  metrics.ts
  planning.ts
  prisma.ts
  recurring-tasks.ts
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrate dev — local only |
| `npm run db:deploy` | Apply migrations to production (use with DIRECT_URL) |
| `npm run db:seed` | Seed demo data — blocked in production |
| `npm run db:reset` | Reset database and reseed — dev only, destructive |
| `npm run db:studio` | Open Prisma Studio |

## Notes

- The app runs without Google credentials — Settings shows a graceful disabled state.
- Recurring commitments are generated on the fly for the calendar and capacity engine.
- Recurring task templates generate concrete tasks and avoid duplicates via a per-template period key.
- Future-item review dates are reminders, not hard deadlines.
- `postinstall` runs `prisma generate` so Vercel builds always have a fresh Prisma client.
- The seed script refuses to run when `NODE_ENV=production`.
