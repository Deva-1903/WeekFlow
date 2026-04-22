import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { endOfDayTZ, todayTZ } from "@/lib/timezone";
import { DailyPlannerClient } from "@/components/daily-planner/daily-planner-client";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { generateRoutineTasksForUser } from "@/lib/routines";
import { addDays } from "date-fns";

export default async function DailyPlannerPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);
  await generateRoutineTasksForUser(userId);

  const today = todayTZ();
  const tomorrow = addDays(today, 1);

  const [dailyPlan, candidateTasks, overdueTasks, user] = await Promise.all([
    prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: tomorrow } },
      include: {
        items: {
          include: { task: true },
          orderBy: { order: "asc" },
        },
        bigRocks: {
          include: { task: true },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "TOMORROW", "IN_PROGRESS", "BACKLOG", "THIS_WEEK"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 80,
    }),
    prisma.task.findMany({
      where: {
        userId,
        dueDate: { lt: today },
        status: { notIn: ["DONE", "ARCHIVED", "DROPPED", "SKIPPED"] },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 12,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { bigRockLimit: true } }),
  ]);

  return (
    <DailyPlannerClient
      date={tomorrow}
      today={today}
      dailyPlan={dailyPlan}
      availableTasks={candidateTasks}
      overdueTasks={overdueTasks.filter((task) => task.dueDate && task.dueDate < endOfDayTZ(today))}
      bigRockLimit={user?.bigRockLimit ?? 3}
    />
  );
}
