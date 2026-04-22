"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Archive, BookOpen, CheckCircle2, Inbox, Repeat, Sparkles, Target, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_COLORS, AREA_LABELS } from "@/lib/utils";

interface AnalyticsData {
  cards: {
    inboxCaptured: number;
    inboxProcessed: number;
    inboxProcessedRate: number;
    routineSessionsThisWeek: number;
    routineTarget: number;
    routineCompletionRate: number;
    tomorrowPlanItems: number;
    tomorrowPlanCompleted: number;
    tomorrowPlanCompletionRate: number;
    futurePromotions: number;
    openFutureReviewItems: number;
    journalDays: number;
  };
  weeklyCompleted: { week: string; completed: number }[];
  overdueTrend: { week: string; overdue: number }[];
  categoryDistribution: { area: string; count: number }[];
  futurePromotionTrend: { week: string; promoted: number }[];
  journalConsistency: { date: string; wrote: boolean }[];
}

interface Props {
  analytics: AnalyticsData;
}

function weekLabel(value: string) {
  return format(parseISO(value), "MMM d");
}

const tooltip = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    fontSize: "12px",
  },
  cursor: { fill: "#f1f5f9" },
};

export function AnalyticsClient({ analytics }: Props) {
  const weeklyCompleted = analytics.weeklyCompleted.map((item) => ({
    week: weekLabel(item.week),
    completed: item.completed,
  }));

  const overdueTrend = analytics.overdueTrend.map((item) => ({
    week: weekLabel(item.week),
    overdue: item.overdue,
  }));

  const futurePromotionTrend = analytics.futurePromotionTrend.map((item) => ({
    week: weekLabel(item.week),
    promoted: item.promoted,
  }));

  const categoryData = analytics.categoryDistribution.map((item) => ({
    name: AREA_LABELS[item.area] ?? item.area,
    value: item.count,
    fill: AREA_COLORS[item.area] ?? "#94a3b8",
  }));

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Lightweight signals for whether the system is reducing chaos.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Inbox processed", value: `${analytics.cards.inboxProcessedRate}%`, sub: `${analytics.cards.inboxProcessed}/${analytics.cards.inboxCaptured}`, icon: Inbox, color: "#6366f1" },
          { label: "Routine rate", value: `${analytics.cards.routineCompletionRate}%`, sub: `${analytics.cards.routineSessionsThisWeek}/${analytics.cards.routineTarget} this week`, icon: Repeat, color: "#10b981" },
          { label: "Tomorrow plan", value: `${analytics.cards.tomorrowPlanCompletionRate}%`, sub: `${analytics.cards.tomorrowPlanCompleted}/${analytics.cards.tomorrowPlanItems}`, icon: Target, color: "#f59e0b" },
          { label: "Journal days", value: analytics.cards.journalDays, sub: "last 14 days", icon: BookOpen, color: "#8b5cf6" },
          { label: "Future promoted", value: analytics.cards.futurePromotions, sub: "last 8 weeks", icon: Sparkles, color: "#14b8a6" },
          { label: "Needs review", value: analytics.cards.openFutureReviewItems, sub: "future items", icon: Archive, color: "#ef4444" },
          { label: "Tasks completed", value: analytics.weeklyCompleted.at(-1)?.completed ?? 0, sub: "current week", icon: CheckCircle2, color: "#10b981" },
          { label: "Overdue now", value: analytics.overdueTrend.at(-1)?.overdue ?? 0, sub: "pressure check", icon: TrendingDown, color: "#ef4444" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <Icon className="h-4 w-4 mb-2" style={{ color: card.color }} />
                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{card.label}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]/80 mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Tasks Completed Per Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyCompleted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Overdue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={overdueTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltip} />
                <Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-12 text-center">No active task data yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="48%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={54} outerRadius={86} paddingAngle={3} dataKey="value">
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "12px", border: "1px solid #e2e8f0", borderRadius: "6px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {categoryData.sort((a, b) => b.value - a.value).map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.fill }} />
                      <span className="flex-1 truncate text-[var(--muted-foreground)]">{item.name}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Future Promotions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={futurePromotionTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="promoted" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Journal Consistency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 md:grid-cols-14 gap-2">
            {analytics.journalConsistency.map((day) => (
              <div key={day.date} className="space-y-1 text-center">
                <div className={`h-9 rounded-md border ${day.wrote ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-[var(--muted)] border-[var(--border)]"}`} />
                <p className="text-[10px] text-[var(--muted-foreground)]">{format(parseISO(day.date), "d")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
