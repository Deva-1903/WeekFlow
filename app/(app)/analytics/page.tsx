import { auth } from "@/auth";
import {
  getWeeklyCompletionChartData,
  getPlannedVsActualChartData,
  getPlannedWorkVsCommitmentsChartData,
  getTasksByAreaChartData,
  getSlippageTrendData,
  getHabitSummaryData,
  getStreaks,
  getInsightCards,
  getActivityHeatmapData,
  getFixedCommitmentHoursChartData,
  getSomedayPromotionRateData,
  getReviewDisciplineData,
  getRecurringTaskCompletionRateData,
  getCalendarConflictTrendData,
} from "@/lib/metrics";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export default async function AnalyticsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [
    weeklyCompletion,
    plannedVsActual,
    tasksByArea,
    slippageTrend,
    habitSummary,
    streaks,
    insights,
    heatmapData,
    fixedCommitmentHours,
    workVsCommitments,
    somedayPromotionRate,
    reviewDiscipline,
    recurringTaskCompletion,
    calendarConflicts,
  ] = await Promise.all([
    getWeeklyCompletionChartData(userId, 8),
    getPlannedVsActualChartData(userId, 8),
    getTasksByAreaChartData(userId),
    getSlippageTrendData(userId, 8),
    getHabitSummaryData(userId, 8),
    getStreaks(userId),
    getInsightCards(userId),
    getActivityHeatmapData(userId, 90),
    getFixedCommitmentHoursChartData(userId, 8),
    getPlannedWorkVsCommitmentsChartData(userId, 8),
    getSomedayPromotionRateData(userId, 8),
    getReviewDisciplineData(userId, 8),
    getRecurringTaskCompletionRateData(userId, 8),
    getCalendarConflictTrendData(userId, 8),
  ]);

  return (
    <AnalyticsClient
      weeklyCompletion={weeklyCompletion}
      plannedVsActual={plannedVsActual}
      tasksByArea={tasksByArea}
      slippageTrend={slippageTrend}
      habitSummary={habitSummary}
      streaks={streaks}
      insights={insights}
      heatmapData={heatmapData}
      fixedCommitmentHours={fixedCommitmentHours}
      workVsCommitments={workVsCommitments}
      somedayPromotionRate={somedayPromotionRate}
      reviewDiscipline={reviewDiscipline}
      recurringTaskCompletion={recurringTaskCompletion}
      calendarConflicts={calendarConflicts}
    />
  );
}
