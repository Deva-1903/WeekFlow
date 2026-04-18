-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'THIS_WEEK', 'TODAY', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskArea" AS ENUM ('COURSEWORK', 'RESEARCH', 'INTERNSHIP_PREP', 'PERSONAL', 'HEALTH', 'ADMIN', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TimeBlockType" AS ENUM ('DEEP_WORK', 'ADMIN', 'CLASS', 'EXERCISE', 'PERSONAL', 'SOCIAL', 'REST', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeBlockStatus" AS ENUM ('PLANNED', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('GYM', 'WALKING', 'SPORTS', 'RUN', 'CYCLING', 'YOGA', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_RESCHEDULED', 'TASK_ARCHIVED', 'TASK_MOVED', 'BLOCK_CREATED', 'BLOCK_COMPLETED', 'BLOCK_MISSED', 'HEALTH_LOGGED', 'WEEKLY_PLAN_SAVED', 'DAILY_PLAN_SAVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 2400,
    "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "bigRockLimit" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" "TaskArea" NOT NULL DEFAULT 'OTHER',
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "urgency" "Urgency" NOT NULL DEFAULT 'MEDIUM',
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "availableMinutes" INTEGER NOT NULL DEFAULT 2400,
    "committedMinutes" INTEGER NOT NULL DEFAULT 0,
    "weeklyGoals" TEXT,
    "reflectionWentWell" TEXT,
    "reflectionSlipped" TEXT,
    "reflectionChange" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plan_tasks" (
    "id" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_big_rocks" (
    "id" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_big_rocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_blocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "blockType" "TimeBlockType" NOT NULL DEFAULT 'DEEP_WORK',
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "TimeBlockStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "smokedToday" BOOLEAN NOT NULL DEFAULT false,
    "cigaretteCount" INTEGER,
    "drankAlcoholToday" BOOLEAN NOT NULL DEFAULT false,
    "alcoholCount" INTEGER,
    "didPhysicalActivityToday" BOOLEAN NOT NULL DEFAULT false,
    "activityType" "ActivityType",
    "activityDurationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_dueDate_idx" ON "tasks"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_userId_area_idx" ON "tasks"("userId", "area");

-- CreateIndex
CREATE INDEX "weekly_plans_userId_weekStart_idx" ON "weekly_plans"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_plans_userId_weekStart_key" ON "weekly_plans"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_plan_tasks_weeklyPlanId_taskId_key" ON "weekly_plan_tasks"("weeklyPlanId", "taskId");

-- CreateIndex
CREATE INDEX "daily_plans_userId_date_idx" ON "daily_plans"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_userId_date_key" ON "daily_plans"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_big_rocks_dailyPlanId_taskId_key" ON "daily_big_rocks"("dailyPlanId", "taskId");

-- CreateIndex
CREATE INDEX "time_blocks_userId_date_idx" ON "time_blocks"("userId", "date");

-- CreateIndex
CREATE INDEX "health_logs_userId_date_idx" ON "health_logs"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "health_logs_userId_date_key" ON "health_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "activity_events_userId_createdAt_idx" ON "activity_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan_tasks" ADD CONSTRAINT "weekly_plan_tasks_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan_tasks" ADD CONSTRAINT "weekly_plan_tasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_big_rocks" ADD CONSTRAINT "daily_big_rocks_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_big_rocks" ADD CONSTRAINT "daily_big_rocks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
