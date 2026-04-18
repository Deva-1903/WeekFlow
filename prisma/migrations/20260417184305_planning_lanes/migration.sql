-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "EventSourceType" AS ENUM ('INTERNAL', 'EXTERNAL_SYNC', 'RECURRING_COMMITMENT');

-- CreateEnum
CREATE TYPE "SomedayStatus" AS ENUM ('SOMEDAY', 'ACTIVE', 'DONE', 'DROPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('MANUAL', 'RECURRING', 'PROMOTED_FROM_SOMEDAY');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommitmentType" AS ENUM ('CLASS', 'WORK', 'GYM', 'MEETING', 'PERSONAL', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'CALENDAR_SYNCED';
ALTER TYPE "EventType" ADD VALUE 'SOMEDAY_PROMOTED';
ALTER TYPE "EventType" ADD VALUE 'SOMEDAY_REVIEWED';
ALTER TYPE "EventType" ADD VALUE 'RECURRING_TASK_GENERATED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "originRecurringTemplateId" TEXT,
ADD COLUMN     "promotedFromSomedayId" TEXT,
ADD COLUMN     "recurrencePeriodKey" TEXT,
ADD COLUMN     "reviewDate" TIMESTAMP(3),
ADD COLUMN     "sourceType" "TaskSourceType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "time_blocks" ADD COLUMN     "sourceType" "EventSourceType" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "workdayEndTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "workdayStartTime" TEXT NOT NULL DEFAULT '09:00';

-- AlterTable
ALTER TABLE "weekly_plans" ADD COLUMN     "fixedCommitmentMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remainingFocusMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "displayName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_calendars" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerCalendarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "affectsCapacity" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "isRecurringInstance" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRuleRaw" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "sourceType" "EventSourceType" NOT NULL DEFAULT 'EXTERNAL_SYNC',
    "affectsCapacity" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_commitment_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CommitmentType" NOT NULL DEFAULT 'OTHER',
    "sourceType" "EventSourceType" NOT NULL DEFAULT 'RECURRING_COMMITMENT',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "affectsCapacity" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_commitment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" "TaskArea" NOT NULL DEFAULT 'OTHER',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedMinutes" INTEGER,
    "recurrenceType" "RecurringFrequency" NOT NULL DEFAULT 'WEEKLY',
    "recurrenceConfig" JSONB NOT NULL,
    "defaultStatus" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "someday_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskArea" NOT NULL DEFAULT 'OTHER',
    "roughEffort" TEXT,
    "targetTimeframe" TEXT,
    "reviewDate" TIMESTAMP(3),
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "status" "SomedayStatus" NOT NULL DEFAULT 'SOMEDAY',
    "promotedAt" TIMESTAMP(3),
    "convertedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "someday_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_connections_userId_provider_idx" ON "calendar_connections"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_userId_provider_providerAccountId_key" ON "calendar_connections"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "external_calendars_userId_isSelected_idx" ON "external_calendars"("userId", "isSelected");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendars_connectionId_providerCalendarId_key" ON "external_calendars"("connectionId", "providerCalendarId");

-- CreateIndex
CREATE INDEX "external_events_userId_startTime_idx" ON "external_events"("userId", "startTime");

-- CreateIndex
CREATE INDEX "external_events_userId_endTime_idx" ON "external_events"("userId", "endTime");

-- CreateIndex
CREATE INDEX "external_events_userId_sourceType_idx" ON "external_events"("userId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "external_events_calendarId_providerEventId_key" ON "external_events"("calendarId", "providerEventId");

-- CreateIndex
CREATE INDEX "recurring_commitment_templates_userId_isActive_idx" ON "recurring_commitment_templates"("userId", "isActive");

-- CreateIndex
CREATE INDEX "recurring_task_templates_userId_isActive_idx" ON "recurring_task_templates"("userId", "isActive");

-- CreateIndex
CREATE INDEX "someday_items_userId_status_idx" ON "someday_items"("userId", "status");

-- CreateIndex
CREATE INDEX "someday_items_userId_reviewDate_idx" ON "someday_items"("userId", "reviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_promotedFromSomedayId_key" ON "tasks"("promotedFromSomedayId");

-- CreateIndex
CREATE INDEX "tasks_userId_reviewDate_idx" ON "tasks"("userId", "reviewDate");

-- CreateIndex
CREATE INDEX "tasks_userId_sourceType_idx" ON "tasks"("userId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_originRecurringTemplateId_recurrencePeriodKey_key" ON "tasks"("originRecurringTemplateId", "recurrencePeriodKey");

-- CreateIndex
CREATE INDEX "time_blocks_userId_sourceType_idx" ON "time_blocks"("userId", "sourceType");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_originRecurringTemplateId_fkey" FOREIGN KEY ("originRecurringTemplateId") REFERENCES "recurring_task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_promotedFromSomedayId_fkey" FOREIGN KEY ("promotedFromSomedayId") REFERENCES "someday_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendars" ADD CONSTRAINT "external_calendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendars" ADD CONSTRAINT "external_calendars_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_events" ADD CONSTRAINT "external_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_events" ADD CONSTRAINT "external_events_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "external_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_commitment_templates" ADD CONSTRAINT "recurring_commitment_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "someday_items" ADD CONSTRAINT "someday_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
