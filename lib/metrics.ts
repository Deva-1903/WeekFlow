import { prisma } from "./prisma";
import { getWeekStart, getWeekEnd, getDaysBack, getWeeksBack } from "./utils";
import { subDays, isWithinInterval } from "date-fns";
import { todayTZ, startOfDayTZ, endOfDayTZ, toLocalDateKey, APP_TIMEZONE } from "./timezone";
import { toZonedTime } from "date-fns-tz";
import {
  getCalendarConflictCount,
  getFixedCommitmentsForRange,
  sumCommitmentMinutes,
} from "./commitments";

// ─── Weekly Metrics ────────────────────────────────────────────────────────────

export async function getWeeklyMetrics(userId: string, weekStart: Date) {
  const weekEnd = getWeekEnd(weekStart);

  const [tasks, timeBlocks, bigRocks] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS"] } },
          {
            completedAt: { gte: weekStart, lte: weekEnd },
            status: "DONE",
          },
        ],
      },
    }),
    prisma.timeBlock.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.dailyBigRock.findMany({
      where: {
        dailyPlan: {
          userId,
          date: { gte: weekStart, lte: weekEnd },
        },
      },
    }),
  ]);

  const plannedTasks = tasks.filter((t) =>
    ["THIS_WEEK", "TODAY", "IN_PROGRESS", "DONE"].includes(t.status)
  );
  const completedTasks = tasks.filter((t) => t.status === "DONE");
  const plannedMinutes = plannedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? 0),
    0
  );
  const completedBlocks = timeBlocks.filter((b) => b.status === "COMPLETED");
  const actualMinutes = completedBlocks.reduce(
    (sum, b) => sum + b.durationMinutes,
    0
  );

  const completedBigRocks = bigRocks.filter((r) => r.completed).length;

  return {
    plannedTasks: plannedTasks.length,
    completedTasks: completedTasks.length,
    completionRate:
      plannedTasks.length > 0
        ? Math.round((completedTasks.length / plannedTasks.length) * 100)
        : 0,
    plannedMinutes,
    actualMinutes,
    bigRocksTotal: bigRocks.length,
    bigRocksCompleted: completedBigRocks,
    bigRockRate:
      bigRocks.length > 0
        ? Math.round((completedBigRocks / bigRocks.length) * 100)
        : 0,
    rescheduledCount: await prisma.activityEvent.count({
      where: {
        userId,
        type: "TASK_RESCHEDULED",
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
  };
}

// ─── Chart Data ────────────────────────────────────────────────────────────────

export async function getWeeklyCompletionChartData(
  userId: string,
  weeksBack = 8
) {
  const weeks = getWeeksBack(weeksBack);

  const data = await Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const [completed, planned] = await Promise.all([
        prisma.task.count({
          where: {
            userId,
            status: "DONE",
            completedAt: { gte: weekStart, lte: weekEnd },
          },
        }),
        prisma.task.count({
          where: {
            userId,
            status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS", "DONE"] },
            createdAt: { lte: weekEnd },
            OR: [
              { completedAt: null },
              { completedAt: { gte: weekStart, lte: weekEnd } },
            ],
          },
        }),
      ]);

      return {
        week: weekStart.toISOString(),
        completed,
        planned: Math.max(planned, completed),
        completionRate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
      };
    })
  );

  return data;
}

export async function getPlannedVsActualChartData(
  userId: string,
  weeksBack = 8
) {
  const weeks = getWeeksBack(weeksBack);

  const data = await Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const [tasks, completedBlocks] = await Promise.all([
        prisma.task.findMany({
          where: {
            userId,
            status: { in: ["THIS_WEEK", "TODAY", "DONE", "IN_PROGRESS"] },
            createdAt: { lte: weekEnd },
          },
          select: { estimatedMinutes: true },
        }),
        prisma.timeBlock.findMany({
          where: {
            userId,
            date: { gte: weekStart, lte: weekEnd },
            status: "COMPLETED",
          },
          select: { durationMinutes: true },
        }),
      ]);

      const plannedHours =
        Math.round(
          (tasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0) / 60) * 10
        ) / 10;
      const actualHours =
        Math.round(
          (completedBlocks.reduce((s, b) => s + b.durationMinutes, 0) / 60) *
            10
        ) / 10;

      return { week: weekStart.toISOString(), plannedHours, actualHours };
    })
  );

  return data;
}

