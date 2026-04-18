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

Fill in your local Postgres connection:

```bash
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/weekflow"
NEXTAUTH_SECRET="any-random-string-for-dev"
NEXTAUTH_URL="http://localhost:3000"
DEMO_USER_EMAIL="demo@weekflow.app"
DEMO_USER_PASSWORD="weekflow2024"
```

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

The seed includes:

- realistic manual tasks
- recurring commitment templates
- recurring task templates plus generated tasks
- future items with review dates
- mocked external Google calendar data for analytics and calendar rendering
- health logs, weekly plans, daily plans, and recent activity

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use:

- Email: `demo@weekflow.app`
- Password: `weekflow2024`

---

## Production Deployment — Vercel + DigitalOcean

### Overview

| Layer | Service |
| --- | --- |
| Frontend + API routes | Vercel |
| Database | DigitalOcean Managed PostgreSQL |

### Step 1 — Provision DigitalOcean Managed PostgreSQL

1. Create a **Managed PostgreSQL** cluster in the DO console.
2. Add a new database named `weekflow` inside the cluster.
3. Under **Connection Details**, copy the **Connection string**.
4. Append `?sslmode=require` to the connection string — DO requires SSL.

```
postgresql://doadmin:PASS@host.db.ondigitalocean.com:25060/weekflow?sslmode=require
```

**Port note:** Use port `25060` (direct TCP), not `6543` (pgBouncer). Prisma's `migrate deploy` needs a direct connection. Runtime queries work fine on pgBouncer if you need pooling later.

5. Under **Trusted Sources**, add Vercel's outbound IPs, or allow all sources initially and lock down after confirming deployment works.

### Step 2 — Run migrations against the production database

From your local machine with the production URL set:

```bash
DATABASE_URL="postgresql://..." npm run db:deploy
```

`db:deploy` runs `prisma migrate deploy` — applies only committed migration files without auto-generating new ones. Never run `db:migrate` (migrate dev) against production.

### Step 3 — Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in the Vercel dashboard.
3. Set these **Environment Variables** in Vercel → Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your DO connection string (with `?sslmode=require`) |
| `NEXTAUTH_SECRET` | Output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (no trailing slash) |
| `DEMO_USER_EMAIL` | `demo@weekflow.app` |
| `DEMO_USER_PASSWORD` | Your chosen password |
| `GOOGLE_CLIENT_ID` | (optional) |
| `GOOGLE_CLIENT_SECRET` | (optional) |

4. Deploy. Vercel runs `npm install` → `postinstall` (runs `prisma generate`) → `next build` automatically.

### Step 4 — Verify

```
GET https://your-app.vercel.app/api/health
```

Returns `{ "status": "ok", "db": "connected" }` when healthy. If `db` is `"unreachable"`, check `DATABASE_URL` and trusted sources on your DO cluster.

### Re-deploying after schema changes

1. Create a migration locally: `npm run db:migrate`
2. Commit the generated files in `prisma/migrations/`
3. Run against production: `DATABASE_URL="..." npm run db:deploy`
4. Push + redeploy on Vercel.

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

## Future: Background Worker (DigitalOcean App Platform)

Recurring task generation and calendar sync currently run on-demand. To schedule them:

1. Add a **Worker** component to a DO App Platform spec (or use DO Functions with a cron trigger).
2. The worker calls `generateRecurringTasksForUser` and calendar sync for all users.
3. Set the same `DATABASE_URL` on the worker.
4. Schedule via cron (e.g., `0 * * * *` for hourly).

This is optional — the app is fully usable without it.

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
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrate dev (local only) |
| `npm run db:deploy` | Apply migrations to production database |
| `npm run db:seed` | Seed demo data (blocked in production) |
| `npm run db:reset` | Reset the database and reseed (dev only) |
| `npm run db:studio` | Open Prisma Studio |

## Notes

- The app runs without Google credentials — Settings shows a graceful disabled state for Calendar Connections.
- Recurring commitments are generated on the fly for the calendar and capacity engine.
- Recurring task templates generate concrete tasks and avoid duplicates via a per-template period key.
- Future-item review dates are reminders, not hard deadlines.
- `postinstall` runs `prisma generate` automatically so Vercel builds always have a fresh Prisma client.
