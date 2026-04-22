-- CreateEnum
CREATE TYPE "InboxConvertedType" AS ENUM ('TASK', 'FUTURE', 'JOURNAL', 'DISCARD');

-- CreateEnum
CREATE TYPE "FutureStatus" AS ENUM ('FUTURE', 'ACTIVE', 'DONE', 'DROPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoutineRecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoutineTargetPeriod" AS ENUM ('DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "RoutineStrictnessMode" AS ENUM ('FLEXIBLE', 'FIXED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'INBOX_CAPTURED';
ALTER TYPE "EventType" ADD VALUE 'INBOX_PROCESSED';
ALTER TYPE "EventType" ADD VALUE 'ROUTINE_LOGGED';
ALTER TYPE "EventType" ADD VALUE 'JOURNAL_SAVED';
ALTER TYPE "EventType" ADD VALUE 'FUTURE_PROMOTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskArea" ADD VALUE 'SDE_PREP';
ALTER TYPE "TaskArea" ADD VALUE 'ML_PREP';
ALTER TYPE "TaskArea" ADD VALUE 'AI_SAFETY_ALIGNMENT';
ALTER TYPE "TaskArea" ADD VALUE 'JOB';
ALTER TYPE "TaskArea" ADD VALUE 'LIFE_ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskSourceType" ADD VALUE 'INBOX';
ALTER TYPE "TaskSourceType" ADD VALUE 'ROUTINE';
ALTER TYPE "TaskSourceType" ADD VALUE 'PROMOTED_FUTURE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "TaskStatus" ADD VALUE 'TOMORROW';
ALTER TYPE "TaskStatus" ADD VALUE 'DROPPED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "originRoutineId" TEXT,
ADD COLUMN     "promotedFromFutureId" TEXT,
ADD COLUMN     "routinePeriodKey" TEXT;

-- CreateTable
CREATE TABLE "daily_plan_items" (
    "id" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isTopPriority" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "convertedToType" "InboxConvertedType",
    "convertedToId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "future_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskArea" NOT NULL DEFAULT 'OTHER',
    "targetTimeframe" TEXT,
    "reviewDate" TIMESTAMP(3),
    "status" "FutureStatus" NOT NULL DEFAULT 'FUTURE',
    "promotedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "future_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_routines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskArea" NOT NULL DEFAULT 'OTHER',
    "recurrenceType" "RoutineRecurrenceType" NOT NULL DEFAULT 'WEEKLY',
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "targetPeriod" "RoutineTargetPeriod" NOT NULL DEFAULT 'WEEK',
    "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "preferredTime" TEXT,
    "strictnessMode" "RoutineStrictnessMode" NOT NULL DEFAULT 'FLEXIBLE',
    "generateTasks" BOOLEAN NOT NULL DEFAULT false,
    "defaultTaskTitle" TEXT,
    "defaultTaskCategory" "TaskArea",
    "defaultEffortEstimate" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "linkedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "bestMoment" TEXT,
    "notableConversation" TEXT,
    "wins" TEXT,
    "struggles" TEXT,
    "brainDump" TEXT,
    "gratitude" TEXT,
    "freeformText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_plan_items_dailyPlanId_order_idx" ON "daily_plan_items"("dailyPlanId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plan_items_dailyPlanId_taskId_key" ON "daily_plan_items"("dailyPlanId", "taskId");

-- CreateIndex
CREATE INDEX "inbox_items_userId_archived_processedAt_idx" ON "inbox_items"("userId", "archived", "processedAt");

-- CreateIndex
CREATE INDEX "inbox_items_userId_createdAt_idx" ON "inbox_items"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "future_items_userId_status_idx" ON "future_items"("userId", "status");

-- CreateIndex
CREATE INDEX "future_items_userId_reviewDate_idx" ON "future_items"("userId", "reviewDate");

-- CreateIndex
CREATE INDEX "future_items_userId_category_idx" ON "future_items"("userId", "category");

-- CreateIndex
CREATE INDEX "recurring_routines_userId_isActive_idx" ON "recurring_routines"("userId", "isActive");

-- CreateIndex
CREATE INDEX "recurring_routines_userId_category_idx" ON "recurring_routines"("userId", "category");

-- CreateIndex
CREATE INDEX "routine_sessions_userId_date_idx" ON "routine_sessions"("userId", "date");

-- CreateIndex
CREATE INDEX "routine_sessions_routineId_date_idx" ON "routine_sessions"("routineId", "date");

-- CreateIndex
CREATE INDEX "journal_entries_userId_date_idx" ON "journal_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_userId_date_key" ON "journal_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_promotedFromFutureId_key" ON "tasks"("promotedFromFutureId");

-- CreateIndex
CREATE INDEX "tasks_userId_originRoutineId_idx" ON "tasks"("userId", "originRoutineId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_originRoutineId_routinePeriodKey_key" ON "tasks"("originRoutineId", "routinePeriodKey");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_originRoutineId_fkey" FOREIGN KEY ("originRoutineId") REFERENCES "recurring_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_promotedFromFutureId_fkey" FOREIGN KEY ("promotedFromFutureId") REFERENCES "future_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "future_items" ADD CONSTRAINT "future_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_routines" ADD CONSTRAINT "recurring_routines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_sessions" ADD CONSTRAINT "routine_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_sessions" ADD CONSTRAINT "routine_sessions_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "recurring_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_sessions" ADD CONSTRAINT "routine_sessions_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
