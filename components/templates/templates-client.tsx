"use client";

import { useMemo, useState } from "react";
import {
  RecurringCommitmentTemplate,
  RecurringTaskTemplate,
} from "@prisma/client";
import {
  CalendarRange,
  Clock3,
  Plus,
  RefreshCcw,
  Repeat,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  deleteRecurringCommitmentTemplate,
  deleteRecurringTaskTemplate,
  generateRecurringTasksNow,
  updateRecurringCommitmentTemplate,
  updateRecurringTaskTemplate,
} from "@/actions/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  AREA_LABELS,
  COMMITMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/utils";
import { WEEKDAY_OPTIONS } from "@/lib/planning";
import { RecurringCommitmentForm } from "./recurring-commitment-form";
import { RecurringTaskTemplateForm } from "./recurring-task-template-form";

interface Props {
  recurringCommitments: RecurringCommitmentTemplate[];
  recurringTaskTemplates: RecurringTaskTemplate[];
}

function weekdaySummary(days: number[]) {
  const labels = WEEKDAY_OPTIONS.filter((option) => days.includes(option.value)).map((option) => option.label);
  return labels.join(" · ");
}

function recurringTaskSummary(template: RecurringTaskTemplate) {
  const config = (template.recurrenceConfig ?? {}) as {
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number | null;
  };

  const interval = config.interval ?? 1;

  if (template.recurrenceType === "DAILY") {
    return interval === 1 ? "Every day" : `Every ${interval} days`;
  }

  if (template.recurrenceType === "MONTHLY") {
    return `Day ${config.dayOfMonth ?? 1} every ${interval} month${interval === 1 ? "" : "s"}`;
  }

  if (template.recurrenceType === "WEEKLY") {
    const days = weekdaySummary(config.daysOfWeek ?? []);
    return `${interval === 1 ? "Weekly" : `Every ${interval} weeks`} · ${days || "same day each week"}`;
  }

  return `Custom · ${weekdaySummary(config.daysOfWeek ?? []) || "manual pattern"}`;
}

