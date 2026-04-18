import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd } from "@/lib/utils";
import { WeeklyReviewClient } from "@/components/weekly-review/weekly-review-client";
import { subDays } from "date-fns";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { getWeeklyCapacityBreakdown } from "@/lib/commitments";

export default async function WeeklyReviewPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();
  const lastWeekStart = getWeekStart(subDays(weekStart, 7));
  const lastWeekEnd = getWeekEnd(subDays(weekStart, 7));

  const [user, currentPlan, backlogTasks, lastWeekCompleted, lastWeekRolledOver] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.weeklyPlan.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: { weeklyPlanTasks: { include: { task: true } } },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["BACKLOG", "THIS_WEEK", "TODAY", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: lastWeekStart, lte: lastWeekEnd },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS", "BACKLOG"] },
        createdAt: { lte: lastWeekEnd },
      },
      take: 10,
    }),
  ]);

  const capacityBreakdown = await getWeeklyCapacityBreakdown(userId, weekStart, {
    selectedTaskIds: currentPlan?.weeklyPlanTasks.map((item) => item.taskId),
  });

  return (
    <WeeklyReviewClient
      weekStart={weekStart}
      currentPlan={currentPlan ? {
        id: currentPlan.id,
        availableMinutes: currentPlan.availableMinutes,
        committedMinutes: currentPlan.committedMinutes,
        weeklyGoals: currentPlan.weeklyGoals,
        reflectionWentWell: currentPlan.reflectionWentWell,
        reflectionSlipped: currentPlan.reflectionSlipped,
        reflectionChange: currentPlan.reflectionChange,
        notes: currentPlan.notes,
        fixedCommitmentMinutes: currentPlan.fixedCommitmentMinutes,
        remainingFocusMinutes: currentPlan.remainingFocusMinutes,
        selectedTaskIds: currentPlan.weeklyPlanTasks.map((wpt) => wpt.taskId),
      } : null}
      availableTasks={backlogTasks}
      lastWeekCompleted={lastWeekCompleted}
      lastWeekRolledOver={lastWeekRolledOver}
      userCapacityMinutes={user?.weeklyCapacityMinutes ?? 2400}
      fixedCommitments={capacityBreakdown.commitments}
    />
  );
}
