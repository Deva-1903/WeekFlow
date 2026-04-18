import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, calendarConnections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        weeklyCapacityMinutes: true,
        workingDaysPerWeek: true,
        bigRockLimit: true,
        workdayStartTime: true,
        workdayEndTime: true,
      },
    }),
    prisma.calendarConnection.findMany({
      where: { userId },
      include: {
        externalCalendars: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <SettingsClient
      user={user!}
      googleCalendarConfigured={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      )}
      calendarConnections={calendarConnections}
    />
  );
}
