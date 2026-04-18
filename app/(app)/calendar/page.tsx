import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd } from "@/lib/utils";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { getFixedCommitmentsForRange } from "@/lib/commitments";
import { CalendarClient } from "@/components/calendar/calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  const [blocks, tasks, fixedCommitments] = await Promise.all([
    prisma.timeBlock.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      include: { task: { select: { id: true, title: true, area: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS", "BACKLOG"] },
      },
      orderBy: [{ priority: "desc" }],
      select: { id: true, title: true, area: true, estimatedMinutes: true, status: true },
    }),
    getFixedCommitmentsForRange(userId, weekStart, weekEnd),
  ]);

  return (
    <CalendarClient
      initialBlocks={blocks}
      availableTasks={tasks}
      fixedCommitments={fixedCommitments}
      weekStart={weekStart}
    />
  );
}
