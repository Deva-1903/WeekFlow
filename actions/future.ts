"use server";

import { SomedayStatus, TaskStatus, TaskArea } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/server-auth";

const somedaySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  roughEffort: z.string().optional(),
  targetTimeframe: z.string().optional(),
  reviewDate: z.string().optional().nullable(),
  isImportant: z.boolean().default(false),
  status: z.nativeEnum(SomedayStatus).default("SOMEDAY"),
});

function revalidateFutureViews() {
  revalidatePath("/future");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/weekly-review");
  revalidatePath("/analytics");
}

export async function createSomedayItem(data: z.input<typeof somedaySchema>) {
  const userId = await requireUserId();
  const parsed = somedaySchema.parse(data);

  const item = await prisma.somedayItem.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      roughEffort: parsed.roughEffort,
      targetTimeframe: parsed.targetTimeframe,
      reviewDate: parsed.reviewDate ? new Date(parsed.reviewDate) : null,
      isImportant: parsed.isImportant,
      status: parsed.status,
    },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function updateSomedayItem(
  id: string,
  data: Partial<z.input<typeof somedaySchema>>
) {
  const userId = await requireUserId();
  const existing = await prisma.somedayItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Future item not found");

  const parsed = somedaySchema.partial().parse(data);

  const item = await prisma.somedayItem.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      roughEffort: parsed.roughEffort,
      targetTimeframe: parsed.targetTimeframe,
      reviewDate:
        parsed.reviewDate !== undefined
          ? parsed.reviewDate
            ? new Date(parsed.reviewDate)
            : null
          : undefined,
      isImportant: parsed.isImportant,
      status: parsed.status,
    },
  });

  revalidateFutureViews();
  return { success: true, item };
}

export async function updateSomedayStatus(id: string, status: SomedayStatus) {
  const userId = await requireUserId();
  const item = await prisma.somedayItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error("Future item not found");

  const updated = await prisma.somedayItem.update({
    where: { id },
    data: {
      status,
      ...(status === "DONE" ? { reviewDate: null } : {}),
    },
  });

  revalidateFutureViews();
  return { success: true, item: updated };
}

export async function promoteSomedayItem(
  id: string,
  taskStatus: TaskStatus = "BACKLOG"
) {
  const userId = await requireUserId();
  const item = await prisma.somedayItem.findFirst({
    where: { id, userId },
    include: {
      generatedTask: true,
    },
  });

  if (!item) throw new Error("Future item not found");

  if (item.generatedTask) {
    const updatedTask = await prisma.task.update({
      where: { id: item.generatedTask.id },
      data: { status: taskStatus },
    });

    await prisma.somedayItem.update({
      where: { id },
      data: {
        status: "ACTIVE",
        promotedAt: item.promotedAt ?? new Date(),
        convertedTaskId: updatedTask.id,
      },
    });

    revalidateFutureViews();
    return { success: true, task: updatedTask };
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: item.title,
      description: item.description,
      area: item.category,
      status: taskStatus,
      sourceType: "PROMOTED_FROM_SOMEDAY",
      promotedFromSomedayId: item.id,
      reviewDate: item.reviewDate,
      notes: item.targetTimeframe
        ? `Promoted from Future · timeframe: ${item.targetTimeframe}`
        : "Promoted from Future",
    },
  });

  await prisma.somedayItem.update({
    where: { id },
    data: {
      status: "ACTIVE",
      promotedAt: new Date(),
      convertedTaskId: task.id,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "SOMEDAY_PROMOTED",
      entityId: item.id,
      entityType: "SomedayItem",
      metadata: { title: item.title },
    },
  });

  revalidateFutureViews();
  return { success: true, task };
}

export async function snoozeSomedayItem(id: string, nextReviewDate: string) {
  const userId = await requireUserId();
  const item = await prisma.somedayItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error("Future item not found");

  const updated = await prisma.somedayItem.update({
    where: { id },
    data: {
      reviewDate: new Date(nextReviewDate),
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "SOMEDAY_REVIEWED",
      entityId: item.id,
      entityType: "SomedayItem",
      metadata: { title: item.title },
    },
  });

  revalidateFutureViews();
  return { success: true, item: updated };
}

export async function markSomedayReviewedToday(id: string) {
  const userId = await requireUserId();
  const item = await prisma.somedayItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error("Future item not found");

  const updated = await prisma.somedayItem.update({
    where: { id },
    data: {
      reviewDate: null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "SOMEDAY_REVIEWED",
      entityId: item.id,
      entityType: "SomedayItem",
      metadata: { title: item.title },
    },
  });

  revalidateFutureViews();
  return { success: true, item: updated };
}
