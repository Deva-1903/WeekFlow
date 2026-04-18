"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_LABELS, AREA_COLORS } from "@/lib/utils";
import { Flame, Cigarette, Wine, Dumbbell, Lightbulb, TrendingUp } from "lucide-react";

interface Props {
  weeklyCompletion: { week: string; completed: number; planned: number; completionRate: number }[];
  plannedVsActual: { week: string; plannedHours: number; actualHours: number }[];
  tasksByArea: { area: string; count: number }[];
  slippageTrend: { week: string; rescheduled: number }[];
  habitSummary: { week: string; smokeDays: number; alcoholDays: number; activityDays: number; totalDays: number }[];
  streaks: { smokeFreeStreak: number; alcoholFreeStreak: number; activityStreak: number };
  insights: string[];
  heatmapData: Record<string, { tasksCompleted: number; planned: boolean; active: boolean }>;
  fixedCommitmentHours: { week: string; hours: number }[];
  workVsCommitments: { week: string; plannedHours: number; commitmentHours: number }[];
  somedayPromotionRate: { week: string; promoted: number }[];
  reviewDiscipline: { week: string; reviewedOnTime: number; ignored: number }[];
  recurringTaskCompletion: { week: string; generated: number; completed: number; completionRate: number }[];
  calendarConflicts: { week: string; conflicts: number }[];
}

function weekLabel(isoDate: string) {
  return format(parseISO(isoDate), "MMM d");
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px",
  },
  cursor: { fill: "#f1f5f9" },
};

export function AnalyticsClient({
  weeklyCompletion, plannedVsActual, tasksByArea, slippageTrend,
  habitSummary, streaks, insights, heatmapData, fixedCommitmentHours,
  workVsCommitments, somedayPromotionRate, reviewDiscipline,
  recurringTaskCompletion, calendarConflicts,
}: Props) {

  const completionLineData = weeklyCompletion.map((d) => ({
    week: weekLabel(d.week),
    rate: d.completionRate,
    completed: d.completed,
    planned: d.planned,
  }));

  const pvActualData = plannedVsActual.map((d) => ({
    week: weekLabel(d.week),
    planned: d.plannedHours,
    actual: d.actualHours,
  }));

  const areaData = tasksByArea.map((d) => ({
    name: AREA_LABELS[d.area] ?? d.area,
    value: d.count,
    fill: AREA_COLORS[d.area] ?? "#94a3b8",
  }));

  const slippageData = slippageTrend.map((d) => ({
    week: weekLabel(d.week),
    rescheduled: d.rescheduled,
  }));

  const habitData = habitSummary.map((d) => ({
    week: weekLabel(d.week),
    "Smoke Days": d.smokeDays,
    "Alcohol Days": d.alcoholDays,
    "Active Days": d.activityDays,
  }));

  const fixedCommitmentData = fixedCommitmentHours.map((d) => ({
    week: weekLabel(d.week),
    hours: d.hours,
  }));

  const workVsCommitmentData = workVsCommitments.map((d) => ({
    week: weekLabel(d.week),
    planned: d.plannedHours,
    commitments: d.commitmentHours,
  }));

  const somedayPromotionData = somedayPromotionRate.map((d) => ({
    week: weekLabel(d.week),
    promoted: d.promoted,
  }));

  const reviewDisciplineData = reviewDiscipline.map((d) => ({
    week: weekLabel(d.week),
    reviewed: d.reviewedOnTime,
    ignored: d.ignored,
  }));

  const recurringTaskData = recurringTaskCompletion.map((d) => ({
    week: weekLabel(d.week),
    rate: d.completionRate,
    generated: d.generated,
    completed: d.completed,
  }));

  const calendarConflictData = calendarConflicts.map((d) => ({
    week: weekLabel(d.week),
    conflicts: d.conflicts,
  }));

  // Build heatmap array (last 90 days)
  const heatmapArr = Object.entries(heatmapData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      level: Math.min(4, data.tasksCompleted),
      planned: data.planned,
      active: data.active,
    }));

  function heatColor(level: number) {
    if (level === 0) return "#f1f5f9";
    if (level === 1) return "#c7d2fe";
    if (level === 2) return "#818cf8";
    if (level === 3) return "#6366f1";
    return "#4338ca";
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Execution patterns and behavior trends over time.
        </p>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Smoke-free streak", value: streaks.smokeFreeStreak, icon: Cigarette, color: "#10b981", unit: "days" },
          { label: "Alcohol-free streak", value: streaks.alcoholFreeStreak, icon: Wine, color: "#6366f1", unit: "days" },
          { label: "Activity streak", value: streaks.activityStreak, icon: Dumbbell, color: "#f59e0b", unit: "days" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md" style={{ backgroundColor: s.color + "20" }}>
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-sm text-[var(--muted-foreground)]">{s.unit}</span>
                      {s.value > 0 && <Flame className="h-4 w-4 text-orange-400" />}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Insight Cards */}
      {insights.length > 0 && (
        <Card className="border-[var(--primary)]/20 bg-[var(--primary)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[var(--primary)]">
              <Lightbulb className="h-4 w-4" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.map((insight, i) => (
                <p key={i} className="text-sm text-[var(--foreground)]">{insight}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks completed per week */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Tasks Completed / Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={completionLineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="completed" name="Completed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="planned" name="Planned" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Completion rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Completion Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={completionLineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v) => [`${v}%`, "Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Completion %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planned vs actual hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Planned vs Actual Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pvActualData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="planned" name="Planned" fill="#e0e7ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task distribution by area */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Tasks by Area</CardTitle>
          </CardHeader>
          <CardContent>
            {areaData.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-10">No task data yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={areaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {areaData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "12px", border: "1px solid #e2e8f0", borderRadius: "6px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1">
                  {areaData.sort((a, b) => b.value - a.value).map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="flex-1 truncate text-[var(--muted-foreground)]">{d.name}</span>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Weekly Fixed Commitments Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fixedCommitmentData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="hours" name="Fixed hours" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Planned Work vs Fixed Commitments</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={workVsCommitmentData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="planned" name="Planned work" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="commitments" name="Fixed commitments" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slippage trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Rescheduled Tasks / Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={slippageData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="rescheduled" name="Rescheduled" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Habit trends */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Health Habits / Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={habitData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 7]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="Active Days" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Smoke Days" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="Alcohol Days" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Someday Promotion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={somedayPromotionData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="promoted" name="Promoted" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Review Discipline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={reviewDisciplineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="reviewed" name="Reviewed on time" stackId="reviews" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ignored" name="Ignored" stackId="reviews" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recurring Task Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={recurringTaskData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value}%`, "Completion rate"]} />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Calendar Conflict Count</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={calendarConflictData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="conflicts" name="Conflicts" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Activity Heatmap — Last 90 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {heatmapArr.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No activity recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {heatmapArr.map((day) => (
                <div
                  key={day.date}
                  className="w-3.5 h-3.5 rounded-sm"
                  style={{ backgroundColor: heatColor(day.level) }}
                  title={`${day.date}: ${day.level} tasks${day.active ? " · active" : ""}${day.planned ? " · planned" : ""}`}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-[var(--muted-foreground)]">Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatColor(l) }} />
            ))}
            <span className="text-xs text-[var(--muted-foreground)]">More</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
