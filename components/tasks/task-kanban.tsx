"use client";

import { Task, TaskStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AREA_COLORS, PRIORITY_COLORS, TASK_SOURCE_LABELS, minutesToHours, isOverdue } from "@/lib/utils";
import { updateTask, deleteTask } from "@/actions/tasks";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, Circle, Pencil, Trash2, AlertTriangle } from "lucide-react";

interface Props {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdate: (task: Task) => void;
}

const KANBAN_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "BACKLOG", label: "Backlog", color: "#94a3b8" },
  { status: "THIS_WEEK", label: "This Week", color: "#6366f1" },
  { status: "TODAY", label: "Today", color: "#8b5cf6" },
  { status: "IN_PROGRESS", label: "In Progress", color: "#0ea5e9" },
  { status: "DONE", label: "Done", color: "#10b981" },
];

export function TaskKanban({ tasks, onEdit, onDelete, onUpdate }: Props) {
  const { toast } = useToast();

  async function handleComplete(task: Task) {
    const newStatus = task.status === "DONE" ? "THIS_WEEK" : "DONE";
    try {
      const result = await updateTask(task.id, { status: newStatus });
      onUpdate(result.task as Task);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id);
      onDelete(id);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex-shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-sm font-medium">{col.label}</span>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto">{colTasks.length}</span>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => {
                const overdue = isOverdue(task.dueDate);
                const done = task.status === "DONE";
                return (
                  <Card key={task.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <button onClick={() => handleComplete(task)} className="mt-0.5 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
                          {done ? <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" /> : <Circle className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className={`text-sm leading-snug block ${done ? "line-through text-[var(--muted-foreground)]" : ""}`}>
                            {task.title}
                          </span>
                          {task.sourceType !== "MANUAL" && (
                            <Badge variant="outline" className="text-[10px]">
                              {TASK_SOURCE_LABELS[task.sourceType]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AREA_COLORS[task.area] }} />
                        {task.estimatedMinutes && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {minutesToHours(task.estimatedMinutes)}
                          </span>
                        )}
                        {overdue && !done && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(task)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => handleDelete(task.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {colTasks.length === 0 && (
                <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-4 text-center">
                  <p className="text-xs text-[var(--muted-foreground)]">Empty</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
