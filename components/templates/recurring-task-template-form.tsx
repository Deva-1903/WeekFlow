"use client";

import { useEffect } from "react";
import {
  Priority,
  RecurringFrequency,
  RecurringTaskTemplate,
  TaskArea,
  TaskStatus,
} from "@prisma/client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  createRecurringTaskTemplate,
  updateRecurringTaskTemplate,
} from "@/actions/templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { AREA_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/utils";
import { WEEKDAY_OPTIONS } from "@/lib/planning";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  area: z.nativeEnum(TaskArea).default("OTHER"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  estimatedMinutes: z.union([z.number().int().positive(), z.literal("")]).optional(),
  recurrenceType: z.nativeEnum(RecurringFrequency).default("WEEKLY"),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  dayOfMonth: z.union([z.number().int().min(1).max(31), z.literal("")]).optional(),
  generateDaysAhead: z.number().int().min(0).max(90).default(14),
  defaultStatus: z.nativeEnum(TaskStatus).default("BACKLOG"),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  template: RecurringTaskTemplate | null;
  onClose: () => void;
  onSaved: (template: RecurringTaskTemplate) => void;
}

export function RecurringTaskTemplateForm({ open, template, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const existingConfig = (template?.recurrenceConfig ?? {}) as {
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number | null;
    generateDaysAhead?: number;
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  useEffect(() => {
    if (template) {
      reset({
        title: template.title,
        description: template.description ?? "",
        area: template.area,
        priority: template.priority,
        estimatedMinutes: template.estimatedMinutes ?? "",
        recurrenceType: template.recurrenceType,
        interval: existingConfig.interval ?? 1,
        daysOfWeek: existingConfig.daysOfWeek ?? [],
        dayOfMonth: existingConfig.dayOfMonth ?? "",
        generateDaysAhead: existingConfig.generateDaysAhead ?? 14,
        defaultStatus: template.defaultStatus,
        isActive: template.isActive,
      });
    } else {
      reset({
        title: "",
        description: "",
        area: "OTHER",
        priority: "MEDIUM",
        estimatedMinutes: "",
        recurrenceType: "WEEKLY",
        interval: 1,
        daysOfWeek: [0],
        dayOfMonth: "",
        generateDaysAhead: 14,
        defaultStatus: "BACKLOG",
        isActive: true,
      });
    }
  }, [existingConfig.dayOfMonth, existingConfig.daysOfWeek, existingConfig.generateDaysAhead, existingConfig.interval, open, reset, template]);

  const values = watch();

  function toggleDay(day: number) {
    const days = values.daysOfWeek ?? [];
    const next = days.includes(day)
      ? days.filter((value) => value !== day)
      : [...days, day].sort((left, right) => left - right);

    setValue("daysOfWeek", next);
  }

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        ...data,
        estimatedMinutes:
          data.estimatedMinutes !== "" && data.estimatedMinutes !== undefined
            ? Number(data.estimatedMinutes)
            : null,
        dayOfMonth:
          data.dayOfMonth !== "" && data.dayOfMonth !== undefined
            ? Number(data.dayOfMonth)
            : null,
      };

      const result = template
        ? await updateRecurringTaskTemplate(template.id, payload)
        : await createRecurringTaskTemplate(payload);

      toast({ title: template ? "Recurring task template updated" : "Recurring task template created" });
      onSaved(result.template as RecurringTaskTemplate);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save recurring task template.",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Recurring Task Template" : "New Recurring Task Template"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="Weekly review, meal prep, laundry..." {...register("title")} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} placeholder="What should get generated each cycle?" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select value={values.area} onValueChange={(value) => setValue("area", value as TaskArea)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={values.priority} onValueChange={(value) => setValue("priority", value as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estimated minutes</Label>
              <Input type="number" min={1} {...register("estimatedMinutes", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Default status</Label>
              <Select value={values.defaultStatus} onValueChange={(value) => setValue("defaultStatus", value as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS)
                    .filter(([value]) => !["ARCHIVED", "DONE", "SKIPPED"].includes(value))
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={values.recurrenceType} onValueChange={(value) => setValue("recurrenceType", value as RecurringFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Every</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} {...register("interval", { valueAsNumber: true })} />
                <span className="text-sm text-[var(--muted-foreground)]">
                  {values.recurrenceType === "MONTHLY" ? "month(s)" : values.recurrenceType === "DAILY" ? "day(s)" : "week(s)"}
                </span>
              </div>
            </div>
          </div>

          {(values.recurrenceType === "WEEKLY" || values.recurrenceType === "CUSTOM") && (
            <div className="space-y-2">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = (values.daysOfWeek ?? []).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {values.recurrenceType === "MONTHLY" && (
            <div className="space-y-1.5">
              <Label>Day of month</Label>
              <Input type="number" min={1} max={31} {...register("dayOfMonth", { valueAsNumber: true })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Generate ahead</Label>
              <Input type="number" min={0} max={90} {...register("generateDaysAhead", { valueAsNumber: true })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-[var(--muted-foreground)]">Auto-generate tasks</p>
              </div>
              <Switch checked={values.isActive} onCheckedChange={(checked) => setValue("isActive", checked)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {template ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
