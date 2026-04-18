"use client";

import { useEffect } from "react";
import { CommitmentType, RecurringCommitmentTemplate } from "@prisma/client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  createRecurringCommitmentTemplate,
  updateRecurringCommitmentTemplate,
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
import { useToast } from "@/components/ui/use-toast";
import { COMMITMENT_TYPE_LABELS } from "@/lib/utils";
import { WEEKDAY_OPTIONS } from "@/lib/planning";
import { format } from "date-fns";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(CommitmentType).default("OTHER"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day"),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  affectsCapacity: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  template: RecurringCommitmentTemplate | null;
  onClose: () => void;
  onSaved: (template: RecurringCommitmentTemplate) => void;
}

export function RecurringCommitmentForm({ open, template, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  useEffect(() => {
    if (template) {
      reset({
        title: template.title,
        type: template.type,
        daysOfWeek: template.daysOfWeek,
        startTime: template.startTime,
        endTime: template.endTime,
        startDate: template.startDate ? format(template.startDate, "yyyy-MM-dd") : "",
        endDate: template.endDate ? format(template.endDate, "yyyy-MM-dd") : "",
        affectsCapacity: template.affectsCapacity,
        isActive: template.isActive,
      });
    } else {
      reset({
        title: "",
        type: "OTHER",
        daysOfWeek: [1],
        startTime: "09:00",
        endTime: "10:00",
        startDate: "",
        endDate: "",
        affectsCapacity: true,
        isActive: true,
      });
    }
  }, [template, open, reset]);

  const values = watch();

  function toggleDay(day: number) {
    const days = values.daysOfWeek ?? [];
    const next = days.includes(day)
      ? days.filter((value) => value !== day)
      : [...days, day].sort((left, right) => left - right);

    setValue("daysOfWeek", next, { shouldValidate: true });
  }

  async function onSubmit(data: FormData) {
    try {
      const result = template
        ? await updateRecurringCommitmentTemplate(template.id, {
            ...data,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
          })
        : await createRecurringCommitmentTemplate({
            ...data,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
          });

      toast({ title: template ? "Recurring commitment updated" : "Recurring commitment created" });
      onSaved(result.template as RecurringCommitmentTemplate);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save recurring commitment.",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Recurring Commitment" : "New Recurring Commitment"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="Advisor meeting, gym, class..." {...register("title")} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={values.type} onValueChange={(value) => setValue("type", value as CommitmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMITMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Affects capacity</Label>
              <div className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2.5">
                <span className="text-sm">Counts against weekly focus room</span>
                <Switch checked={values.affectsCapacity} onCheckedChange={(checked) => setValue("affectsCapacity", checked)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Days</Label>
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
            {errors.daysOfWeek && <p className="text-xs text-red-500">{errors.daysOfWeek.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" {...register("startTime")} />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input type="time" {...register("endTime")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" {...register("startDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" {...register("endDate")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-[var(--muted-foreground)]">Generate blocks in the calendar view</p>
            </div>
            <Switch checked={values.isActive} onCheckedChange={(checked) => setValue("isActive", checked)} />
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
