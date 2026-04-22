import Link from "next/link";
import { addDays, subDays } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { generateRoutineTasksForUser } from "@/lib/routines";
import { endOfDayTZ, endOfWeekTZ, startOfWeekTZ, todayTZ } from "@/lib/timezone";
import { AREA_COLORS, AREA_LABELS, formatDate, formatDateShort, minutesToHours } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickAddTask } from "@/components/dashboard/quick-add-task";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Inbox,
  ListTodo,
  Repeat,
  Sparkles,
  Target,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);
  await generateRoutineTasksForUser(userId);

  const today = todayTZ();
  const weekStart = startOfWeekTZ();
  const weekEnd = endOfWeekTZ();

  const [
    inboxCount,
    todayPlan,
    overdueTasks,
    activeTasks,
    completedThisWeek,
    routines,
    futureReviewItems,
    journalToday,
    recentCompletions,
  ] = await Promise.all([
    prisma.inboxItem.count({
      where: { userId, archived: false, processedAt: null },
    }),
    prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: today } },
      include: {
        items: { include: { task: true }, orderBy: { order: "asc" } },
        bigRocks: { include: { task: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        dueDate: { lt: today },
        status: { notIn: ["DONE", "ARCHIVED", "DROPPED", "SKIPPED"] },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "TOMORROW", "IN_PROGRESS", "THIS_WEEK", "TODAY"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 8,
    }),
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    prisma.recurringRoutine.findMany({
      where: { userId, isActive: true },
      include: {
        sessions: {
          where: { date: { gte: weekStart, lte: weekEnd } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    prisma.futureItem.findMany({
      where: {
        userId,
        status: { in: ["FUTURE", "ACTIVE"] },
        reviewDate: { not: null, lte: endOfDayTZ(addDays(today, 7)) },
      },
      orderBy: [{ reviewDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.journalEntry.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: subDays(today, 7) },
      },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
  ]);

  const plannedToday = todayPlan?.items?.length
    ? todayPlan.items
    : todayPlan?.bigRocks?.map((item) => ({
        id: item.id,
        taskId: item.taskId,
        task: item.task,
        completed: item.completed,
        isTopPriority: true,
      })) ?? [];

  const activeEstimate = activeTasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  const routineProgress = routines.map((routine) => ({
    ...routine,
    progress: Math.min(100, Math.round((routine.sessions.length / Math.max(1, routine.targetCount)) * 100)),
  }));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {formatDate(today)} · list-first clarity for the next move
          </p>
        </div>
        <QuickAddTask />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Inbox", value: inboxCount, icon: Inbox, href: "/inbox", color: inboxCount ? "#f59e0b" : "#10b981" },
          { label: "Planned Today", value: plannedToday.length, icon: Target, href: "/daily-planner", color: "#6366f1" },
          { label: "Overdue", value: overdueTasks.length, icon: AlertCircle, href: "/tasks", color: overdueTasks.length ? "#ef4444" : "#10b981" },
          { label: "Done This Week", value: completedThisWeek, icon: CheckCircle2, href: "/analytics", color: "#10b981" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Icon className="h-4 w-4 mb-2" style={{ color: stat.color }} />
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{stat.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[var(--primary)]" />
                  Top Priorities Today
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/daily-planner">Plan tomorrow</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plannedToday.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center">
                  <p className="text-sm text-[var(--muted-foreground)]">No plan for today yet.</p>
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/daily-planner">Choose tomorrow&apos;s focus</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {plannedToday.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-md bg-[var(--muted)]/40 p-3">
                      <CheckCircle2 className={`h-4 w-4 ${item.completed ? "text-emerald-500" : "text-[var(--muted-foreground)]"}`} />
                      <span className={`text-sm flex-1 ${item.completed ? "line-through text-[var(--muted-foreground)]" : ""}`}>
                        {item.task.title}
                      </span>
                      {"isTopPriority" in item && item.isTopPriority && <Badge variant="outline" className="text-[10px]">top</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-[var(--primary)]" />
                  Active Work
                </CardTitle>
                <Badge variant="secondary">{activeEstimate ? minutesToHours(activeEstimate) : "No estimate"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activeTasks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">No active tasks. The inbox is the front door.</p>
              ) : (
                <div className="space-y-2">
                  {activeTasks.map((task) => (
                    <Link key={task.id} href="/tasks" className="flex items-center gap-3 rounded-md border border-[var(--border)] p-3 hover:bg-[var(--muted)]/40 transition-colors">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: AREA_COLORS[task.area] }} />
                      <span className="text-sm flex-1">{task.title}</span>
                      <Badge variant="outline" className="text-[10px]">{AREA_LABELS[task.area]}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {overdueTasks.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Overdue / Urgent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-md bg-red-50 p-3">
                    <span className="text-sm">{task.title}</span>
                    {task.dueDate && <span className="text-xs text-red-600">{formatDateShort(task.dueDate)}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-[var(--primary)]" />
                  Routines This Week
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/routines">Open</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {routineProgress.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No routines yet.</p>
              ) : (
                <div className="space-y-3">
                  {routineProgress.map((routine) => (
                    <div key={routine.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{routine.title}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">{routine.sessions.length}/{routine.targetCount}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${routine.progress}%`, backgroundColor: AREA_COLORS[routine.category] ?? "#6366f1" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                  Future Items To Revisit
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/future">Open</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {futureReviewItems.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No future reviews due soon.</p>
              ) : (
                <div className="space-y-2">
                  {futureReviewItems.map((item) => (
                    <Link key={item.id} href="/future" className="block rounded-md border border-[var(--border)] p-3 hover:bg-[var(--muted)]/40 transition-colors">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.reviewDate && <p className="text-xs text-[var(--muted-foreground)] mt-1">Review {formatDateShort(item.reviewDate)}</p>}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--primary)]" />
                Brain Dump
              </CardTitle>
            </CardHeader>
            <CardContent>
              {journalToday ? (
                <p className="text-sm text-[var(--muted-foreground)] line-clamp-3">
                  {journalToday.brainDump || journalToday.freeformText || journalToday.bestMoment || "Journal started for today."}
                </p>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">No journal entry yet today.</p>
              )}
              <Button asChild size="sm" className="mt-3">
                <Link href="/journal">{journalToday ? "Continue journal" : "Start brain dump"}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent Completions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCompletions.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No completions in the last week.</p>
              ) : (
                <div className="space-y-2">
                  {recentCompletions.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="line-clamp-1">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
