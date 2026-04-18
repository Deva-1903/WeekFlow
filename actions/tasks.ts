"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskStatus, TaskArea, Priority, Urgency } from "@prisma/client";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  area: z.nativeEnum(TaskArea).default("OTHER"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  urgency: z.nativeEnum(Urgency).default("MEDIUM"),
  estimatedMinutes: z.number().positive().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  reviewDate: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.nativeEnum(TaskStatus).default("BACKLOG"),
});

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function createTask(data: z.input<typeof taskSchema>) {
  const userId = await getUser();
  const parsed = taskSchema.parse(data);

  const task = await prisma.task.create({
    data: {
      userId,
      ...parsed,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      reviewDate: parsed.reviewDate ? new Date(parsed.reviewDate) : null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "TASK_CREATED",
      entityId: task.id,
      entityType: "Task",
      metadata: { title: task.title },
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true, task };
}

export async function updateTask(
  id: string,
  data: Partial<z.infer<typeof taskSchema>>
) {
  const userId = await getUser();

  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Task not found");

  const wasCompleted = existing.status === "DONE";
  const isNowCompleted = data.status === "DONE";
  const isNowRescheduled =
    data.status === "THIS_WEEK" &&
    (existing.status === "TODAY" || existing.status === "IN_PROGRESS");

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
      reviewDate: data.reviewDate !== undefined ? (data.reviewDate ? new Date(data.reviewDate) : null) : undefined,
      completedAt: isNowCompleted && !wasCompleted ? new Date() : wasCompleted && !isNowCompleted ? null : undefined,
    },
  });

  if (isNowCompleted && !wasCompleted) {
    await prisma.activityEvent.create({
      data: { userId, type: "TASK_COMPLETED", entityId: id, entityType: "Task", metadata: { title: task.title } },
    });
  }

  if (isNowRescheduled) {
    await prisma.activityEvent.create({
      data: { userId, type: "TASK_RESCHEDULED", entityId: id, entityType: "Task", metadata: { title: task.title } },
    });
  }

  if (data.status && data.status !== existing.status && !isNowCompleted && !isNowRescheduled) {
    await prisma.activityEvent.create({
      data: { userId, type: "TASK_MOVED", entityId: id, entityType: "Task", metadata: { title: task.title, from: existing.status, to: data.status } },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true, task };
}

export async function deleteTask(id: string) {
  const userId = await getUser();
  await prisma.task.deleteMany({ where: { id, userId } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function moveTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status });
}

export async function getTasks(filters?: {
  status?: TaskStatus | TaskStatus[];
  area?: TaskArea;
  search?: string;
}) {
  const userId = await getUser();

  const where: Record<string, unknown> = { userId };

  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters?.area) where.area = filters.area;

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.task.findMany({
    where,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
}