export async function getTasksByAreaChartData(userId: string) {
  const tasks = await prisma.task.groupBy({
    by: ["area"],
    where: { userId, status: { not: "ARCHIVED" } },
    _count: { id: true },
  });

  return tasks.map((t) => ({ area: t.area, count: t._count.id }));
}

export async function getSlippageTrendData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const rescheduled = await prisma.activityEvent.count({
        where: {
          userId,
          type: "TASK_RESCHEDULED",
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      });
      return { week: weekStart.toISOString(), rescheduled };
    })
  );
}

export async function getDailyCompletionData(userId: string, daysBack = 7) {
  const days = getDaysBack(daysBack);

  return Promise.all(
    days.map(async (day) => {
      const dayEnd = endOfDayTZ(day);
      const count = await prisma.task.count({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: day, lte: dayEnd },
        },
      });
      return { date: day.toISOString(), completed: count };
    })
  );
}

export async function getHabitSummaryData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const logs = await prisma.healthLog.findMany({
        where: { userId, date: { gte: weekStart, lte: weekEnd } },
      });

      return {
        week: weekStart.toISOString(),
        smokeDays: logs.filter((l) => l.smokedToday).length,
        alcoholDays: logs.filter((l) => l.drankAlcoholToday).length,
        activityDays: logs.filter((l) => l.didPhysicalActivityToday).length,
        totalDays: logs.length,
      };
    })
  );
}

// ─── Streaks ───────────────────────────────────────────────────────────────────

export async function getStreaks(userId: string) {
  const logs = await prisma.healthLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 90,
  });

  const today = todayTZ();

  function countStreak(
    condition: (log: (typeof logs)[0]) => boolean
  ): number {
    let streak = 0;

    for (let i = 0; i < 90; i++) {
      const dateStr = toLocalDateKey(startOfDayTZ(subDays(today, i)));
      const log = logs.find((l) => toLocalDateKey(l.date) === dateStr);

      if (log && condition(log)) {
        streak++;
      } else if (i === 0) {
        // Today not logged yet — don't break streak, just skip
        continue;
      } else {
        break;
      }
    }

    return streak;
  }

  return {
    smokeFreeStreak: countStreak((l) => !l.smokedToday),
    alcoholFreeStreak: countStreak((l) => !l.drankAlcoholToday),
    activityStreak: countStreak((l) => l.didPhysicalActivityToday),
  };
}

// ─── Insight Cards ─────────────────────────────────────────────────────────────

export async function getInsightCards(userId: string) {
  const insights: string[] = [];

  // Best weekday
  const completedTasks = await prisma.task.findMany({
    where: {
      userId,
      status: "DONE",
      completedAt: { gte: subDays(new Date(), 56) },
    },
    select: { completedAt: true },
  });

  const dayCountMap: Record<number, number> = {};
  completedTasks.forEach((t) => {
    if (t.completedAt) {
      // Use day-of-week in user's timezone, not UTC
      const day = toZonedTime(t.completedAt, APP_TIMEZONE).getDay();
      dayCountMap[day] = (dayCountMap[day] ?? 0) + 1;
    }
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDay = Object.entries(dayCountMap).sort((a, b) => b[1] - a[1])[0];
  if (bestDay) {
    insights.push(`Your best completion day is ${dayNames[parseInt(bestDay[0])]} with ${bestDay[1]} tasks completed on average.`);
  }

  // Activity correlation
  const recentLogs = await prisma.healthLog.findMany({
    where: { userId, date: { gte: subDays(new Date(), 56) } },
  });

  const activityDays = new Set(
    recentLogs
      .filter((l) => l.didPhysicalActivityToday)
      .map((l) => toLocalDateKey(l.date))
  );

  let completedOnActivity = 0;
  let completedOnNonActivity = 0;
  completedTasks.forEach((t) => {
    if (!t.completedAt) return;
    const dateStr = toLocalDateKey(t.completedAt);
    if (activityDays.has(dateStr)) completedOnActivity++;
    else completedOnNonActivity++;
  });

  if (activityDays.size > 5 && completedOnActivity > completedOnNonActivity) {
    insights.push(
      `Days with physical activity show higher task completion — keep moving.`
    );
  }

  return insights;
}

// ─── Heatmap Data ─────────────────────────────────────────────────────────────

export async function getActivityHeatmapData(userId: string, daysBack = 90) {
  const startDate = subDays(new Date(), daysBack);

  const [taskEvents, healthLogs, dailyPlans] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: startDate },
      },
      select: { completedAt: true },
    }),
    prisma.healthLog.findMany({
      where: { userId, date: { gte: startDate } },
      select: { date: true, didPhysicalActivityToday: true },
    }),
    prisma.dailyPlan.findMany({
      where: { userId, date: { gte: startDate } },
      select: { date: true },
    }),
  ]);

  const heatmap: Record<
    string,
    { tasksCompleted: number; planned: boolean; active: boolean }
  > = {};

  taskEvents.forEach((t) => {
    if (!t.completedAt) return;
    const key = toLocalDateKey(t.completedAt);
    if (!heatmap[key])
      heatmap[key] = { tasksCompleted: 0, planned: false, active: false };
    heatmap[key].tasksCompleted++;
  });

  healthLogs.forEach((l) => {
    const key = toLocalDateKey(l.date);
    if (!heatmap[key])
      heatmap[key] = { tasksCompleted: 0, planned: false, active: false };
    heatmap[key].active = l.didPhysicalActivityToday;
  });

  dailyPlans.forEach((p) => {
    const key = toLocalDateKey(p.date);
    if (!heatmap[key])
      heatmap[key] = { tasksCompleted: 0, planned: false, active: false };
    heatmap[key].planned = true;
  });

  return heatmap;
}

