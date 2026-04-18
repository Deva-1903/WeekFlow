"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TimeBlock, TimeBlockType, TimeBlockStatus, Task, TaskArea } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTimeBlock, updateTimeBlock } from "@/actions/time-blocks";
import { useToast } from "@/components/ui/use-toast";
import { BLOCK_TYPE_LABELS } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  taskId: z.string().optional(),
  blockType: z.nativeEnum(TimeBlockType).default("DEEP_WORK"),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int().positive(),
  notes: z.string().optional(),
  status: z.nativeEnum(TimeBlockStatus).default("PLANNED"),
});

type FormData = z.infer<typeof schema>;

type BlockWithTask = TimeBlock & {
  task?: { id: string; title: string; area: TaskArea } | null;
};

type AvailableTask = Pick<Task, "id" | "title" | "area" | "estimatedMinutes" | "status">;

interface Props {
  open: boolean;
  block: BlockWithTask | null;
  defaultDate?: string;
  availableTasks: AvailableTask[];
  onClose: () => void;
  onSaved: (block: BlockWithTask) => void;
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export function TimeBlockForm({ open, block, defaultDate, availableTasks, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { blockType: "DEEP_WORK", status: "PLANNED", date: defaultDate ?? format(new Date(), "yyyy-MM-dd") },
  });

  const startTime = watch("startTime");
  const endTime = watch("endTime");

  useEffect(() => {
    if (startTime && endTime) {
      const dur = calcDuration(startTime, endTime);
      if (dur > 0) setValue("durationMinutes", dur);
    }
  }, [startTime, endTime, setValue]);

  useEffect(() => {
    if (block) {
      reset({
        title: block.title,
        taskId: block.taskId ?? undefined,
        blockType: block.blockType,
        date: format(block.date, "yyyy-MM-dd"),
        startTime: block.startTime,
        endTime: block.endTime,
        durationMinutes: block.durationMinutes,
        notes: block.notes ?? "",
        status: block.status,
      });
    } else {
      reset({
        title: "",
        blockType: "DEEP_WORK",
        status: "PLANNED",
        date: defaultDate ?? format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        durationMinutes: 60,
      });
    }
  }, [block, open, defaultDate, reset]);

  const blockType = watch("blockType");
  const status = watch("status");
  const taskId = watch("taskId");

  async function onSubmit(data: FormData) {
    try {
      let result;
      if (block) {
        result = await updateTimeBlock(block.id, data);
      } else {
        result = await createTimeBlock(data);
      }
      const savedBlock = result.block as BlockWithTask;
      // Attach task info if selected
      const task = availableTasks.find((t) => t.id === data.taskId);
      if (task) {
        savedBlock.task = { id: task.id, title: task.title, area: task.area };
      }
      toast({ title: block ? "Block updated" : "Block created" });
      if (result.conflicts?.length) {
        const titles = result.conflicts
          .slice(0, 2)
          .map((conflict: { title: string }) => conflict.title)
          .join(", ");
        toast({
          title: "Conflict with a fixed commitment",
          description: titles
            ? `This block overlaps ${titles}.`
            : "This block overlaps an imported or recurring commitment.",
          variant: "destructive",
        });
      }
      onSaved(savedBlock);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{block ? "Edit Time Block" : "New Time Block"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="What are you working on?" {...register("title")} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={blockType} onValueChange={(v) => setValue("blockType", v as TimeBlockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BLOCK_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register("date")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" {...register("startTime")} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" {...register("endTime")} />
            </div>
            <div className="space-y-1.5">
              <Label>Minutes</Label>
              <Input type="number" {...register("durationMinutes", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link to Task (optional)</Label>
            <Select value={taskId ?? ""} onValueChange={(v) => setValue("taskId", v || undefined)}>
              <SelectTrigger><SelectValue placeholder="No task linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {availableTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {block && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setValue("status", v as TimeBlockStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="MISSED">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Optional..." {...register("notes")} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {block ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
