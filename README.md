# WeekFlow

WeekFlow is a focused personal execution system for one overloaded user. It is designed to reduce mental chaos across coursework, internship prep, interview prep, research, part-time work, health, life admin, social life, and random future intentions.

The product is intentionally list-first:

- Capture quickly into Inbox.
- Separate real tasks from vague future items.
- Keep flexible routines alive.
- Choose tomorrow intentionally.
- Journal / brain dump without losing thoughts.

WeekFlow is not a calendar sync platform, a Notion clone, or a generic productivity dashboard.

## V1 Modules

| Module | Purpose |
| --- | --- |
| Dashboard | Lightweight clarity: inbox count, today plan, overdue tasks, routines, future reviews, journal shortcut |
| Inbox | Fast capture and processing into Task, Future, Journal, or discard |
| Tasks | Actionable work only, separate from future ideas and fixed commitments |
| Routines | Flexible recurring targets like gym 4x/week, DSA daily, ML prep, research sessions |
| Future | Important-but-not-now items with review dates and promotion into tasks |
| Daily Planner | Choose tomorrow's top priorities and smaller supports |
| Journal | Reflection, memory capture, emotional clutter, and freeform brain dump |
| Analytics | Lightweight execution signals: task completion, inbox processing, routines, tomorrow plans, overdue pressure, journal consistency |
| Settings | Minimal profile, planning limits, timezone/capacity assumptions, optional calendar settings |

Calendar, Weekly Review, Templates, and Health Log still exist as secondary surfaces so existing functionality is preserved, but they are no longer the product center.

## Product Model

The core V1 lanes are intentionally separate:

- `InboxItem` is uncategorized capture.
- `Task` is real actionable work.
- `RecurringRoutine` and `RoutineSession` track flexible repeating commitments.
- `FutureItem` stores important later items that should not clutter active work.
- `JournalEntry` stores reflection and brain dumps.
- `DailyPlan` and `DailyPlanItem` represent intentional tomorrow planning.

Future review dates are reminders, not hard deadlines. Routines are often flexible targets, not fixed calendar events. Optional imported calendar events remain separate from task completion analytics.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Prisma v7 + PostgreSQL / Neon
- NextAuth v5
- shadcn/ui-style primitives
- Recharts for lightweight analytics
- React Hook Form + Zod
- date-fns + date-fns-tz

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file to both runtime locations:

```bash
cp .env.example .env
cp .env.example .env.local
```

Minimum local values:

```env
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/weekflow"
DIRECT_URL=""
NEXTAUTH_SECRET="any-local-dev-secret"
NEXTAUTH_URL="http://localhost:3000"
DEMO_USER_EMAIL="demo@weekflow.app"
DEMO_USER_PASSWORD="weekflow2024"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

`.env` is used by Prisma CLI. `.env.local` is used by Next.js at runtime.

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

The seed creates a realistic V1 demo: inbox clutter, active tasks, flexible routines, routine sessions, future items with review dates, journal entries, tomorrow plans, and a small optional calendar sample.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with:

- Email: `demo@weekflow.app`
- Password: `weekflow2024`

## Environment Variables

Required:

- `DATABASE_URL`: application database connection string.
- `NEXTAUTH_SECRET`: secret for NextAuth sessions.
- `NEXTAUTH_URL`: canonical app URL.

Recommended for production:

- `DIRECT_URL`: direct Neon/Postgres connection used for migrations.
- `DEMO_USER_EMAIL`: seed/demo login email.
- `DEMO_USER_PASSWORD`: seed/demo login password.

Optional:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Google Calendar is optional. If those variables are blank, WeekFlow still runs normally and Settings shows calendar sync as unavailable.

For Neon, prefer `sslmode=verify-full` in Postgres URLs. If Neon gives you a URL ending in `sslmode=require`, the app normalizes that value at runtime before handing it to `pg` so Next dev does not show the SSL warning overlay.

## Optional Google Calendar Setup

Calendar sync is preserved as a secondary feature. To enable it:

1. Create OAuth 2.0 credentials in Google Cloud.
2. Add redirect URIs:

```text
http://localhost:3000/api/calendar/google/callback
https://your-app.vercel.app/api/calendar/google/callback
```

3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Imported calendar events are modeled as external fixed commitments, not tasks.

## Production Notes

For Neon + Vercel:

- Use the pooled Neon URL for `DATABASE_URL`, preferably with `sslmode=verify-full`.
- Use the direct Neon URL for `DIRECT_URL`, preferably with `sslmode=verify-full`.
- Run production migrations with `npm run db:deploy`.
- Do not run `npm run db:migrate` against production.
- Changing Vercel environment variables requires a redeploy.

Prisma v7 uses driver adapters in this app. Do not add a `url` field back to `datasource db` in `prisma/schema.prisma`; CLI connection configuration lives in `prisma.config.ts`, and runtime connection setup lives in `lib/prisma.ts`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Create/apply local migrations |
| `npm run db:deploy` | Apply committed migrations in production |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset local DB and reseed |
| `npm run db:studio` | Open Prisma Studio |

## Date Handling

WeekFlow uses `America/New_York` as the primary timezone. Date-only fields are stored as midnight in that timezone expressed as UTC. Use helpers in `lib/timezone.ts` for today, week boundaries, date parsing, review dates, due dates, routines, journal dates, and analytics buckets.
