import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd } from "@/lib/utils";
import { startOfDay, subDays } from "date-fns";
import { HealthLogClient } from "@/components/health/health-log-client";

export default async function HealthPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const today = startOfDay(new Date());
  const thirtyDaysAgo = subDays(today, 30);

  const [todayLog, recentLogs] = await Promise.all([
    prisma.healthLog.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
    prisma.healthLog.findMany({
      where: { userId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
    }),
  ]);

  return <HealthLogClient todayLog={todayLog} recentLogs={recentLogs} />;
}
