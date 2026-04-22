"use client";

import { useEffect } from "react";
import { FutureItem, FutureStatus, TaskArea } from "@prisma/client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { createFutureItem, updateFutureItem } from "@/actions/future-items";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { AREA_LABELS, FUTURE_STATUS_LABELS } from "@/lib/utils";
import { toLocalDateKey } from "@/lib/timezone";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  targetTimeframe: z.string().optional(),
  reviewDate: z.string().optional(),
  status: z.nativeEnum(FutureStatus).default("FUTURE"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  item: FutureItem | null;
  onClose: () => void;
  onSaved: (item: FutureItem) => void;
}

const TIMEFRAMES = ["Before semester", "Summer", "Fall", "Winter", "Later", "Someday"];

export function FutureItemForm({ open, item, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  useEffect(() => {
    if (item) {
      reset({
        title: item.title,
        description: item.description ?? "",
        category: item.category,
        targetTimeframe: item.targetTimeframe ?? "",
        reviewDate: item.reviewDate ? toLocalDateKey(item.reviewDate) : "",
        status: item.status,
      });
    } else {
      reset({
        title: "",
        description: "",
        category: "OTHER",
        targetTimeframe: "",
        reviewDate: "",
        status: "FUTURE",
      });
    }
  }, [item, open, reset]);

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        ...data,
        targetTimeframe: data.targetTimeframe || undefined,
        reviewDate: data.reviewDate || null,
      };

      const result = item
        ? await updateFutureItem(item.id, payload)
        : await createFutureItem(payload);

      toast({ title: item ? "Future item updated" : "Future item added" });
      onSaved(result.item as FutureItem);
    } catch (error) {
      toast({
        title: "Could not save future item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const category = watch("category");
  const status = watch("status");
  const timeframe = watch("targetTimeframe");

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Future Item" : "Add Future Item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="What should stay on your radar?" {...register("title")} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} placeholder="Why this matters, links, context..." {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setValue("category", value as TaskArea)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setValue("status", value as FutureStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FUTURE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target timeframe</Label>
              <Select value={timeframe || "none"} onValueChange={(value) => setValue("targetTimeframe", value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TIMEFRAMES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Review date</Label>
              <Input type="date" {...register("reviewDate")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {item ? "Save Changes" : "Create Future Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
