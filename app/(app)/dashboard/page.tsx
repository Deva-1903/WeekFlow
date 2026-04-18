import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd, formatDate, minutesToHours, AREA_COLORS } from "@/lib/utils";
import { getDailyCompletionData } from "@/lib/metrics";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { getFixedCommitmentsForRange, getWeeklyCapacityBreakdown } from "@/lib/commitments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { QuickAddTask } from "@/components/dashboard/quick-add-task";
import { QuickHealthLog } from "@/components/dashboard/quick-health-log";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ReviewReminders } from "@/components/dashboard/review-reminders";
import {
  CheckCircle2, AlertCircle, Clock, TrendingUp,
  RotateCcw, Cigarette, Wine, Dumbbell, Target, Calendar, CalendarClock
} from "lucide-react";
import { addDays, startOfDay, endOfDay, subDays } from "date-fns";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);

  const today = startOfDay(new Date());
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  const [
    tasksDueToday,
    tasksOverdue,
    weekTasks,
    todayBigRocks,
    todayHealthLog,
    recentEvents,
    completionData,
    upcomingDeadlines,
    todayFixedCommitments,
    upcomingFixedCommitments,
    futureReviewItems,
    futureItemsToRevisit,
    capacityBreakdown,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        dueDate: { gte: today, lte: endOfDay(today) },
        status: { notIn: ["DONE", "ARCHIVED", "SKIPPED"] },
      },
      orderBy: { priority: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        userId,
        dueDate: { lt: today },
        status: { notIn: ["DONE", "ARCHIVED", "SKIPPED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS", "DONE"] },
      },
    }),
    prisma.dailyPlan.findFirst({
      where: { userId, date: today },
      include: { bigRocks: { include: { task: true }, orderBy: { order: "asc" } } },
    }),
    prisma.healthLog.findFirst({ where: { userId, date: today } }),
    prisma.activityEvent.findMany({
      where: { userId, createdAt: { gte: subDays(new Date(), 3) } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getDailyCompletionData(userId, 7),
    prisma.task.findMany({
      where: {
        userId,
        dueDate: { gte: today, lte: subDays(today, -7) },
        status: { notIn: ["DONE", "ARCHIVED", "SKIPPED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    getFixedCommitmentsForRange(userId, today, endOfDay(today)),
    getFixedCommitmentsForRange(userId, today, endOfDay(addDays(today, 7))),
    prisma.somedayItem.findMany({
      where: {
        userId,
        status: { in: ["SOMEDAY", "ACTIVE"] },
        reviewDate: { not: null, lte: addDays(today, 7) },
      },
      orderBy: [{ reviewDate: "asc" }, { isImportant: "desc" }],
      take: 5,
    }),
    prisma.somedayItem.findMany({
      where: {
        userId,
        status: { in: ["SOMEDAY", "ACTIVE"] },
        OR: [
          { isImportant: true },
          { reviewDate: { not: null, lte: addDays(today, 21) } },
        ],
      },
      orderBy: [{ isImportant: "desc" }, { reviewDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    getWeeklyCapacityBreakdown(userId, weekStart),
  ]);

  const weekCompleted = weekTasks.filter((t) => t.status === "DONE");
  const completionRate = weekTasks.length > 0
    ? Math.round((weekCompleted.length / weekTasks.length) * 100)
    : 0;
  const weekPlannedMinutes = weekTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const upcomingImportedCommitments = upcomingFixedCommitments.filter(
    (item) => item.sourceType === "EXTERNAL_SYNC"
  );

  const rescheduledThisWeek = await prisma.activityEvent.count({
    where: { userId, type: "TASK_RESCHEDULED", createdAt: { gte: weekStart, lte: weekEnd } },
  });

  const statCards = [
    {
      label: "Due Today",
      value: tasksDueToday.length,
      icon: Calendar,
      color: tasksDueToday.length > 0 ? "#f59e0b" : "#10b981",
      href: "/tasks",
    },
    {
      label: "Overdue",
      value: tasksOverdue.length,
      icon: AlertCircle,
      color: tasksOverdue.length > 0 ? "#ef4444" : "#10b981",
      href: "/tasks",
    },
    {
      label: "Week Completed",
      value: weekCompleted.length,
      icon: CheckCircle2,
      color: "#6366f1",
      href: "/tasks",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: completionRate >= 70 ? "#10b981" : completionRate >= 40 ? "#f59e0b" : "#ef4444",
      href: "/analytics",
    },
    {
      label: "Planned Hours",
      value: minutesToHours(weekPlannedMinutes),
      icon: Clock,
      color: "#64748b",
      href: "/weekly-review",
    },
    {
      label: "Rescheduled",
      value: rescheduledThisWeek,
      icon: RotateCcw,
      color: rescheduledThisWeek > 3 ? "#f97316" : "#64748b",
      href: "/analytics",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {formatDate(new Date())} · Week of {formatDate(weekStart)}
          </p>
        </div>
        <QuickAddTask />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-4 w-4" style={{ color: card.color }} />
                  </div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {card.value}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{card.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Big Rocks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[var(--primary)]" />
                  Big Rocks Today
                </CardTitle>
                <Link href="/daily-planner" className="text-xs text-[var(--primary)] hover:underline">
                  Plan day →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todayBigRocks?.bigRocks.length ? (
                <div className="space-y-2">
                  {todayBigRocks.bigRocks.map((br) => (
                    <div key={br.id} className="flex items-center gap-3 p-2.5 rounded-md bg-[var(--muted)]/50">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${br.completed ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"}`}>
                        {br.completed && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm flex-1 ${br.completed ? "line-through text-[var(--muted-foreground)]" : ""}`}>
                        {br.task.title}
                      </span>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: AREA_COLORS[br.task.area] }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-[var(--muted-foreground)]">No big rocks set for today.</p>
                  <Link href="/daily-planner" className="text-xs text-[var(--primary)] hover:underline mt-1 block">
                    Set your focus for today →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
                Weekly Load Reality Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[var(--muted)]/40 p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Theoretical focus</div>
                  <div className="text-lg font-semibold">{minutesToHours(capacityBreakdown.theoreticalMinutes)}</div>
                </div>
                <div className="rounded-md bg-[var(--muted)]/40 p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Fixed commitments</div>
                  <div className="text-lg font-semibold text-sky-600">{minutesToHours(capacityBreakdown.fixedCommitmentMinutes)}</div>
                </div>
                <div className="rounded-md bg-[var(--muted)]/40 p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Remaining focus</div>
                  <div className="text-lg font-semibold text-emerald-600">{minutesToHours(capacityBreakdown.remainingFocusMinutes)}</div>
                </div>
                <div className="rounded-md bg-[var(--muted)]/40 p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Committed tasks</div>
                  <div className={`text-lg font-semibold ${capacityBreakdown.isOverloaded ? "text-red-500" : "text-[var(--foreground)]"}`}>
                    {minutesToHours(capacityBreakdown.committedTaskMinutes)}
                  </div>
                </div>
              </div>
              <p className={`text-sm ${
                capacityBreakdown.isOverloaded ? "text-red-500" : "text-[var(--muted-foreground)]"
              }`}>
                {capacityBreakdown.isOverloaded
                  ? `Overloaded by ${minutesToHours(capacityBreakdown.overloadMinutes)}.`
                  : "The week fits inside the remaining focus room."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[var(--primary)]" />
                Upcoming Fixed Commitments Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayFixedCommitments.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No fixed commitments imported for today.
                </p>
              ) : (
                <div className="space-y-2">
                  {todayFixedCommitments.map((commitment) => (
                    <div key={commitment.id} className="flex items-center gap-3 rounded-md bg-[var(--muted)]/40 p-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: commitment.color ?? "#94a3b8" }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{commitment.title}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {commitment.startTime} - {commitment.endTime}
                        </div>
                      </div>
                      <Badge variant={commitment.affectsCapacity ? "secondary" : "outline"} className="text-[10px]">
                        {commitment.secondaryLabel ?? "Fixed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <DashboardCharts completionData={completionData} />

          {/* Tasks due today */}
          {(tasksDueToday.length > 0 || tasksOverdue.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {tasksOverdue.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-[var(--muted)]/50 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span className="text-sm flex-1 truncate">{task.title}</span>
                      <Badge variant="destructive" className="text-xs shrink-0">overdue</Badge>
                    </div>
                  ))}
                  {tasksDueToday.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-[var(--muted)]/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-sm flex-1 truncate">{task.title}</span>
                      <Badge variant="warning" className="text-xs shrink-0">today</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ReviewReminders items={futureReviewItems} />

          {/* Health today */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Today&apos;s Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Cigarette className={`h-4 w-4 ${todayHealthLog?.smokedToday === false ? "text-emerald-500" : todayHealthLog?.smokedToday ? "text-red-400" : "text-[var(--muted-foreground)]"}`} />
                <span className="text-sm">Smoke-free</span>
                <span className="ml-auto text-xs font-medium">
                  {todayHealthLog == null ? "—" : todayHealthLog.smokedToday ? "No" : "Yes"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Wine className={`h-4 w-4 ${todayHealthLog?.drankAlcoholToday === false ? "text-emerald-500" : todayHealthLog?.drankAlcoholToday ? "text-amber-400" : "text-[var(--muted-foreground)]"}`} />
                <span className="text-sm">Alcohol-free</span>
                <span className="ml-auto text-xs font-medium">
                  {todayHealthLog == null ? "—" : todayHealthLog.drankAlcoholToday ? "No" : "Yes"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Dumbbell className={`h-4 w-4 ${todayHealthLog?.didPhysicalActivityToday ? "text-emerald-500" : todayHealthLog?.didPhysicalActivityToday === false ? "text-[var(--muted-foreground)]" : "text-[var(--muted-foreground)]"}`} />
                <span className="text-sm">Moved today</span>
                <span className="ml-auto text-xs font-medium">
                  {todayHealthLog == null ? "—" : todayHealthLog.didPhysicalActivityToday ? "Yes" : "No"}
                </span>
              </div>
              <QuickHealthLog
                existing={todayHealthLog ? {
                  smokedToday: todayHealthLog.smokedToday,
                  drankAlcoholToday: todayHealthLog.drankAlcoholToday,
                  didPhysicalActivityToday: todayHealthLog.didPhysicalActivityToday,
                } : undefined}
              />
            </CardContent>
          </Card>

          {/* Recent activity */}
          <RecentActivity events={recentEvents} />

          {futureItemsToRevisit.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Future Items To Revisit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {futureItemsToRevisit.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isImportant ? "bg-red-400" : "bg-[var(--primary)]"}`} />
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.reviewDate && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(item.reviewDate)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/future" className="text-xs text-[var(--primary)] hover:underline mt-3 inline-block">
                  Open Future →
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Upcoming deadlines */}
          {upcomingDeadlines.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingDeadlines.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: AREA_COLORS[task.area] }} />
                      <span className="flex-1 truncate">{task.title}</span>
                      <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                        {task.dueDate ? formatDate(task.dueDate) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {upcomingImportedCommitments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Next Imported Commitments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingImportedCommitments.slice(0, 5).map((commitment) => (
                    <div key={commitment.id} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: commitment.color ?? "#0ea5e9" }} />
                      <span className="flex-1 truncate">{commitment.title}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(commitment.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
