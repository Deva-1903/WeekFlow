"use client";

import { useMemo, useState } from "react";
import { DailyPlanItem, Task } from "@prisma/client";
import { CheckCircle2, Circle, Loader2, ListPlus, Target } from "lucide-react";
import { completeDailyPlanItem, saveDailyPlan } from "@/actions/daily-planner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { AREA_COLORS, AREA_LABELS, PRIORITY_COLORS, formatDate, minutesToHours } from "@/lib/utils";

type PlanItem = DailyPlanItem & { task: Task };

interface Props {
  date: Date;
  today: Date;
  dailyPlan: { id: string; notes: string | null; items: PlanItem[] } | null;
  availableTasks: Task[];
  overdueTasks: Task[];
  bigRockLimit: number;
}

export function DailyPlannerClient({ date, dailyPlan, availableTasks, overdueTasks, bigRockLimit }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<PlanItem[]>(dailyPlan?.items ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(dailyPlan?.items.map((item) => item.taskId) ?? [])
  );
  const [notes, setNotes] = useState(dailyPlan?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const topItems = items.filter((item) => item.isTopPriority);
  const smallItems = items.filter((item) => !item.isTopPriority);
  const completedCount = items.filter((item) => item.completed).length;
  const totalMinutes = items.reduce((sum, item) => sum + (item.task.estimatedMinutes ?? 0), 0);

  const candidateTasks = useMemo(() => {
    const map = new Map<string, Task>();
    [...overdueTasks, ...availableTasks].forEach((task) => {
      if (!["DONE", "ARCHIVED", "DROPPED", "SKIPPED"].includes(task.status)) {
        map.set(task.id, task);
      }
    });
    return Array.from(map.values());
  }, [availableTasks, overdueTasks]);

  function toggleTask(task: Task, isTopPriority: boolean) {
    if (selectedIds.has(task.id)) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      setItems((current) => current.filter((item) => item.taskId !== task.id));
      return;
    }

    if (isTopPriority && topItems.length >= bigRockLimit) {
      toast({ title: `Pick at most ${bigRockLimit} top priorities`, description: "Tomorrow gets calmer when the top list stays short." });
      return;
    }

    setSelectedIds((current) => new Set([...current, task.id]));
    setItems((current) => [
      ...current,
      {
        id: `temp-${task.id}`,
        dailyPlanId: "temp",
        taskId: task.id,
        order: current.length,
        isTopPriority,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
        task,
      },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyPlan(date, {
        notes,
        items: items.map((item) => ({
          taskId: item.taskId,
          isTopPriority: item.isTopPriority,
        })),
      });
      toast({ title: "Tomorrow plan saved" });
    } catch (error) {
      toast({
        title: "Could not save plan",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(item: PlanItem) {
    if (item.id.startsWith("temp-")) {
      toast({ title: "Save first", description: "Then you can mark tomorrow items complete." });
      return;
    }

    try {
      const result = await completeDailyPlanItem(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                completed: result.completed,
                completedAt: result.completed ? new Date() : null,
                task: {
                  ...entry.task,
                  status: result.completed ? "DONE" : "TOMORROW",
                  completedAt: result.completed ? new Date() : null,
                },
              }
            : entry
        )
      );
    } catch (error) {
      toast({
        title: "Could not update item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  function PlanItemRow({ item }: { item: PlanItem }) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
        <button onClick={() => handleComplete(item)} className="shrink-0">
          {item.completed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 text-[var(--muted-foreground)]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${item.completed ? "line-through text-[var(--muted-foreground)]" : ""}`}>
            {item.task.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AREA_COLORS[item.task.area] }} />
            <span className="text-xs text-[var(--muted-foreground)]">{AREA_LABELS[item.task.area]}</span>
            {item.task.estimatedMinutes && (
              <span className="text-xs text-[var(--muted-foreground)]">{minutesToHours(item.task.estimatedMinutes)}</span>
            )}
          </div>
        </div>
        <button onClick={() => toggleTask(item.task, item.isTopPriority)} className="text-xs text-[var(--muted-foreground)] hover:text-red-500">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Planner</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Choose tomorrow intentionally · {formatDate(date)}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Tomorrow
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Top priorities", value: `${topItems.length}/${bigRockLimit}`, color: "#6366f1" },
          { label: "Total items", value: items.length, color: "#10b981" },
          { label: "Estimated load", value: totalMinutes ? minutesToHours(totalMinutes) : "—", color: "#64748b" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,1fr] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[var(--primary)]" />
                Top 3 For Tomorrow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topItems.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                  Choose the work that would make tomorrow feel genuinely good.
                </div>
              ) : (
                topItems.map((item) => <PlanItemRow key={item.id} item={item} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-[var(--primary)]" />
                Smaller Supports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {smallItems.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">Optional smaller tasks can go here after the top list is sane.</p>
              ) : (
                smallItems.map((item) => <PlanItemRow key={item.id} item={item} />)
              )}
              <div className="space-y-1.5 pt-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">What would make tomorrow a good day?</p>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="One clear intention, constraints, or a reminder to be kind to future-you." />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pick From Active Work</CardTitle>
          </CardHeader>
          <CardContent>
            {candidateTasks.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-10">
                No active candidates. Capture something in Inbox or create a task.
              </p>
            ) : (
              <div className="space-y-2 max-h-[760px] overflow-y-auto pr-1">
                {candidateTasks.map((task) => {
                  const selected = selectedIds.has(task.id);
                  const isOverdue = overdueTasks.some((entry) => entry.id === task.id);
                  return (
                    <div key={task.id} className={`rounded-lg border p-3 transition-colors ${selected ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] hover:bg-[var(--muted)]/40"}`}>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant="secondary" className="text-[10px]">{AREA_LABELS[task.area]}</Badge>
                            <Badge variant="outline" className="text-[10px]">{task.status.replace("_", " ").toLowerCase()}</Badge>
                            {isOverdue && <Badge variant="destructive" className="text-[10px]">overdue</Badge>}
                            {task.sourceType === "ROUTINE" && <Badge variant="success" className="text-[10px]">routine</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant={selected ? "secondary" : "default"} onClick={() => toggleTask(task, true)}>
                          {selected ? "Selected" : "Top Priority"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleTask(task, false)}>
                          {selected ? "Remove" : "Smaller Task"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {completedCount > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">{completedCount} planned item(s) completed.</p>
      )}
    </div>
  );
}
