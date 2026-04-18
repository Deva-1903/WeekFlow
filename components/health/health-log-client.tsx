"use client";

import { useState } from "react";
import { HealthLog, ActivityType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertHealthLog } from "@/actions/health";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfDay } from "date-fns";
import { ACTIVITY_TYPE_LABELS, formatDate } from "@/lib/utils";
import { Cigarette, Wine, Dumbbell, CheckCircle2, Loader2 } from "lucide-react";

const schema = z.object({
  date: z.string(),
  smokedToday: z.boolean(),
  cigaretteCount: z.union([z.number().int().positive(), z.literal("")]).optional(),
  drankAlcoholToday: z.boolean(),
  alcoholCount: z.union([z.number().int().positive(), z.literal("")]).optional(),
  didPhysicalActivityToday: z.boolean(),
  activityType: z.nativeEnum(ActivityType).optional().nullable(),
  activityDurationMinutes: z.union([z.number().int().positive(), z.literal("")]).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  todayLog: HealthLog | null;
  recentLogs: HealthLog[];
}

export function HealthLogClient({ todayLog, recentLogs }: Props) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<HealthLog[]>(recentLogs);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const displayLog = logs.find(
    (l) => l.date.toISOString().split("T")[0] === selectedDate
  ) ?? (selectedDate === format(new Date(), "yyyy-MM-dd") ? todayLog : null);

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      smokedToday: todayLog?.smokedToday ?? false,
      cigaretteCount: todayLog?.cigaretteCount ?? "",
      drankAlcoholToday: todayLog?.drankAlcoholToday ?? false,
      alcoholCount: todayLog?.alcoholCount ?? "",
      didPhysicalActivityToday: todayLog?.didPhysicalActivityToday ?? false,
      activityType: todayLog?.activityType ?? null,
      activityDurationMinutes: todayLog?.activityDurationMinutes ?? "",
      notes: todayLog?.notes ?? "",
    },
  });

  const smoked = watch("smokedToday");
  const drank = watch("drankAlcoholToday");
  const active = watch("didPhysicalActivityToday");
  const activityType = watch("activityType");

  function loadLogForDate(date: string) {
    setSelectedDate(date);
    const log = logs.find((l) => l.date.toISOString().split("T")[0] === date);
    reset({
      date,
      smokedToday: log?.smokedToday ?? false,
      cigaretteCount: log?.cigaretteCount ?? "",
      drankAlcoholToday: log?.drankAlcoholToday ?? false,
      alcoholCount: log?.alcoholCount ?? "",
      didPhysicalActivityToday: log?.didPhysicalActivityToday ?? false,
      activityType: log?.activityType ?? null,
      activityDurationMinutes: log?.activityDurationMinutes ?? "",
      notes: log?.notes ?? "",
    });
  }

  async function onSubmit(data: FormData) {
    try {
      const result = await upsertHealthLog({
        ...data,
        cigaretteCount: data.cigaretteCount !== "" ? Number(data.cigaretteCount) : null,
        alcoholCount: data.alcoholCount !== "" ? Number(data.alcoholCount) : null,
        activityDurationMinutes: data.activityDurationMinutes !== "" ? Number(data.activityDurationMinutes) : null,
      });
      toast({ title: "Health log saved" });
      setLogs((prev) => {
        const dateKey = data.date;
        const idx = prev.findIndex((l) => l.date.toISOString().split("T")[0] === dateKey);
        const updated = result.log as HealthLog;
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime());
      });
    } catch {
      toast({ title: "Error saving log", variant: "destructive" });
    }
  }

  // Weekly summary
  const weekStart = startOfDay(new Date());
  const last7 = logs.filter((l) => {
    const d = l.date.getTime();
    const now = new Date().getTime();
    return now - d <= 7 * 24 * 60 * 60 * 1000;
  });
  const smokeDays = last7.filter((l) => l.smokedToday).length;
  const alcoholDays = last7.filter((l) => l.drankAlcoholToday).length;
  const activeDays = last7.filter((l) => l.didPhysicalActivityToday).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Health Log</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Track daily habits and behavior signals.
        </p>
      </div>

      {/* Week summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Smoke days (7d)", value: smokeDays, icon: Cigarette, color: smokeDays > 0 ? "#ef4444" : "#10b981", reverse: true },
          { label: "Alcohol days (7d)", value: alcoholDays, icon: Wine, color: alcoholDays > 0 ? "#f59e0b" : "#10b981", reverse: true },
          { label: "Active days (7d)", value: activeDays, icon: Dumbbell, color: activeDays > 0 ? "#10b981" : "#94a3b8", reverse: false },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}<span className="text-sm font-normal text-[var(--muted-foreground)]">/7</span></div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log form */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Log Entry</CardTitle>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => loadLogForDate(e.target.value)}
                className="w-36 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <input type="hidden" {...register("date")} value={selectedDate} />

              {/* Smoking */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Cigarette className="h-4 w-4 text-[var(--muted-foreground)]" />
                    Smoked today?
                  </Label>
                  <Switch checked={smoked} onCheckedChange={(v) => setValue("smokedToday", v)} />
                </div>
                {smoked && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input
                      type="number"
                      min={1}
                      placeholder="How many cigarettes?"
                      {...register("cigaretteCount", { valueAsNumber: true })}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Alcohol */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Wine className="h-4 w-4 text-[var(--muted-foreground)]" />
                    Drank alcohol today?
                  </Label>
                  <Switch checked={drank} onCheckedChange={(v) => setValue("drankAlcoholToday", v)} />
                </div>
                {drank && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Number of drinks?"
                      {...register("alcoholCount", { valueAsNumber: true })}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-[var(--muted-foreground)]" />
                    Physical activity today?
                  </Label>
                  <Switch checked={active} onCheckedChange={(v) => setValue("didPhysicalActivityToday", v)} />
                </div>
                {active && (
                  <div className="pl-6 space-y-2">
                    <Select value={activityType ?? ""} onValueChange={(v) => setValue("activityType", v as ActivityType || null)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Type of activity" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Duration (minutes)"
                      {...register("activityDurationMinutes", { valueAsNumber: true })}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Anything notable today..."
                  {...register("notes")}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Log
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Recent History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                  No logs yet. Start logging today.
                </p>
              ) : (
                logs.slice(0, 30).map((log) => {
                  const dateKey = log.date.toISOString().split("T")[0];
                  const isSelected = dateKey === selectedDate;
                  return (
                    <div
                      key={log.id}
                      onClick={() => loadLogForDate(dateKey)}
                      className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors border ${
                        isSelected ? "border-[var(--primary)]/30 bg-[var(--primary)]/5" : "border-transparent hover:bg-[var(--muted)]/50"
                      }`}
                    >
                      <div className="text-xs font-medium text-[var(--muted-foreground)] w-16 shrink-0">
                        {format(log.date, "MMM d")}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <Cigarette className={`h-3.5 w-3.5 ${log.smokedToday ? "text-red-400" : "text-[var(--muted-foreground)]/30"}`} />
                        <Wine className={`h-3.5 w-3.5 ${log.drankAlcoholToday ? "text-amber-400" : "text-[var(--muted-foreground)]/30"}`} />
                        <Dumbbell className={`h-3.5 w-3.5 ${log.didPhysicalActivityToday ? "text-emerald-500" : "text-[var(--muted-foreground)]/30"}`} />
                        {log.activityType && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">{ACTIVITY_TYPE_LABELS[log.activityType]}</span>
                        )}
                        {log.activityDurationMinutes && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">{log.activityDurationMinutes}m</span>
                        )}
                      </div>
                      {!log.smokedToday && !log.drankAlcoholToday && log.didPhysicalActivityToday && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
