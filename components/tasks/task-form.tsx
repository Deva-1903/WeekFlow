"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Task, TaskStatus, TaskArea, Priority, Urgency } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTask, updateTask } from "@/actions/tasks";
import { useToast } from "@/components/ui/use-toast";
import { AREA_LABELS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  area: z.nativeEnum(TaskArea).default("OTHER"),
  status: z.nativeEnum(TaskStatus).default("BACKLOG"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  urgency: z.nativeEnum(Urgency).default("MEDIUM"),
  estimatedMinutes: z.union([z.number().positive(), z.literal("")]).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

export function TaskForm({ open, task, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? "",
        area: task.area,
        status: task.status,
        priority: task.priority,
        urgency: task.urgency,
        estimatedMinutes: task.estimatedMinutes ?? "",
        dueDate: task.dueDate ? format(task.dueDate, "yyyy-MM-dd") : "",
        notes: task.notes ?? "",
      });
    } else {
      reset({ title: "", area: "OTHER", status: "BACKLOG", priority: "MEDIUM", urgency: "MEDIUM" });
    }
  }, [task, open, reset]);

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      estimatedMinutes: data.estimatedMinutes !== "" && data.estimatedMinutes !== undefined
        ? Number(data.estimatedMinutes)
        : null,
      dueDate: data.dueDate || null,
    };

    try {
      let result;
      if (task) {
        result = await updateTask(task.id, payload);
      } else {
        result = await createTask(payload);
      }
      toast({ title: task ? "Task updated" : "Task created" });
      onSaved(result.task as Task);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    }
  }

  const area = watch("area");
  const status = watch("status");
  const priority = watch("priority");
  const urgency = watch("urgency");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="What needs to be done?" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Optional details..." {...register("description")} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select value={area} onValueChange={(v) => setValue("area", v as TaskArea)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setValue("status", v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== "ARCHIVED").map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setValue("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setValue("urgency", v as Urgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estimate (minutes)</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 90"
                {...register("estimatedMinutes", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register("dueDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any notes..." {...register("notes")} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {task ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
