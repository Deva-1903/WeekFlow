import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRoutineTasksForUser } from "@/lib/routines";
import { endOfWeekTZ, startOfWeekTZ } from "@/lib/timezone";
import { RoutinesClient } from "@/components/routines/routines-client";

export default async function RoutinesPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRoutineTasksForUser(userId);

  const weekStart = startOfWeekTZ();
  const weekEnd = endOfWeekTZ();

  const routines = await prisma.recurringRoutine.findMany({
    where: { userId },
    include: {
      sessions: {
        where: { date: { gte: weekStart, lte: weekEnd } },
        orderBy: { createdAt: "desc" },
      },
      generatedTasks: {
        where: {
          createdAt: { gte: weekStart },
          status: { notIn: ["ARCHIVED", "DROPPED"] },
        },
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return <RoutinesClient initialRoutines={routines} />;
}
