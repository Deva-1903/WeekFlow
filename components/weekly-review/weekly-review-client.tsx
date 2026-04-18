"use client";

import { useState, useMemo } from "react";
import { Task } from "@prisma/client";
import type { FixedCommitment } from "@/lib/commitments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { saveWeeklyPlan } from "@/actions/weekly-review";
import { useToast } from "@/components/ui/use-toast";
import {
  formatWeekRange, AREA_LABELS, AREA_COLORS, PRIORITY_COLORS,
  minutesToHours, minutesToDecimalHours
} from "@/lib/utils";
import { CheckCircle2, Circle, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Clock, Target } from "lucide-react";

interface PlanData {
  id: string;
  availableMinutes: number;
  fixedCommitmentMinutes: number;
  remainingFocusMinutes: number;
  committedMinutes: number;
  weeklyGoals: string | null;
  reflectionWentWell: string | null;
  reflectionSlipped: string | null;
  reflectionChange: string | null;
  notes: string | null;
  selectedTaskIds: string[];
}

interface Props {
  weekStart: Date;
  currentPlan: PlanData | null;
  availableTasks: Task[];
  lastWeekCompleted: Task[];
  lastWeekRolledOver: Task[];
  userCapacityMinutes: number;
  fixedCommitments: FixedCommitment[];
}

export function WeeklyReviewClient({
  weekStart,
  currentPlan,
  availableTasks,
  lastWeekCompleted,
  lastWeekRolledOver,
  userCapacityMinutes,
  fixedCommitments,
}: Props) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(currentPlan?.selectedTaskIds ?? [])
  );
  const [availableMinutes, setAvailableMinutes] = useState(
    currentPlan?.availableMinutes ?? userCapacityMinutes
  );
  const [goals, setGoals] = useState(currentPlan?.weeklyGoals ?? "");
  const [wentWell, setWentWell] = useState(currentPlan?.reflectionWentWell ?? "");
  const [slipped, setSlipped] = useState(currentPlan?.reflectionSlipped ?? "");
  const [change, setChange] = useState(currentPlan?.reflectionChange ?? "");
  const [saving, setSaving] = useState(false);

  const committedMinutes = useMemo(() => {
    return availableTasks
      .filter((t) => selectedIds.has(t.id))
      .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  }, [selectedIds, availableTasks]);

  const fixedCommitmentMinutes = useMemo(
    () => fixedCommitments.filter((item) => item.affectsCapacity).reduce((sum, item) => sum + item.durationMinutes, 0),
    [fixedCommitments]
  );

  const remainingFocusMinutes = Math.max(availableMinutes - fixedCommitmentMinutes, 0);

  const utilization = remainingFocusMinutes > 0
    ? Math.round((committedMinutes / remainingFocusMinutes) * 100)
    : 0;

  const loadStatus = utilization > 100 ? "overloaded" : utilization > 80 ? "tight" : "healthy";

  function toggleTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveWeeklyPlan(weekStart, {
        availableMinutes,
        weeklyGoals: goals,
        reflectionWentWell: wentWell,
        reflectionSlipped: slipped,
        reflectionChange: change,
        taskIds: Array.from(selectedIds),
      });
      toast({ title: "Weekly plan saved" });
    } catch {
      toast({ title: "Error saving plan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Review</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {formatWeekRange(weekStart)}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: capacity + task selection */}
        <div className="lg:col-span-2 space-y-6">

          {/* Capacity */}
          <Card>
            <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--primary)]" />
              Capacity This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1.5 flex-1">
                <Label>Theoretical focus hours</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                      value={Math.round(availableMinutes / 60)}
                      onChange={(e) => setAvailableMinutes(Number(e.target.value) * 60)}
                      className="w-24"
                    />
                    <span className="text-sm text-[var(--muted-foreground)]">hours of focus time</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1">
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Fixed commitments</div>
                  <div className="text-lg font-semibold text-sky-600">{minutesToHours(fixedCommitmentMinutes)}</div>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Remaining focus</div>
                  <div className="text-lg font-semibold text-emerald-600">{minutesToHours(remainingFocusMinutes)}</div>
                </div>
              </div>

              {/* Load indicator */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">
                    Committed: <strong>{minutesToHours(committedMinutes)}</strong>
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    Remaining: <strong>{minutesToHours(remainingFocusMinutes)}</strong>
                  </span>
                  <span className={`font-semibold ${
                    loadStatus === "overloaded" ? "text-red-500" :
                    loadStatus === "tight" ? "text-amber-500" :
                    "text-emerald-500"
                  }`}>
                    {utilization}%
                  </span>
                </div>
                <Progress
                  value={Math.min(utilization, 100)}
                  indicatorColor={
                    loadStatus === "overloaded" ? "#ef4444" :
                    loadStatus === "tight" ? "#f59e0b" :
                    "#10b981"
                  }
                />
                {loadStatus === "overloaded" && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overloaded — you&apos;ve committed more than available time. Remove tasks.
                  </div>
                )}
                {loadStatus === "tight" && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Getting tight — leave some buffer for the unexpected.
                  </div>
                )}
                {loadStatus === "healthy" && committedMinutes > 0 && (
                  <p className="text-xs text-emerald-600">Healthy load — good buffer for the week.</p>
                )}
              </div>

              {fixedCommitments.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">
                    Fixed commitments shaping this week
                  </p>
                  <div className="space-y-1.5">
                    {fixedCommitments.slice(0, 5).map((commitment) => (
                      <div key={commitment.id} className="flex items-center gap-3 rounded-md bg-[var(--muted)]/40 px-3 py-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: commitment.color ?? "#94a3b8" }} />
                        <span className="text-sm flex-1 truncate">{commitment.title}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {commitment.startTime}–{commitment.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[var(--primary)]" />
                Select Tasks for This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {availableTasks.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                    No tasks in backlog. Add tasks first.
                  </p>
                ) : (
                  availableTasks.map((task) => {
                    const selected = selectedIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors border ${
                          selected
                            ? "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                            : "border-transparent hover:bg-[var(--muted)]/50"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"
                        }`}>
                          {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AREA_COLORS[task.area] }} />
                        <span className="text-sm flex-1 truncate">{task.title}</span>
                        {task.estimatedMinutes && (
                          <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                            {minutesToHours(task.estimatedMinutes)}
                          </span>
                        )}
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: goals + reflection */}
        <div className="space-y-6">
          {/* Last week summary */}
          {lastWeekCompleted.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Last Week</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--muted-foreground)] mb-2">
                  Completed {lastWeekCompleted.length} task{lastWeekCompleted.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-1">
                  {lastWeekCompleted.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Goals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Weekly Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="What are the 2–3 outcomes that would make this week a success?"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </CardContent>
          </Card>

          {/* Reflection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Reflection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">What went well?</Label>
                <Textarea
                  value={wentWell}
                  onChange={(e) => setWentWell(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="Wins from last week..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">What slipped?</Label>
                <Textarea
                  value={slipped}
                  onChange={(e) => setSlipped(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="Tasks deferred or missed..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">What should change?</Label>
                <Textarea
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="One adjustment for next week..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
