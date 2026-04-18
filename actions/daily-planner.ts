"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function getOrCreateDailyPlan(date: Date) {
  const userId = await getUser();
  const d = startOfDay(date);

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
  data: { notes?: string; taskIds?: string[] }
) {
  const userId = await getUser();
  const d = startOfDay(date);

  const plan = await prisma.dailyPlan.upsert({
    where: { userId_date: { userId, date: d } },
    create: { userId, date: d, notes: data.notes },
    update: { notes: data.notes },
  });

  if (data.taskIds !== undefined) {
    await prisma.dailyBigRock.deleteMany({ where: { dailyPlanId: plan.id } });
    if (data.taskIds.length > 0) {
      await prisma.dailyBigRock.createMany({
        data: data.taskIds.map((taskId, i) => ({
          dailyPlanId: plan.id,
          taskId,
          order: i,
        })),
      });
      // Move tasks to TODAY
      await prisma.task.updateMany({
        where: {
          id: { in: data.taskIds },
          userId,
          status: { in: ["BACKLOG", "THIS_WEEK"] },
        },
        data: { status: "TODAY" },
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