export function TemplatesClient({
  recurringCommitments,
  recurringTaskTemplates,
}: Props) {
  const { toast } = useToast();
  const [commitments, setCommitments] = useState(recurringCommitments);
  const [taskTemplates, setTaskTemplates] = useState(recurringTaskTemplates);
  const [commitmentFormOpen, setCommitmentFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<RecurringCommitmentTemplate | null>(null);
  const [editingTaskTemplate, setEditingTaskTemplate] = useState<RecurringTaskTemplate | null>(null);

  const stats = useMemo(
    () => ({
      activeCommitments: commitments.filter((item) => item.isActive).length,
      activeTaskTemplates: taskTemplates.filter((item) => item.isActive).length,
      capacityCommitments: commitments.filter((item) => item.affectsCapacity && item.isActive).length,
    }),
    [commitments, taskTemplates]
  );

  async function handleDeleteCommitment(id: string) {
    try {
      await deleteRecurringCommitmentTemplate(id);
      setCommitments((current) => current.filter((item) => item.id !== id));
      toast({ title: "Recurring commitment deleted" });
    } catch (error) {
      toast({
        title: "Could not delete commitment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteTaskTemplate(id: string) {
    try {
      await deleteRecurringTaskTemplate(id);
      setTaskTemplates((current) => current.filter((item) => item.id !== id));
      toast({ title: "Recurring task template deleted" });
    } catch (error) {
      toast({
        title: "Could not delete template",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function toggleCommitment(template: RecurringCommitmentTemplate) {
    try {
      const result = await updateRecurringCommitmentTemplate(template.id, {
        isActive: !template.isActive,
      });
      setCommitments((current) =>
        current.map((item) => item.id === template.id ? result.template as RecurringCommitmentTemplate : item)
      );
      toast({ title: template.isActive ? "Commitment paused" : "Commitment resumed" });
    } catch (error) {
      toast({
        title: "Could not update commitment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function toggleTaskTemplate(template: RecurringTaskTemplate) {
    try {
      const result = await updateRecurringTaskTemplate(template.id, {
        isActive: !template.isActive,
      });
      setTaskTemplates((current) =>
        current.map((item) => item.id === template.id ? result.template as RecurringTaskTemplate : item)
      );
      toast({ title: template.isActive ? "Task template paused" : "Task template resumed" });
    } catch (error) {
      toast({
        title: "Could not update task template",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function generateTasks(template: RecurringTaskTemplate) {
    try {
      const result = await generateRecurringTasksNow(template.id);
      toast({
        title: result.createdCount > 0 ? "Recurring tasks generated" : "Nothing new to generate",
      });
    } catch (error) {
      toast({
        title: "Could not generate tasks",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Keep fixed commitments separate from recurring tasks, then let WeekFlow generate the right kind of work.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active commitments", value: stats.activeCommitments, icon: CalendarRange, color: "#0ea5e9" },
          { label: "Active task templates", value: stats.activeTaskTemplates, icon: Repeat, color: "#6366f1" },
          { label: "Capacity blockers", value: stats.capacityCommitments, icon: Clock3, color: "#f97316" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-4 w-4" style={{ color: card.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{card.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="commitments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="commitments">Recurring Commitments</TabsTrigger>
          <TabsTrigger value="tasks">Recurring Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="commitments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingCommitment(null); setCommitmentFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Recurring Commitment
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {commitments.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <Badge variant={template.isActive ? "secondary" : "outline"}>
                          {template.isActive ? "active" : "paused"}
                        </Badge>
                        {!template.affectsCapacity && (
                          <Badge variant="outline">doesn&apos;t affect capacity</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{COMMITMENT_TYPE_LABELS[template.type]}</Badge>
                        <Badge variant="outline">{weekdaySummary(template.daysOfWeek)}</Badge>
                        <Badge variant="outline">{template.startTime} - {template.endTime}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingCommitment(template); setCommitmentFormOpen(true); }}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleCommitment(template)}>
                    {template.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCommitment(template.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTaskTemplate(null); setTaskFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Recurring Task Template
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {taskTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <Badge variant={template.isActive ? "secondary" : "outline"}>
                          {template.isActive ? "active" : "paused"}
                        </Badge>
                        <Badge variant="outline">{STATUS_LABELS[template.defaultStatus]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{AREA_LABELS[template.area]}</Badge>
                        <Badge variant="outline">{PRIORITY_LABELS[template.priority]}</Badge>
                        {template.estimatedMinutes && <Badge variant="outline">{template.estimatedMinutes}m</Badge>}
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {recurringTaskSummary(template)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingTaskTemplate(template); setTaskFormOpen(true); }}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => generateTasks(template)}>
                    <RefreshCcw className="h-4 w-4" />
                    Generate now
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleTaskTemplate(template)}>
                    {template.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTaskTemplate(template.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <RecurringCommitmentForm
        open={commitmentFormOpen}
        template={editingCommitment}
        onClose={() => { setCommitmentFormOpen(false); setEditingCommitment(null); }}
        onSaved={(template) => {
          setCommitments((current) => {
            const index = current.findIndex((item) => item.id === template.id);
            if (index === -1) return [template, ...current];
            const updated = [...current];
            updated[index] = template;
            return updated;
          });
          setCommitmentFormOpen(false);
          setEditingCommitment(null);
        }}
      />

      <RecurringTaskTemplateForm
        open={taskFormOpen}
        template={editingTaskTemplate}
        onClose={() => { setTaskFormOpen(false); setEditingTaskTemplate(null); }}
        onSaved={(template) => {
          setTaskTemplates((current) => {
            const index = current.findIndex((item) => item.id === template.id);
            if (index === -1) return [template, ...current];
            const updated = [...current];
            updated[index] = template;
            return updated;
          });
          setTaskFormOpen(false);
          setEditingTaskTemplate(null);
        }}
      />
    </div>
  );
}
