import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  startOfDayTZ,
  startOfWeekTZ,
  todayTZ,
  toLocalDateKey,
} from "@/lib/timezone";

function preferredDueDateForWeek(weekStart: Date, preferredDays: number[], index: number) {
  const fallbackOffset = Math.min(index, 6);
  const preferredDay = preferredDays[index % Math.max(preferredDays.length, 1)];
  const offset = preferredDay === undefined ? fallbackOffset : (preferredDay + 6) % 7;
  return startOfDayTZ(addDays(weekStart, offset));
}

export async function generateRoutineTasksForUser(
  userId: string,
  options?: { now?: Date; routineId?: string }
) {
  const now = options?.now ?? new Date();
  const today = todayTZ();
  const weekStart = startOfWeekTZ(now);

  const routines = await prisma.recurringRoutine.findMany({
    where: {
      userId,
      isActive: true,
      generateTasks: true,
      ...(options?.routineId ? { id: options.routineId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const candidates = routines.flatMap((routine) => {
    const count = Math.max(1, routine.targetCount);
    const taskTitle = routine.defaultTaskTitle || routine.title;
    const taskCategory = routine.defaultTaskCategory || routine.category;

    if (routine.targetPeriod === "DAY") {
      const key = `${toLocalDateKey(today)}:1`;
      return [{
        userId,
        title: taskTitle,
        description: routine.description,
        area: taskCategory,
        priority: "MEDIUM" as const,
        urgency: "MEDIUM" as const,
        estimatedMinutes: routine.defaultEffortEstimate,
        status: "ACTIVE" as const,
        dueDate: today,
        startDate: today,
        isRecurring: true,
        sourceType: "ROUTINE" as const,
        originRoutineId: routine.id,
        routinePeriodKey: key,
        notes: `Generated from routine: ${routine.title}`,
      }];
    }

    return Array.from({ length: count }, (_, index) => {
      const dueDate = preferredDueDateForWeek(weekStart, routine.preferredDays, index);
      const key = `${toLocalDateKey(weekStart)}:${index + 1}`;
      const numberedTitle = count > 1 ? `${taskTitle} ${index + 1}/${count}` : taskTitle;

      return {
        userId,
        title: numberedTitle,
        description: routine.description,
        area: taskCategory,
        priority: "MEDIUM" as const,
        urgency: "MEDIUM" as const,
        estimatedMinutes: routine.defaultEffortEstimate,
        status: "ACTIVE" as const,
        dueDate,
        startDate: dueDate,
        isRecurring: true,
        sourceType: "ROUTINE" as const,
        originRoutineId: routine.id,
        routinePeriodKey: key,
        notes: `Generated from routine: ${routine.title}`,
      };
    });
  });

  if (candidates.length === 0) {
    return { createdCount: 0, tasks: [] as Array<{ id: string; title: string }> };
  }

  await prisma.task.createMany({
    data: candidates,
    skipDuplicates: true,
  });

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      sourceType: "ROUTINE",
      OR: candidates.map((candidate) => ({
        originRoutineId: candidate.originRoutineId,
        routinePeriodKey: candidate.routinePeriodKey,
      })),
    },
    select: { id: true, title: true },
  });

  return { createdCount: tasks.length, tasks };
}

