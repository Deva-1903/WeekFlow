"use server";

import { FutureStatus, Priority, TaskArea, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/server-auth";
import { parseLocalDate } from "@/lib/timezone";

const futureItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  targetTimeframe: z.string().optional(),
  reviewDate: z.string().optional().nullable(),
  status: z.nativeEnum(FutureStatus).default("FUTURE"),
});

function revalidateFutureViews() {
  revalidatePath("/future");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/daily-planner");
  revalidatePath("/analytics");
}

export async function createFutureItem(data: z.input<typeof futureItemSchema>) {
  const userId = await requireUserId();
  const parsed = futureItemSchema.parse(data);

  const item = await prisma.futureItem.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      targetTimeframe: parsed.targetTimeframe,
      reviewDate: parsed.reviewDate ? parseLocalDate(parsed.reviewDate) : null,
      status: parsed.status,
    },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function updateFutureItem(
  id: string,
  data: Partial<z.input<typeof futureItemSchema>>
) {
  const userId = await requireUserId();
  const existing = await prisma.futureItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Future item not found");

  const parsed = futureItemSchema.partial().parse(data);
  const item = await prisma.futureItem.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      targetTimeframe: parsed.targetTimeframe,
      reviewDate:
        parsed.reviewDate !== undefined
          ? parsed.reviewDate
            ? parseLocalDate(parsed.reviewDate)
            : null
          : undefined,
      status: parsed.status,
    },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function updateFutureStatus(id: string, status: FutureStatus) {
  const userId = await requireUserId();
  const existing = await prisma.futureItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Future item not found");

  const item = await prisma.futureItem.update({
    where: { id },
    data: {
      status,
      ...(status === "DONE" ? { reviewDate: null } : {}),
    },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function promoteFutureItem(
  id: string,
  taskStatus: TaskStatus = "BACKLOG",
  priority: Priority = "MEDIUM"
) {
  const userId = await requireUserId();
  const item = await prisma.futureItem.findFirst({
    where: { id, userId },
    include: { promotedTask: true },
  });

  if (!item) throw new Error("Future item not found");

  if (item.promotedTask) {
    const task = await prisma.task.update({
      where: { id: item.promotedTask.id },
      data: { status: taskStatus, priority },
    });

    const updatedItem = await prisma.futureItem.update({
      where: { id },
      data: { status: "ACTIVE", promotedTaskId: task.id },
    });

    revalidateFutureViews();
    return { success: true, task, item: updatedItem };
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: item.title,
      description: item.description,
      area: item.category,
      status: taskStatus,
      priority,
      sourceType: "PROMOTED_FUTURE",
      promotedFromFutureId: item.id,
      reviewDate: item.reviewDate,
      notes: item.targetTimeframe
        ? `Promoted from Future · timeframe: ${item.targetTimeframe}`
        : "Promoted from Future",
    },
  });

  const updatedItem = await prisma.futureItem.update({
    where: { id },
    data: {
      status: "ACTIVE",
      promotedTaskId: task.id,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "FUTURE_PROMOTED",
      entityId: item.id,
      entityType: "FutureItem",
      metadata: { title: item.title, taskId: task.id },
    },
  });

  revalidateFutureViews();
  return { success: true, task, item: updatedItem };
}

export async function snoozeFutureItem(id: string, nextReviewDate: string) {
  const userId = await requireUserId();
  const existing = await prisma.futureItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Future item not found");

  const item = await prisma.futureItem.update({
    where: { id },
    data: { reviewDate: parseLocalDate(nextReviewDate) },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function clearFutureReviewDate(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.futureItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Future item not found");

  const item = await prisma.futureItem.update({
    where: { id },
    data: { reviewDate: null },
  });

  revalidateFutureViews();
  return { success: true, item };
}