export async function getFixedCommitmentHoursChartData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const commitments = await getFixedCommitmentsForRange(
        userId,
        weekStart,
        getWeekEnd(weekStart)
      );

      return {
        week: weekStart.toISOString(),
        hours: Math.round((sumCommitmentMinutes(commitments) / 60) * 10) / 10,
      };
    })
  );
}

export async function getPlannedWorkVsCommitmentsChartData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const [taskEstimate, commitments] = await Promise.all([
        prisma.task.aggregate({
          where: {
            userId,
            status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS", "DONE"] },
            createdAt: { lte: weekEnd },
            OR: [{ completedAt: null }, { completedAt: { gte: weekStart, lte: weekEnd } }],
          },
          _sum: { estimatedMinutes: true },
        }),
        getFixedCommitmentsForRange(userId, weekStart, weekEnd),
      ]);

      return {
        week: weekStart.toISOString(),
        plannedHours:
          Math.round(((taskEstimate._sum.estimatedMinutes ?? 0) / 60) * 10) / 10,
        commitmentHours: Math.round((sumCommitmentMinutes(commitments) / 60) * 10) / 10,
      };
    })
  );
}

export async function getSomedayPromotionRateData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const promoted = await prisma.somedayItem.count({
        where: {
          userId,
          promotedAt: { gte: weekStart, lte: weekEnd },
        },
      });

      return {
        week: weekStart.toISOString(),
        promoted,
      };
    })
  );
}

export async function getReviewDisciplineData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const [dueItems, reviewed] = await Promise.all([
        prisma.somedayItem.count({
          where: {
            userId,
            reviewDate: { gte: weekStart, lte: weekEnd },
            status: { in: ["SOMEDAY", "ACTIVE"] },
          },
        }),
        prisma.activityEvent.count({
          where: {
            userId,
            type: "SOMEDAY_REVIEWED",
            createdAt: { gte: weekStart, lte: weekEnd },
          },
        }),
      ]);

      return {
        week: weekStart.toISOString(),
        reviewedOnTime: Math.min(reviewed, dueItems),
        ignored: Math.max(dueItems - reviewed, 0),
      };
    })
  );
}

export async function getRecurringTaskCompletionRateData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = getWeekEnd(weekStart);
      const [generated, completed] = await Promise.all([
        prisma.task.count({
          where: {
            userId,
            sourceType: "RECURRING",
            dueDate: { gte: weekStart, lte: weekEnd },
          },
        }),
        prisma.task.count({
          where: {
            userId,
            sourceType: "RECURRING",
            status: "DONE",
            completedAt: { gte: weekStart, lte: weekEnd },
          },
        }),
      ]);

      return {
        week: weekStart.toISOString(),
        generated,
        completed,
        completionRate: generated > 0 ? Math.round((completed / generated) * 100) : 0,
      };
    })
  );
}

export async function getCalendarConflictTrendData(userId: string, weeksBack = 8) {
  const weeks = getWeeksBack(weeksBack);

  return Promise.all(
    weeks.map(async (weekStart) => ({
      week: weekStart.toISOString(),
      conflicts: await getCalendarConflictCount(userId, weekStart, getWeekEnd(weekStart)),
    }))
  );
}
