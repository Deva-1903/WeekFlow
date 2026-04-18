"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TimeBlockType, TimeBlockStatus } from "@prisma/client";
import { startOfDay } from "date-fns";
import { getFixedCommitmentConflicts } from "@/lib/commitments";

const blockSchema = z.object({
  title: z.string().min(1),
  taskId: z.string().optional().nullable(),
  blockType: z.nativeEnum(TimeBlockType).default("DEEP_WORK"),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int().positive(),
  notes: z.string().optional(),
  status: z.nativeEnum(TimeBlockStatus).default("PLANNED"),
});

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function createTimeBlock(data: z.infer<typeof blockSchema>) {
  const userId = await getUser();
  const parsed = blockSchema.parse(data);
  const normalizedDate = startOfDay(new Date(parsed.date));
  const conflicts = await getFixedCommitmentConflicts(userId, {
    date: normalizedDate,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
  });

  const block = await prisma.timeBlock.create({
    data: {
      userId,
      ...parsed,
      date: normalizedDate,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "BLOCK_CREATED",
      entityId: block.id,
      entityType: "TimeBlock",
      metadata: { title: block.title },
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true, block, conflicts };
}

export async function updateTimeBlock(
  id: string,
  data: Partial<z.infer<typeof blockSchema>>
) {
  const userId = await getUser();
  const existing = await prisma.timeBlock.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");

  const normalizedDate = data.date
    ? startOfDay(new Date(data.date))
    : existing.date;
  const wasCompleted = existing.status === "COMPLETED";
  const isNowCompleted = data.status === "COMPLETED";
  const conflicts = await getFixedCommitmentConflicts(userId, {
    date: normalizedDate,
    startTime: data.startTime ?? existing.startTime,
    endTime: data.endTime ?? existing.endTime,
  });

  const block = await prisma.timeBlock.update({
    where: { id },
    data: {
      ...data,
      date: data.date ? normalizedDate : undefined,
    },
  });

  if (isNowCompleted && !wasCompleted) {
    await prisma.activityEvent.create({
      data: { userId, type: "BLOCK_COMPLETED", entityId: id, entityType: "TimeBlock", metadata: { title: block.title } },
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true, block, conflicts };
}

export async function deleteTimeBlock(id: string) {
  const userId = await getUser();
  await prisma.timeBlock.deleteMany({ where: { id, userId } });
  revalidatePath("/calendar");
  return { success: true };
}

export async function getTimeBlocksForDate(date: Date) {
  const userId = await getUser();
  const d = startOfDay(date);
  return prisma.timeBlock.findMany({
    where: { userId, date: d },
    include: { task: { select: { id: true, title: true, area: true } } },
    orderBy: { startTime: "asc" },
  });
}

export async function getTimeBlocksForWeek(weekStart: Date) {
  const userId = await getUser();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return prisma.timeBlock.findMany({
    where: { userId, date: { gte: weekStart, lte: weekEnd } },
    include: { task: { select: { id: true, title: true, area: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}
