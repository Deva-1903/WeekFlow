"use server";

import {
  RoutineRecurrenceType,
  RoutineStrictnessMode,
  RoutineTargetPeriod,
  TaskArea,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateRoutineTasksForUser } from "@/lib/routines";
import { requireUserId } from "@/lib/server-auth";
import { parseLocalDate, todayTZ } from "@/lib/timezone";

const routineSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  recurrenceType: z.nativeEnum(RoutineRecurrenceType).default("WEEKLY"),
  targetCount: z.number().int().min(1).max(14).default(1),
  targetPeriod: z.nativeEnum(RoutineTargetPeriod).default("WEEK"),
  preferredDays: z.array(z.number().int().min(0).max(6)).default([]),
  preferredTime: z.string().optional(),
  strictnessMode: z.nativeEnum(RoutineStrictnessMode).default("FLEXIBLE"),
  generateTasks: z.boolean().default(false),
  defaultTaskTitle: z.string().optional(),
  defaultTaskCategory: z.nativeEnum(TaskArea).optional().nullable(),
  defaultEffortEstimate: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
});

function revalidateRoutineViews() {
  revalidatePath("/routines");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/daily-planner");
  revalidatePath("/analytics");
}

export async function createRoutine(data: z.input<typeof routineSchema>) {
  const userId = await requireUserId();
  const parsed = routineSchema.parse(data);

  const routine = await prisma.recurringRoutine.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      recurrenceType: parsed.recurrenceType,
      targetCount: parsed.targetCount,
      targetPeriod: parsed.targetPeriod,
      preferredDays: parsed.preferredDays,
      preferredTime: parsed.preferredTime,
      strictnessMode: parsed.strictnessMode,
      generateTasks: parsed.generateTasks,
      defaultTaskTitle: parsed.defaultTaskTitle,
      defaultTaskCategory: parsed.defaultTaskCategory,
      defaultEffortEstimate: parsed.defaultEffortEstimate,
      isActive: parsed.isActive,
    },
  });

  if (routine.generateTasks) {
    await generateRoutineTasksForUser(userId, { routineId: routine.id });
  }

  revalidateRoutineViews();
  return { success: true, routine };
}

export async function updateRoutine(
  id: string,
  data: Partial<z.input<typeof routineSchema>>
) {
  const userId = await requireUserId();
  const existing = await prisma.recurringRoutine.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Routine not found");

  const parsed = routineSchema.partial().parse(data);
  const routine = await prisma.recurringRoutine.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      recurrenceType: parsed.recurrenceType,
      targetCount: parsed.targetCount,
      targetPeriod: parsed.targetPeriod,
      preferredDays: parsed.preferredDays,
      preferredTime: parsed.preferredTime,
      strictnessMode: parsed.strictnessMode,
      generateTasks: parsed.generateTasks,
      defaultTaskTitle: parsed.defaultTaskTitle,
      defaultTaskCategory: parsed.defaultTaskCategory,
      defaultEffortEstimate: parsed.defaultEffortEstimate,
      isActive: parsed.isActive,
    },
  });

  if (routine.generateTasks) {
    await generateRoutineTasksForUser(userId, { routineId: routine.id });
  }

  revalidateRoutineViews();
  return { success: true, routine };
}

export async function toggleRoutineActive(id: string, isActive: boolean) {
  const userId = await requireUserId();
  const routine = await prisma.recurringRoutine.updateMany({
    where: { id, userId },
    data: { isActive },
  });

  if (routine.count === 0) throw new Error("Routine not found");
  revalidateRoutineViews();
  return { success: true };
}

export async function deleteRoutine(id: string) {
  const userId = await requireUserId();
  await prisma.recurringRoutine.deleteMany({ where: { id, userId } });
  revalidateRoutineViews();
  return { success: true };
}

export async function logRoutineSession(
  routineId: string,
  data?: { date?: string; notes?: string; linkedTaskId?: string }
) {
  const userId = await requireUserId();
  const routine = await prisma.recurringRoutine.findFirst({
    where: { id: routineId, userId },
  });
  if (!routine) throw new Error("Routine not found");

  const date = data?.date ? parseLocalDate(data.date) : todayTZ();
  const session = await prisma.routineSession.create({
    data: {
      userId,
      routineId,
      date,
      completed: true,
      notes: data?.notes,
      linkedTaskId: data?.linkedTaskId,
    },
  });

  if (data?.linkedTaskId) {
    await prisma.task.updateMany({
      where: { id: data.linkedTaskId, userId },
      data: { status: "DONE", completedAt: new Date() },
    });
  }

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "ROUTINE_LOGGED",
      entityId: routineId,
      entityType: "RecurringRoutine",
      metadata: { title: routine.title, date: date.toISOString() },
    },
  });

  revalidateRoutineViews();
  return { success: true, session };
}

export async function generateRoutineTasksNow(routineId?: string) {
  const userId = await requireUserId();
  const result = await generateRoutineTasksForUser(userId, { routineId });
  revalidateRoutineViews();
  return { success: true, ...result };
}

