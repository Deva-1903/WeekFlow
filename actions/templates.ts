"use server";

import {
  CommitmentType,
  Priority,
  RecurringFrequency,
  TaskArea,
  TaskStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { requireUserId } from "@/lib/server-auth";

const recurringCommitmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(CommitmentType).default("OTHER"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  affectsCapacity: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

const recurringTaskTemplateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  area: z.nativeEnum(TaskArea).default("OTHER"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  recurrenceType: z.nativeEnum(RecurringFrequency).default("WEEKLY"),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  generateDaysAhead: z.number().int().min(0).max(90).default(14),
  defaultStatus: z.nativeEnum(TaskStatus).default("BACKLOG"),
  isActive: z.boolean().default(true),
});

function revalidateTemplateViews() {
  revalidatePath("/templates");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/weekly-review");
  revalidatePath("/analytics");
}

function buildRecurrenceConfig(
  data: z.infer<typeof recurringTaskTemplateSchema>
) {
  return {
    interval: data.interval,
    daysOfWeek: data.daysOfWeek,
    dayOfMonth: data.dayOfMonth ?? null,
    generateDaysAhead: data.generateDaysAhead,
  };
}

export async function createRecurringCommitmentTemplate(
  data: z.input<typeof recurringCommitmentSchema>
) {
  const userId = await requireUserId();
  const parsed = recurringCommitmentSchema.parse(data);

  const template = await prisma.recurringCommitmentTemplate.create({
    data: {
      userId,
      title: parsed.title,
      type: parsed.type,
      daysOfWeek: parsed.daysOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      affectsCapacity: parsed.affectsCapacity,
      isActive: parsed.isActive,
    },
  });

  revalidateTemplateViews();
  return { success: true, template };
}

export async function updateRecurringCommitmentTemplate(
  id: string,
  data: Partial<z.input<typeof recurringCommitmentSchema>>
) {
  const userId = await requireUserId();
  const existing = await prisma.recurringCommitmentTemplate.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new Error("Recurring commitment not found");

  const parsed = recurringCommitmentSchema.partial().parse(data);
  const template = await prisma.recurringCommitmentTemplate.update({
    where: { id },
    data: {
      title: parsed.title,
      type: parsed.type,
      daysOfWeek: parsed.daysOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      startDate:
        parsed.startDate !== undefined
          ? parsed.startDate
            ? new Date(parsed.startDate)
            : null
          : undefined,
      endDate:
        parsed.endDate !== undefined
          ? parsed.endDate
            ? new Date(parsed.endDate)
            : null
          : undefined,
      affectsCapacity: parsed.affectsCapacity,
      isActive: parsed.isActive,
    },
  });

  revalidateTemplateViews();
  return { success: true, template };
}

export async function deleteRecurringCommitmentTemplate(id: string) {
  const userId = await requireUserId();
  await prisma.recurringCommitmentTemplate.deleteMany({ where: { id, userId } });
  revalidateTemplateViews();
  return { success: true };
}

export async function createRecurringTaskTemplate(
  data: z.input<typeof recurringTaskTemplateSchema>
) {
  const userId = await requireUserId();
  const parsed = recurringTaskTemplateSchema.parse(data);

  const template = await prisma.recurringTaskTemplate.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      area: parsed.area,
      priority: parsed.priority,
      estimatedMinutes: parsed.estimatedMinutes,
      recurrenceType: parsed.recurrenceType,
      recurrenceConfig: buildRecurrenceConfig(parsed),
      defaultStatus: parsed.defaultStatus,
      isActive: parsed.isActive,
    },
  });

  revalidateTemplateViews();
  return { success: true, template };
}

export async function updateRecurringTaskTemplate(
  id: string,
  data: Partial<z.input<typeof recurringTaskTemplateSchema>>
) {
  const userId = await requireUserId();
  const existing = await prisma.recurringTaskTemplate.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new Error("Recurring task template not found");

  const parsed = recurringTaskTemplateSchema.partial().parse(data);
  const merged = recurringTaskTemplateSchema.parse({
    title: parsed.title ?? existing.title,
    description:
      parsed.description !== undefined ? parsed.description : existing.description ?? "",
    area: parsed.area ?? existing.area,
    priority: parsed.priority ?? existing.priority,
    estimatedMinutes:
      parsed.estimatedMinutes !== undefined
        ? parsed.estimatedMinutes
        : existing.estimatedMinutes,
    recurrenceType: parsed.recurrenceType ?? existing.recurrenceType,
    interval:
      parsed.interval ??
      ((existing.recurrenceConfig as { interval?: number }).interval ?? 1),
    daysOfWeek:
      parsed.daysOfWeek ??
      ((existing.recurrenceConfig as { daysOfWeek?: number[] }).daysOfWeek ?? []),
    dayOfMonth:
      parsed.dayOfMonth ??
      ((existing.recurrenceConfig as { dayOfMonth?: number | null }).dayOfMonth ??
        null),
    generateDaysAhead:
      parsed.generateDaysAhead ??
      ((existing.recurrenceConfig as { generateDaysAhead?: number }).generateDaysAhead ??
        14),
    defaultStatus: parsed.defaultStatus ?? existing.defaultStatus,
    isActive: parsed.isActive ?? existing.isActive,
  });

  const template = await prisma.recurringTaskTemplate.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      area: parsed.area,
      priority: parsed.priority,
      estimatedMinutes: parsed.estimatedMinutes,
      recurrenceType: parsed.recurrenceType,
      recurrenceConfig: buildRecurrenceConfig(merged),
      defaultStatus: parsed.defaultStatus,
      isActive: parsed.isActive,
    },
  });

  revalidateTemplateViews();
  return { success: true, template };
}

export async function deleteRecurringTaskTemplate(id: string) {
  const userId = await requireUserId();
  await prisma.recurringTaskTemplate.deleteMany({ where: { id, userId } });
  revalidateTemplateViews();
  return { success: true };
}

export async function generateRecurringTasksNow(templateId?: string) {
  const userId = await requireUserId();
  const result = await generateRecurringTasksForUser(userId, { templateId });
  revalidateTemplateViews();
  return { success: true, ...result };
}
