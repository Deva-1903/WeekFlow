"use client";

import { useEffect } from "react";
import { SomedayItem, SomedayStatus, TaskArea } from "@prisma/client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { createSomedayItem, updateSomedayItem } from "@/actions/future";
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
import { AREA_LABELS, SOMEDAY_STATUS_LABELS } from "@/lib/utils";
import { ROUGH_EFFORT_OPTIONS, TARGET_TIMEFRAME_OPTIONS } from "@/lib/planning";
import { format } from "date-fns";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.nativeEnum(TaskArea).default("OTHER"),
  roughEffort: z.string().optional(),
  targetTimeframe: z.string().optional(),
  reviewDate: z.string().optional(),
  isImportant: z.boolean().default(false),
  status: z.nativeEnum(SomedayStatus).default("SOMEDAY"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  item: SomedayItem | null;
  onClose: () => void;
  onSaved: (item: SomedayItem) => void;
}

export function FutureItemForm({ open, item, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  useEffect(() => {
    if (item) {
      reset({
        title: item.title,
        description: item.description ?? "",
        category: item.category,
        roughEffort: item.roughEffort ?? "",
        targetTimeframe: item.targetTimeframe ?? "",
        reviewDate: item.reviewDate ? format(item.reviewDate, "yyyy-MM-dd") : "",
        isImportant: item.isImportant,
        status: item.status,
      });
    } else {
      reset({
        title: "",
        category: "OTHER",
        roughEffort: "",
        targetTimeframe: "",
        reviewDate: "",
        isImportant: false,
        status: "SOMEDAY",
      });
    }
  }, [item, open, reset]);

  const category = watch("category");
  const status = watch("status");
  const isImportant = watch("isImportant");

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        ...data,
        roughEffort: data.roughEffort || undefined,
        targetTimeframe: data.targetTimeframe || undefined,
        reviewDate: data.reviewDate || null,
      };

      const result = item
        ? await updateSomedayItem(item.id, payload)
        : await createSomedayItem(payload);

      toast({ title: item ? "Future item updated" : "Future item added" });
      onSaved(result.item as SomedayItem);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save future item.",
        variant: "destructive",
      });
    }
  }

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
            <Textarea rows={3} placeholder="Context, links, or why this matters later..." {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setValue("category", value as TaskArea)}>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setValue("status", value as SomedayStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOMEDAY_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rough effort</Label>
              <Select value={watch("roughEffort") || "none"} onValueChange={(value) => setValue("roughEffort", value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ROUGH_EFFORT_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timeframe</Label>
              <Select value={watch("targetTimeframe") || "none"} onValueChange={(value) => setValue("targetTimeframe", value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TARGET_TIMEFRAME_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Review date</Label>
              <Input type="date" {...register("reviewDate")} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-3">
              <div>
                <p className="text-sm font-medium">Important</p>
                <p className="text-xs text-[var(--muted-foreground)]">Keep this visible in review widgets</p>
              </div>
              <Switch
                checked={isImportant}
                onCheckedChange={(checked) => setValue("isImportant", checked)}
              />
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
