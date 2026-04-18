"use client";

import { useState } from "react";
import { Task } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveDailyPlan, completeBigRock } from "@/actions/daily-planner";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatDate, AREA_COLORS, PRIORITY_COLORS, minutesToHours } from "@/lib/utils";
import {
  CheckCircle2, Circle, Loader2, Target, List, AlertTriangle
} from "lucide-react";

interface BigRock {
  id: string;
  taskId: string;
  order: number;
  completed: boolean;
  task: Task;
}

interface Props {
  date: Date;
  dailyPlan: { id: string; notes: string | null; bigRocks: BigRock[] } | null;
  availableTasks: Task[];
  bigRockLimit: number;
}

export function DailyPlannerClient({ date, dailyPlan, availableTasks, bigRockLimit }: Props) {
  const { toast } = useToast();
  const [bigRocks, setBigRocks] = useState<BigRock[]>(dailyPlan?.bigRocks ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(dailyPlan?.bigRocks.map((br) => br.taskId) ?? [])
  );
  const [notes, setNotes] = useState(dailyPlan?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const completedCount = bigRocks.filter((r) => r.completed).length;
  const totalMinutes = bigRocks.reduce((s, r) => s + (r.task.estimatedMinutes ?? 0), 0);

  function toggleTask(task: Task) {
    if (selectedIds.has(task.id)) {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(task.id); return next; });
      setBigRocks((prev) => prev.filter((r) => r.taskId !== task.id));
    } else {
      if (selectedIds.size >= bigRockLimit) {
        toast({ title: `Max ${bigRockLimit} big rocks`, description: "Remove one before adding another." });
        return;
      }
      setSelectedIds((prev) => new Set([...prev, task.id]));
      setBigRocks((prev) => [
        ...prev,
        { id: `temp-${task.id}`, taskId: task.id, order: prev.length, completed: false, task },
      ]);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyPlan(date, {
        notes,
        taskIds: bigRocks.map((r) => r.taskId),
      });
      toast({ title: "Daily plan saved" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteRock(bigRock: BigRock) {
    if (bigRock.id.startsWith("temp-")) {
      toast({ title: "Save the plan first to mark tasks complete." });
      return;
    }
    try {
      const result = await completeBigRock(bigRock.id);
      setBigRocks((prev) =>
        prev.map((r) => r.id === bigRock.id ? { ...r, completed: result.completed } : r)
      );
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Planner</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{formatDate(date)}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Plan
        </Button>
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Big Rocks", value: `${bigRocks.length}/${bigRockLimit}`, color: "#6366f1" },
          { label: "Completed", value: `${completedCount}/${bigRocks.length}`, color: "#10b981" },
          { label: "Estimated", value: totalMinutes > 0 ? minutesToHours(totalMinutes) : "—", color: "#64748b" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Big Rocks board */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--primary)]" />
              Big Rocks (max {bigRockLimit})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bigRocks.length === 0 ? (
              <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center">
                <Target className="h-8 w-8 text-[var(--muted-foreground)]/40 mx-auto mb-2" />
                <p className="text-sm text-[var(--muted-foreground)]">
                  Choose 1–{bigRockLimit} tasks from this week.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {bigRocks.map((rock) => (
                  <div
                    key={rock.id}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                      rock.completed
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-[var(--muted)]/30 border-[var(--border)]"
                    }`}
                  >
                    <button onClick={() => handleCompleteRock(rock)} className="shrink-0">
                      {rock.completed
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <Circle className="h-5 w-5 text-[var(--muted-foreground)]" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${rock.completed ? "line-through text-[var(--muted-foreground)]" : ""}`}>
                        {rock.task.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AREA_COLORS[rock.task.area] }} />
                        {rock.task.estimatedMinutes && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {minutesToHours(rock.task.estimatedMinutes)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTask(rock.task)}
                      className="text-xs text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Label className="text-xs">Daily notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Focus intention, key context for today..."
                rows={2}
                className="mt-1.5 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Task picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <List className="h-4 w-4 text-[var(--primary)]" />
              This Week&apos;s Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableTasks.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                No tasks planned for this week. Go to Weekly Review first.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {availableTasks.map((task) => {
                  const selected = selectedIds.has(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task)}
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
