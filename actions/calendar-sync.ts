"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncGoogleCalendarConnection, syncGoogleCalendarsForUser } from "@/lib/calendar-sync";
import { requireUserId } from "@/lib/server-auth";

const calendarPreferenceSchema = z.object({
  isSelected: z.boolean().optional(),
  affectsCapacity: z.boolean().optional(),
});

function revalidateCalendarViews() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/weekly-review");
  revalidatePath("/analytics");
}

export async function syncCalendarsNow() {
  const userId = await requireUserId();
  const results = await syncGoogleCalendarsForUser(userId);
  revalidateCalendarViews();

  return {
    success: true,
    connectionCount: results.length,
    syncedEventCount: results.reduce((sum, item) => sum + item.syncedEventCount, 0),
  };
}

export async function syncCalendarConnectionNow(connectionId: string) {
  const userId = await requireUserId();
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) throw new Error("Calendar connection not found");

  const result = await syncGoogleCalendarConnection(connection.id);
  revalidateCalendarViews();
  return { success: true, syncedEventCount: result.syncedEventCount };
}

export async function updateExternalCalendarPreferences(
  calendarId: string,
  data: z.input<typeof calendarPreferenceSchema>
) {
  const userId = await requireUserId();
  const parsed = calendarPreferenceSchema.parse(data);

  const calendar = await prisma.externalCalendar.findFirst({
    where: { id: calendarId, userId },
  });

  if (!calendar) {
    throw new Error("External calendar not found");
  }

  const updated = await prisma.externalCalendar.update({
    where: { id: calendarId },
    data: parsed,
  });

  if (parsed.affectsCapacity !== undefined) {
    await prisma.externalEvent.updateMany({
      where: { calendarId },
      data: { affectsCapacity: parsed.affectsCapacity },
    });
  }

  revalidateCalendarViews();
  return { success: true, calendar: updated };
}
