"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { getWeeklyCapacityBreakdown } from "@/lib/commitments";

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function getOrCreateWeeklyPlan(weekStartDate: Date) {
  const userId = await getUser();
  const weekStart = startOfDay(weekStartDate);

  const capacity = await getWeeklyCapacityBreakdown(userId, weekStart);

  const plan = await prisma.weeklyPlan.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: {
      userId,
      weekStart,
      availableMinutes: capacity.theoreticalMinutes,
      fixedCommitmentMinutes: capacity.fixedCommitmentMinutes,
      remainingFocusMinutes: capacity.remainingFocusMinutes,
    },
    update: {
      fixedCommitmentMinutes: capacity.fixedCommitmentMinutes,
      remainingFocusMinutes: capacity.remainingFocusMinutes,
    },
    include: {
      weeklyPlanTasks: { include: { task: true } },
    },
  });

  return plan;
}

export async function saveWeeklyPlan(
  weekStart: Date,
  data: {
    availableMinutes?: number;
    weeklyGoals?: string;
    reflectionWentWell?: string;
    reflectionSlipped?: string;
    reflectionChange?: string;
    notes?: string;
    taskIds?: string[];
  }
) {
  const userId = await getUser();
  const ws = startOfDay(weekStart);

  const plan = await prisma.weeklyPlan.upsert({
    where: { userId_weekStart: { userId, weekStart: ws } },
    create: {
      userId,
      weekStart: ws,
      availableMinutes: data.availableMinutes ?? 2400,
      weeklyGoals: data.weeklyGoals,
      reflectionWentWell: data.reflectionWentWell,
      reflectionSlipped: data.reflectionSlipped,
      reflectionChange: data.reflectionChange,
      notes: data.notes,
    },
    update: {
      availableMinutes: data.availableMinutes,
      weeklyGoals: data.weeklyGoals,
      reflectionWentWell: data.reflectionWentWell,
      reflectionSlipped: data.reflectionSlipped,
      reflectionChange: data.reflectionChange,
      notes: data.notes,
    },
  });

  const capacity = await getWeeklyCapacityBreakdown(userId, ws, {
    selectedTaskIds: data.taskIds,
    theoreticalMinutes: data.availableMinutes,
  });

  if (data.taskIds !== undefined) {
    // Sync plan tasks
    await prisma.weeklyPlanTask.deleteMany({ where: { weeklyPlanId: plan.id } });
    if (data.taskIds.length > 0) {
      await prisma.weeklyPlanTask.createMany({
        data: data.taskIds.map((taskId) => ({ weeklyPlanId: plan.id, taskId })),
      });
      // Move tasks to THIS_WEEK
      await prisma.task.updateMany({
        where: { id: { in: data.taskIds }, userId, status: "BACKLOG" },
        data: { status: "THIS_WEEK" },
      });
    }

    const totalMinutes = await prisma.task.aggregate({
      where: { id: { in: data.taskIds } },
      _sum: { estimatedMinutes: true },
    });

    await prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        committedMinutes: totalMinutes._sum.estimatedMinutes ?? 0,
        fixedCommitmentMinutes: capacity.fixedCommitmentMinutes,
        remainingFocusMinutes: capacity.remainingFocusMinutes,
      },
    });
  } else {
    await prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        fixedCommitmentMinutes: capacity.fixedCommitmentMinutes,
        remainingFocusMinutes: capacity.remainingFocusMinutes,
      },
    });
  }

  await prisma.activityEvent.create({
    data: { userId, type: "WEEKLY_PLAN_SAVED", entityId: plan.id, entityType: "WeeklyPlan" },
  });

  revalidatePath("/weekly-review");
  revalidatePath("/dashboard");
  return { success: true };
}
