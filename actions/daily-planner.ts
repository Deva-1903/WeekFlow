"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { startOfDayTZ, toLocalDateKey, todayTZ } from "@/lib/timezone";

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function getOrCreateDailyPlan(date: Date) {
  const userId = await getUser();
  const d = startOfDayTZ(date);

  return prisma.dailyPlan.upsert({
    where: { userId_date: { userId, date: d } },
    create: { userId, date: d },
    update: {},
    include: {
      bigRocks: {
        include: { task: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function saveDailyPlan(
  date: Date,
  data: {
    notes?: string;
    taskIds?: string[];
    items?: { taskId: string; isTopPriority?: boolean }[];
  }
) {
  const userId = await getUser();
  const d = startOfDayTZ(date);
  const isTomorrowPlan = toLocalDateKey(d) !== toLocalDateKey(todayTZ());

  const plan = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId, date: d } },
    create: { userId, date: d, notes: data.notes },
    update: { notes: data.notes },
  });

  const newItems = data.items ?? data.taskIds?.map((taskId, index) => ({
    taskId,
    isTopPriority: index < 3,
  }));

  if (newItems !== undefined) {
    const taskIds = newItems.map((item) => item.taskId);
    await prisma.dailyPlanItem.deleteMany({ where: { dailyPlanId: plan.id } });
    await prisma.dailyBigRock.deleteMany({ where: { dailyPlanId: plan.id } });
    if (newItems.length > 0) {
      await prisma.dailyPlanItem.createMany({
        data: newItems.map((item, i) => ({
          dailyPlanId: plan.id,
          taskId: item.taskId,
          order: i,
          isTopPriority: Boolean(item.isTopPriority),
        })),
      });
      await prisma.dailyBigRock.createMany({
        data: taskIds.slice(0, 3).map((taskId, i) => ({
          dailyPlanId: plan.id,
          taskId,
          order: i,
        })),
      });
      await prisma.task.updateMany({
        where: {
          id: { in: taskIds },
          userId,
          status: { in: ["BACKLOG", "ACTIVE", "THIS_WEEK", "TODAY"] },
        },
        data: { status: isTomorrowPlan ? "TOMORROW" : "TODAY" },
      });
    }
  }

  await prisma.activityEvent.create({
    data: { userId, type: "DAILY_PLAN_SAVED", entityId: plan.id, entityType: "DailyPlan" },
  });

  revalidatePath("/daily-planner");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeBigRock(bigRockId: string) {
  const userId = await getUser();

  const bigRock = await prisma.dailyBigRock.findFirst({
    where: { id: bigRockId, dailyPlan: { userId } },
  });
  if (!bigRock) throw new Error("Not found");

  const updated = await prisma.dailyBigRock.update({
    where: { id: bigRockId },
    data: { completed: !bigRock.completed, completedAt: !bigRock.completed ? new Date() : null },
  });

  revalidatePath("/daily-planner");
  revalidatePath("/dashboard");
  return { success: true, completed: updated.completed };
}

export async function completeDailyPlanItem(itemId: string) {
  const userId = await getUser();

  const item = await prisma.dailyPlanItem.findFirst({
    where: { id: itemId, dailyPlan: { userId } },
    include: { task: true },
  });
  if (!item) throw new Error("Not found");

  const completed = !item.completed;
  const updated = await prisma.dailyPlanItem.update({
    where: { id: itemId },
    data: { completed, completedAt: completed ? new Date() : null },
  });

  await prisma.task.update({
    where: { id: item.taskId },
    data: {
      status: completed ? "DONE" : "TOMORROW",
      completedAt: completed ? new Date() : null,
    },
  });

  revalidatePath("/daily-planner");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/analytics");
  return { success: true, completed: updated.completed };
}
