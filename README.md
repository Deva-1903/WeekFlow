# WeekFlow

WeekFlow is a personal execution dashboard for a single power user first.

The core model now has five distinct lanes:

- Fixed commitments
- Active tasks
- This Week / Today
- Future
- Recurring task templates

Imported calendar events are not tasks. Future items are not backlog. Recurring commitments generate calendar pressure; recurring task templates generate real tasks.

## What’s Included

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

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` into both `.env` and `.env.local`, then fill in your Postgres connection details.

Required for the app:

```bash
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/weekflow"
NEXTAUTH_SECRET="change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
DEMO_USER_EMAIL="demo@weekflow.app"
DEMO_USER_PASSWORD="weekflow2024"
```

Optional for Google Calendar sync:

```bash
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

Google sync is optional. If the Google env vars are missing, the app still runs and Settings shows a graceful disabled state for Calendar Connections.

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

## Google Calendar Integration

WeekFlow supports optional Google Calendar import for fixed commitments.

### Required Google setup

1. Create OAuth credentials in Google Cloud.
2. Add these authorized redirect URIs:

```text
http://localhost:3000/api/calendar/google/callback
```

3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in both `.env` and `.env.local`.

### What the sync does

- connects a Google account from Settings
- fetches available calendars
- stores calendar selection and capacity flags locally
- imports events as `ExternalEvent`
- expands basic recurring Google events via Google’s `singleEvents=true` instances
- keeps imported events visually distinct from manual work blocks
- uses selected calendars in weekly capacity and conflict detection

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
  recurring-tasks.ts
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrate dev |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset the database and reseed |
| `npm run db:studio` | Open Prisma Studio |

## Notes

- The app can run without Google credentials.
- Recurring commitments are generated on the fly for the calendar and capacity engine.
- Recurring task templates generate concrete tasks and avoid duplicates via a per-template period key.
- Future-item review dates are reminders, not hard deadlines.
