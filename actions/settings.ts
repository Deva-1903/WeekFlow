"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateUserSettings(data: {
  name?: string;
  weeklyCapacityMinutes?: number;
  workingDaysPerWeek?: number;
  bigRockLimit?: number;
  workdayStartTime?: string;
  workdayEndTime?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
