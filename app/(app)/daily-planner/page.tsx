import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayTZ } from "@/lib/timezone";
import { DailyPlannerClient } from "@/components/daily-planner/daily-planner-client";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";

export default async function DailyPlannerPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);

  const today = todayTZ();

  const [dailyPlan, thisWeekTasks, user] = await Promise.all([
    prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: today } },
      include: {
        bigRocks: {
          include: { task: true },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { bigRockLimit: true } }),
  ]);

  return (
    <DailyPlannerClient
      date={today}
      dailyPlan={dailyPlan}
      availableTasks={thisWeekTasks}
      bigRockLimit={user?.bigRockLimit ?? 3}
    />
  );
}
