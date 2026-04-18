"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { startOfDay } from "date-fns";

const healthLogSchema = z.object({
  date: z.string(),
  smokedToday: z.boolean().default(false),
  cigaretteCount: z.number().int().positive().optional().nullable(),
  drankAlcoholToday: z.boolean().default(false),
  alcoholCount: z.number().int().positive().optional().nullable(),
  didPhysicalActivityToday: z.boolean().default(false),
  activityType: z.nativeEnum(ActivityType).optional().nullable(),
  activityDurationMinutes: z.number().int().positive().optional().nullable(),
  notes: z.string().optional(),
});

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function upsertHealthLog(data: z.infer<typeof healthLogSchema>) {
  const userId = await getUser();
  const parsed = healthLogSchema.parse(data);
  const date = startOfDay(new Date(parsed.date));

  const log = await prisma.healthLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, ...parsed, date },
    update: { ...parsed, date },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "HEALTH_LOGGED",
      entityId: log.id,
      entityType: "HealthLog",
      metadata: {
        smoked: log.smokedToday,
        alcohol: log.drankAlcoholToday,
        activity: log.didPhysicalActivityToday,
      },
    },
  });

  revalidatePath("/health");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { success: true, log };
}

export async function getHealthLogs(startDate: Date, endDate: Date) {
  const userId = await getUser();
  return prisma.healthLog.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "desc" },
  });
}

export async function getHealthLogForDate(date: Date) {
  const userId = await getUser();
  const d = startOfDay(date);
  return prisma.healthLog.findUnique({ where: { userId_date: { userId, date: d } } });
}
