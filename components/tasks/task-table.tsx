"use client";

import { useState } from "react";
import { Task } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AREA_LABELS,
  AREA_COLORS,
  STATUS_LABELS,
  PRIORITY_COLORS,
  TASK_SOURCE_LABELS,
  formatDate,
  minutesToHours,
  isOverdue,
} from "@/lib/utils";
import { updateTask, deleteTask } from "@/actions/tasks";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2, Circle, Pencil, Trash2, MoreHorizontal,
  ChevronDown, AlertTriangle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

interface Props {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdate: (task: Task) => void;
}

export function TaskTable({ tasks, onEdit, onDelete, onUpdate }: Props) {
  const { toast } = useToast();

  async function handleComplete(task: Task) {
    const newStatus = task.status === "DONE" ? "THIS_WEEK" : "DONE";
    try {
      const result = await updateTask(task.id, { status: newStatus });
      onUpdate(result.task as Task);
      toast({ title: newStatus === "DONE" ? "Task completed" : "Task reopened" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id);
      onDelete(id);
      toast({ title: "Task deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  if (tasks.length === 0) {
    return (
      <Card className="py-16">
        <div className="text-center text-sm text-[var(--muted-foreground)]">
          No tasks match your filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] w-8"></th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Task</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden md:table-cell">Area</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden sm:table-cell">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Due</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Est.</th>
              <th className="px-4 py-2.5 text-right font-medium text-[var(--muted-foreground)] w-8"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate);
              const done = task.status === "DONE";
              return (
                <tr
                  key={task.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/20 transition-colors group"
                >
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleComplete(task)} className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                      <span className={done ? "line-through text-[var(--muted-foreground)]" : ""}>{task.title}</span>
                      {overdue && !done && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                    </div>
                    {task.sourceType !== "MANUAL" && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {TASK_SOURCE_LABELS[task.sourceType]}
                        </Badge>
                      </div>
                    )}
                    {task.description && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate max-w-xs">{task.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AREA_COLORS[task.area] }} />
                      {AREA_LABELS[task.area]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      done ? "bg-emerald-50 text-emerald-600" :
                      task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600" :
                      task.status === "THIS_WEEK" ? "bg-indigo-50 text-indigo-600" :
                      task.status === "TODAY" ? "bg-purple-50 text-purple-600" :
                      "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    {task.dueDate ? (
                      <span className={`text-xs ${overdue && !done ? "text-red-500 font-medium" : "text-[var(--muted-foreground)]"}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    ) : <span className="text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {task.estimatedMinutes ? minutesToHours(task.estimatedMinutes) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500" onClick={() => handleDelete(task.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
