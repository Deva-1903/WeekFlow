"use server";

import { InboxConvertedType, Priority, TaskArea, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/server-auth";
import { parseLocalDate, todayTZ } from "@/lib/timezone";

const captureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  note: z.string().optional(),
});

const taskConversionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  area: z.nativeEnum(TaskArea).default("OTHER"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  status: z.nativeEnum(TaskStatus).default("BACKLOG"),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

const futureConversionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  targetTimeframe: z.string().optional(),
  reviewDate: z.string().optional().nullable(),
});

function revalidateInboxViews() {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/future");
  revalidatePath("/journal");
  revalidatePath("/analytics");
}

async function markProcessed(
  id: string,
  convertedToType: InboxConvertedType,
  convertedToId?: string
) {
  const userId = await requireUserId();
  const item = await prisma.inboxItem.update({
    where: { id },
    data: {
      processedAt: new Date(),
      convertedToType,
      convertedToId,
      archived: true,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "INBOX_PROCESSED",
      entityId: item.id,
      entityType: "InboxItem",
      metadata: { title: item.title, convertedToType, convertedToId },
    },
  });

  return item;
}

export async function createInboxItem(data: z.input<typeof captureSchema>) {
  const userId = await requireUserId();
  const parsed = captureSchema.parse(data);

  const item = await prisma.inboxItem.create({
    data: {
      userId,
      title: parsed.title,
      note: parsed.note,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "INBOX_CAPTURED",
      entityId: item.id,
      entityType: "InboxItem",
      metadata: { title: item.title },
    },
  });

  revalidateInboxViews();
  return { success: true, item };
}

export async function processInboxToTask(
  id: string,
  data: z.input<typeof taskConversionSchema>
) {
  const userId = await requireUserId();
  const item = await prisma.inboxItem.findFirst({ where: { id, userId } });
  if (!item || item.archived || item.processedAt) throw new Error("Inbox item not available");

  const parsed = taskConversionSchema.parse(data);
  const task = await prisma.task.create({
    data: {
      userId,
      title: parsed.title || item.title,
      description: parsed.description || item.note,
      area: parsed.area,
      priority: parsed.priority,
      status: parsed.status,
      estimatedMinutes: parsed.estimatedMinutes,
      dueDate: parsed.dueDate ? parseLocalDate(parsed.dueDate) : null,
      sourceType: "INBOX",
    },
  });

  await markProcessed(id, "TASK", task.id);
  revalidateInboxViews();
  return { success: true, task };
}

export async function processInboxToFuture(
  id: string,
  data: z.input<typeof futureConversionSchema>
) {
  const userId = await requireUserId();
  const item = await prisma.inboxItem.findFirst({ where: { id, userId } });
  if (!item || item.archived || item.processedAt) throw new Error("Inbox item not available");

  const parsed = futureConversionSchema.parse(data);
  const futureItem = await prisma.futureItem.create({
    data: {
      userId,
      title: parsed.title || item.title,
      description: parsed.description || item.note,
      category: parsed.category,
      targetTimeframe: parsed.targetTimeframe,
      reviewDate: parsed.reviewDate ? parseLocalDate(parsed.reviewDate) : null,
      status: "FUTURE",
    },
  });

  await markProcessed(id, "FUTURE", futureItem.id);
  revalidateInboxViews();
  return { success: true, item: futureItem };
}

export async function processInboxToJournal(id: string) {
  const userId = await requireUserId();
  const item = await prisma.inboxItem.findFirst({ where: { id, userId } });
  if (!item || item.archived || item.processedAt) throw new Error("Inbox item not available");

  const today = todayTZ();
  const existing = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const entryText = [`- ${item.title}`, item.note ? `  ${item.note}` : ""].filter(Boolean).join("\n");
  const journal = await prisma.journalEntry.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      title: "Inbox captures",
      brainDump: entryText,
    },
    update: {
      brainDump: [existing?.brainDump, entryText].filter(Boolean).join("\n"),
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "JOURNAL_SAVED",
      entityId: journal.id,
      entityType: "JournalEntry",
      metadata: { source: "inbox", title: item.title },
    },
  });

  await markProcessed(id, "JOURNAL", journal.id);
  revalidateInboxViews();
  return { success: true, entry: journal };
}

export async function discardInboxItem(id: string) {
  await markProcessed(id, "DISCARD");
  revalidateInboxViews();
  return { success: true };
}

export async function archiveInboxItem(id: string) {
  const userId = await requireUserId();
  await prisma.inboxItem.updateMany({
    where: { id, userId },
    data: { archived: true },
  });
  revalidateInboxViews();
  return { success: true };
}

