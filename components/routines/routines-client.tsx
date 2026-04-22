"use client";

import { useState } from "react";
import {
  RecurringRoutine,
  RoutineRecurrenceType,
  RoutineSession,
  RoutineStrictnessMode,
  RoutineTargetPeriod,
  TaskArea,
  TaskStatus,
} from "@prisma/client";
import { CalendarDays, CheckCircle2, Loader2, Pause, Play, Plus, Repeat, Sparkles } from "lucide-react";
import { createRoutine, generateRoutineTasksNow, logRoutineSession, toggleRoutineActive, updateRoutine } from "@/actions/routines";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  AREA_COLORS,
  AREA_LABELS,
  ROUTINE_RECURRENCE_LABELS,
  ROUTINE_STRICTNESS_LABELS,
  minutesToHours,
} from "@/lib/utils";

type RoutineRecord = RecurringRoutine & {
  sessions: RoutineSession[];
  generatedTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: Date | null;
  }[];
};

interface Props {
  initialRoutines: RoutineRecord[];
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const emptyForm = {
  title: "",
  description: "",
  category: "OTHER" as TaskArea,
  recurrenceType: "WEEKLY" as RoutineRecurrenceType,
  targetCount: 1,
  targetPeriod: "WEEK" as RoutineTargetPeriod,
  preferredDays: [] as number[],
  preferredTime: "",
  strictnessMode: "FLEXIBLE" as RoutineStrictnessMode,
  generateTasks: false,
  defaultTaskTitle: "",
  defaultEffortEstimate: "",
  isActive: true,
};

export function RoutinesClient({ initialRoutines }: Props) {
  const { toast } = useToast();
  const [routines, setRoutines] = useState<RoutineRecord[]>(initialRoutines);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoutineRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(routine: RoutineRecord) {
    setEditing(routine);
    setForm({
      title: routine.title,
      description: routine.description ?? "",
      category: routine.category,
      recurrenceType: routine.recurrenceType,
      targetCount: routine.targetCount,
      targetPeriod: routine.targetPeriod,
      preferredDays: routine.preferredDays,
      preferredTime: routine.preferredTime ?? "",
      strictnessMode: routine.strictnessMode,
      generateTasks: routine.generateTasks,
      defaultTaskTitle: routine.defaultTaskTitle ?? "",
      defaultEffortEstimate: routine.defaultEffortEstimate ? String(routine.defaultEffortEstimate) : "",
      isActive: routine.isActive,
    });
    setOpen(true);
  }

  function toggleDay(day: number) {
    setForm((current) => ({
      ...current,
      preferredDays: current.preferredDays.includes(day)
        ? current.preferredDays.filter((value) => value !== day)
        : [...current.preferredDays, day].sort(),
    }));
  }

  async function saveRoutine(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        recurrenceType: form.recurrenceType,
        targetCount: Number(form.targetCount),
        targetPeriod: form.targetPeriod,
        preferredDays: form.preferredDays,
        preferredTime: form.preferredTime || undefined,
        strictnessMode: form.strictnessMode,
        generateTasks: form.generateTasks,
        defaultTaskTitle: form.defaultTaskTitle.trim() || undefined,
        defaultTaskCategory: form.category,
        defaultEffortEstimate: form.defaultEffortEstimate ? Number(form.defaultEffortEstimate) : null,
        isActive: form.isActive,
      };

      const result = editing
        ? await updateRoutine(editing.id, payload)
        : await createRoutine(payload);

      setRoutines((current) => {
        const nextRoutine = { ...(result.routine as RecurringRoutine), sessions: editing?.sessions ?? [], generatedTasks: editing?.generatedTasks ?? [] };
        const index = current.findIndex((routine) => routine.id === nextRoutine.id);
        if (index === -1) return [nextRoutine as RoutineRecord, ...current];
        const next = [...current];
        next[index] = nextRoutine as RoutineRecord;
        return next;
      });
      setOpen(false);
      toast({ title: editing ? "Routine updated" : "Routine created" });
    } catch (error) {
      toast({
        title: "Could not save routine",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function markDone(routine: RoutineRecord) {
    setWorkingId(routine.id);
    try {
      const result = await logRoutineSession(routine.id);
      setRoutines((current) =>
        current.map((entry) =>
          entry.id === routine.id
            ? { ...entry, sessions: [result.session as RoutineSession, ...entry.sessions] }
            : entry
        )
      );
      toast({ title: "Routine session logged" });
    } catch (error) {
      toast({
        title: "Could not log session",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleActive(routine: RoutineRecord) {
    setWorkingId(routine.id);
    try {
      await toggleRoutineActive(routine.id, !routine.isActive);
      setRoutines((current) =>
        current.map((entry) =>
          entry.id === routine.id ? { ...entry, isActive: !entry.isActive } : entry
        )
      );
    } catch (error) {
      toast({
        title: "Could not update routine",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWorkingId(null);
    }
  }

  async function generateTasks(routine: RoutineRecord) {
    setWorkingId(routine.id);
    try {
      const result = await generateRoutineTasksNow(routine.id);
      toast({ title: "Routine tasks generated", description: `${result.createdCount} task(s) ready.` });
    } catch (error) {
      toast({
        title: "Could not generate tasks",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routines</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Flexible recurring targets and task generators. Gym can be 4x/week without becoming a brittle calendar block.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Routine
        </Button>
      </div>

      {routines.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-[var(--muted-foreground)]">
            Add a routine to keep recurring work alive.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {routines.map((routine) => {
            const progress = Math.min(100, Math.round((routine.sessions.length / Math.max(1, routine.targetCount)) * 100));
            const color = AREA_COLORS[routine.category] ?? "#6366f1";
            return (
              <Card key={routine.id} className={!routine.isActive ? "opacity-70" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        {routine.title}
                      </CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{AREA_LABELS[routine.category]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ROUTINE_STRICTNESS_LABELS[routine.strictnessMode]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ROUTINE_RECURRENCE_LABELS[routine.recurrenceType]}</Badge>
                        {routine.generateTasks && <Badge variant="success" className="text-[10px]">generates tasks</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(routine)}>Edit</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {routine.description && (
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{routine.description}</p>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>{routine.sessions.length}/{routine.targetCount} this {routine.targetPeriod.toLowerCase()}</span>
                      <span className="text-[var(--muted-foreground)]">{progress}%</span>
                    </div>
                    <Progress value={progress} indicatorColor={color} />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                    {routine.preferredDays.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {routine.preferredDays.map((day) => DAYS.find((entry) => entry.value === day)?.label).join(", ")}
                      </span>
                    )}
                    {routine.preferredTime && <span>{routine.preferredTime}</span>}
                    {routine.defaultEffortEstimate && <span>{minutesToHours(routine.defaultEffortEstimate)}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => markDone(routine)} disabled={workingId === routine.id || !routine.isActive}>
                      {workingId === routine.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Log Session
                    </Button>
                    {routine.generateTasks && (
                      <Button size="sm" variant="outline" onClick={() => generateTasks(routine)} disabled={workingId === routine.id || !routine.isActive}>
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(routine)} disabled={workingId === routine.id}>
                      {routine.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {routine.isActive ? "Pause" : "Resume"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              {editing ? "Edit Routine" : "New Routine"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveRoutine} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Gym, DSA daily, research deep work..." />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} placeholder="What counts as a session?" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value as TaskArea })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AREA_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Strictness</Label>
                <Select value={form.strictnessMode} onValueChange={(value) => setForm({ ...form, strictnessMode: value as RoutineStrictnessMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLEXIBLE">Flexible target</SelectItem>
                    <SelectItem value="FIXED">Fixed preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Target count</Label>
                <Input type="number" min={1} max={14} value={form.targetCount} onChange={(event) => setForm({ ...form, targetCount: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Target period</Label>
                <Select value={form.targetPeriod} onValueChange={(value) => setForm({ ...form, targetPeriod: value as RoutineTargetPeriod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">Per day</SelectItem>
                    <SelectItem value="WEEK">Per week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Recurrence</Label>
                <Select value={form.recurrenceType} onValueChange={(value) => setForm({ ...form, recurrenceType: value as RoutineRecurrenceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    type="button"
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.preferredDays.includes(day.value)
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preferred time</Label>
                <Input type="time" value={form.preferredTime} onChange={(event) => setForm({ ...form, preferredTime: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default effort minutes</Label>
                <Input type="number" min={1} value={form.defaultEffortEstimate} onChange={(event) => setForm({ ...form, defaultEffortEstimate: event.target.value })} placeholder="Optional" />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Generate tasks</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Turn this routine into concrete tasks for the current period.</p>
                </div>
                <Switch checked={form.generateTasks} onCheckedChange={(checked) => setForm({ ...form, generateTasks: checked })} />
              </div>
              {form.generateTasks && (
                <Input value={form.defaultTaskTitle} onChange={(event) => setForm({ ...form, defaultTaskTitle: event.target.value })} placeholder="Optional generated task title" />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Create Routine"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
