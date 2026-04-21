"use client";

import { useState, useMemo } from "react";
import { Task, TaskStatus, TaskArea, Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "./task-form";
import { TaskTable } from "./task-table";
import { TaskKanban } from "./task-kanban";
import { Plus, Search, LayoutList, Columns } from "lucide-react";
import { AREA_LABELS, STATUS_LABELS, isOverdue } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  initialTasks: Task[];
}

type ViewMode = "table" | "kanban";

const FILTER_PRESETS = [
  { label: "All", value: "all" },
  { label: "This Week", value: "this_week" },
  { label: "Today", value: "today" },
  { label: "Overdue", value: "overdue" },
  { label: "Backlog", value: "backlog" },
  { label: "Done", value: "done" },
  { label: "High Priority", value: "high" },
];

export function TasksClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    let result = tasks;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    if (areaFilter !== "all") {
      result = result.filter((t) => t.area === areaFilter);
    }

    switch (preset) {
      case "this_week":
        result = result.filter((t) => t.status === "THIS_WEEK");
        break;
      case "today":
        result = result.filter((t) => t.status === "TODAY" || t.status === "IN_PROGRESS");
        break;
      case "overdue":
        result = result.filter(
          (t) =>
            t.dueDate &&
            isOverdue(t.dueDate) &&
            !["DONE", "ARCHIVED", "SKIPPED"].includes(t.status)
        );
        break;
      case "backlog":
        result = result.filter((t) => t.status === "BACKLOG");
        break;
      case "done":
        result = result.filter((t) => t.status === "DONE");
        break;
      case "high":
        result = result.filter(
          (t) =>
            (t.priority === "HIGH" || t.priority === "CRITICAL") &&
            !["DONE", "ARCHIVED"].includes(t.status)
        );
        break;
    }

    // Sort by date depending on section
    if (preset === "done") {
      result = [...result].sort((a, b) => {
        const at = a.completedAt?.getTime() ?? 0;
        const bt = b.completedAt?.getTime() ?? 0;
        return bt - at; // most recently completed first
      });
    } else {
      result = [...result].sort((a, b) => {
        const aDone = a.status === "DONE" || a.status === "SKIPPED";
        const bDone = b.status === "DONE" || b.status === "SKIPPED";
        if (aDone !== bDone) return aDone ? 1 : -1; // completed tasks sink to bottom
        const at = a.dueDate?.getTime() ?? Infinity;
        const bt = b.dueDate?.getTime() ?? Infinity;
        if (at !== bt) return at - bt;
        return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      });
    }

    return result;
  }, [tasks, search, preset, areaFilter]);

  function onTaskSaved(task: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      return [task, ...prev];
    });
    setShowForm(false);
    setEditTask(null);
  }

  function onTaskDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const counts: Record<string, number> = {
    all: tasks.filter((t) => t.status !== "ARCHIVED").length,
    this_week: tasks.filter((t) => t.status === "THIS_WEEK").length,
    today: tasks.filter((t) => ["TODAY", "IN_PROGRESS"].includes(t.status)).length,
    overdue: tasks.filter((t) => t.dueDate && isOverdue(t.dueDate) && !["DONE", "ARCHIVED", "SKIPPED"].includes(t.status)).length,
    backlog: tasks.filter((t) => t.status === "BACKLOG").length,
    done: tasks.filter((t) => t.status === "DONE").length,
    high: tasks.filter((t) => ["HIGH", "CRITICAL"].includes(t.priority) && !["DONE", "ARCHIVED"].includes(t.status)).length,
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView(view === "table" ? "kanban" : "table")}
            title={view === "table" ? "Switch to Kanban" : "Switch to Table"}
          >
            {view === "table" ? (
              <Columns className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </Button>
          <Button size="sm" onClick={() => { setEditTask(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search tasks..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {Object.entries(AREA_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preset filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_PRESETS.map((f) => (
          <button
            key={f.value}
            onClick={() => setPreset(f.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              preset === f.value
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/50"
            }`}
          >
            {f.label}
            {counts[f.value] > 0 && (
              <span className={`text-[10px] ${preset === f.value ? "text-white/80" : "text-[var(--muted-foreground)]"}`}>
                {counts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* View */}
      {view === "table" ? (
        <TaskTable
          tasks={filtered}
          onEdit={(t) => { setEditTask(t); setShowForm(true); }}
          onDelete={onTaskDeleted}
          onUpdate={onTaskSaved}
        />
      ) : (
        <TaskKanban
          tasks={filtered}
          onEdit={(t) => { setEditTask(t); setShowForm(true); }}
          onDelete={onTaskDeleted}
          onUpdate={onTaskSaved}
        />
      )}

      {/* Task form modal */}
      <TaskForm
        open={showForm}
        task={editTask}
        onClose={() => { setShowForm(false); setEditTask(null); }}
        onSaved={onTaskSaved}
      />
    </div>
  );
}
