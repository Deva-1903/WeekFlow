import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, RotateCcw, Plus, Heart, CalendarDays, Zap, Sparkles, Repeat } from "lucide-react";

interface Event {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: Date;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  TASK_COMPLETED: { label: "Completed", icon: CheckCircle2, color: "#10b981" },
  TASK_RESCHEDULED: { label: "Rescheduled", icon: RotateCcw, color: "#f97316" },
  TASK_CREATED: { label: "Added", icon: Plus, color: "#6366f1" },
  HEALTH_LOGGED: { label: "Health logged", icon: Heart, color: "#ec4899" },
  WEEKLY_PLAN_SAVED: { label: "Weekly plan saved", icon: CalendarDays, color: "#0ea5e9" },
  DAILY_PLAN_SAVED: { label: "Daily plan saved", icon: Zap, color: "#8b5cf6" },
  CALENDAR_SYNCED: { label: "Calendar synced", icon: CalendarDays, color: "#0ea5e9" },
  SOMEDAY_PROMOTED: { label: "Promoted", icon: Sparkles, color: "#10b981" },
  SOMEDAY_REVIEWED: { label: "Reviewed", icon: Sparkles, color: "#f59e0b" },
  RECURRING_TASK_GENERATED: { label: "Generated", icon: Repeat, color: "#6366f1" },
};

export function RecentActivity({ events }: { events: Event[] }) {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {events.slice(0, 7).map((event) => {
            const config = EVENT_CONFIG[event.type] ?? { label: event.type, icon: Zap, color: "#64748b" };
            const Icon = config.icon;
            const meta = event.metadata as Record<string, string> | null;
            const title = meta?.title ?? "";
            return (
              <div key={event.id} className="flex items-start gap-2.5">
                <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: config.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug truncate">
                    <span className="font-medium">{config.label}</span>
                    {title && <span className="text-[var(--muted-foreground)]"> · {title}</span>}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                    {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
