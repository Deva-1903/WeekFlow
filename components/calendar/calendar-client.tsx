"use client";

import { useMemo, useState } from "react";
import { Task, TaskArea, TimeBlock, TimeBlockStatus } from "@prisma/client";
import type { FixedCommitment } from "@/lib/commitments";
import { addDays, format, isToday } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { deleteTimeBlock, updateTimeBlock } from "@/actions/time-blocks";
import { TimeBlockForm } from "./time-block-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  BLOCK_TYPE_COLORS,
  COMMITMENT_TYPE_LABELS,
  EVENT_SOURCE_LABELS,
  formatDate,
} from "@/lib/utils";
import { getDateWithTimeRange, rangesOverlap } from "@/lib/planning";

type BlockWithTask = TimeBlock & {
  task?: { id: string; title: string; area: TaskArea } | null;
};

type AvailableTask = Pick<Task, "id" | "title" | "area" | "estimatedMinutes" | "status">;

type CalendarEntry =
  | {
      kind: "block";
      id: string;
      title: string;
      date: Date;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      color: string;
      status: TimeBlockStatus;
      block: BlockWithTask;
      conflicts: FixedCommitment[];
    }
  | {
      kind: "commitment";
      id: string;
      title: string;
      date: Date;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      color: string;
      commitment: FixedCommitment;
    };

interface Props {
  initialBlocks: BlockWithTask[];
  availableTasks: AvailableTask[];
  fixedCommitments: FixedCommitment[];
  weekStart: Date;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isVisibleSource(kind: CalendarEntry["kind"], sourceType: string, filters: Record<string, boolean>) {
  if (kind === "block") return filters.INTERNAL;
  return filters[sourceType] ?? true;
}

export function CalendarClient({
  initialBlocks,
  availableTasks,
  fixedCommitments,
  weekStart,
}: Props) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<BlockWithTask[]>(initialBlocks);
  const [showForm, setShowForm] = useState(false);
  const [editBlock, setEditBlock] = useState<BlockWithTask | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filters, setFilters] = useState({
    INTERNAL: true,
    EXTERNAL_SYNC: true,
    RECURRING_COMMITMENT: true,
  });
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);

  const weekDays = WEEK_DAYS.map((_, index) => addDays(weekStart, index));

  const conflictMap = useMemo(
    () =>
      new Map(
        blocks.map((block) => {
          const { startDateTime, endDateTime } = getDateWithTimeRange(
            block.date,
            block.startTime,
            block.endTime
          );

          const overlaps = fixedCommitments.filter((commitment) =>
            rangesOverlap(
              startDateTime,
              endDateTime,
              commitment.startDateTime,
              commitment.endDateTime
            )
          );

          return [block.id, overlaps] as const;
        })
      ),
    [blocks, fixedCommitments]
  );

  const entries = useMemo(() => {
    const manualEntries: CalendarEntry[] = blocks.map((block) => ({
      kind: "block",
      id: block.id,
      title: block.title,
      date: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      color: BLOCK_TYPE_COLORS[block.blockType],
      status: block.status,
      block,
      conflicts: conflictMap.get(block.id) ?? [],
    }));

    const commitmentEntries: CalendarEntry[] = fixedCommitments.map((commitment) => ({
      kind: "commitment",
      id: commitment.id,
      title: commitment.title,
      date: commitment.date,
      startTime: commitment.startTime,
      endTime: commitment.endTime,
      durationMinutes: commitment.durationMinutes,
      color: commitment.color ?? "#94a3b8",
      commitment,
    }));

    return [...manualEntries, ...commitmentEntries].sort((left, right) => {
      const leftKey = `${format(left.date, "yyyyMMdd")}${left.startTime}`;
      const rightKey = `${format(right.date, "yyyyMMdd")}${right.startTime}`;
      return leftKey.localeCompare(rightKey);
    });
  }, [blocks, conflictMap, fixedCommitments]);

  const visibleEntries = entries.filter((entry) =>
    entry.kind === "block"
      ? isVisibleSource(entry.kind, "INTERNAL", filters)
      : isVisibleSource(entry.kind, entry.commitment.sourceType, filters)
  );

  const stats = {
    manualBlocks: blocks.length,
    importedEvents: fixedCommitments.filter((item) => item.sourceType === "EXTERNAL_SYNC").length,
    recurringCommitments: fixedCommitments.filter((item) => item.sourceType === "RECURRING_COMMITMENT").length,
    conflicts: Array.from(conflictMap.values()).filter((items) => items.length > 0).length,
  };

  function getEntriesForDay(date: Date) {
    const key = format(date, "yyyy-MM-dd");
    return visibleEntries.filter((entry) => format(entry.date, "yyyy-MM-dd") === key);
  }

  function upsertBlock(block: BlockWithTask) {
    setBlocks((current) => {
      const index = current.findIndex((item) => item.id === block.id);
      if (index === -1) return [...current, block];
      const updated = [...current];
      updated[index] = block;
      return updated;
    });
    setShowForm(false);
    setEditBlock(null);
  }

  async function handleToggleStatus(block: BlockWithTask) {
    const nextStatus: TimeBlockStatus = block.status === "COMPLETED" ? "PLANNED" : "COMPLETED";
    try {
      const result = await updateTimeBlock(block.id, { status: nextStatus });
      upsertBlock(result.block as BlockWithTask);
      toast({ title: nextStatus === "COMPLETED" ? "Block completed" : "Block reopened" });
    } catch {
      toast({ title: "Error updating block", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTimeBlock(id);
      setBlocks((current) => current.filter((item) => item.id !== id));
      setSelectedEntry((current) =>
        current?.kind === "block" && current.block.id === id ? null : current
      );
      toast({ title: "Block deleted" });
    } catch {
      toast({ title: "Error deleting block", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Week of {formatDate(weekStart)}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditBlock(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Manual blocks", value: stats.manualBlocks, color: "#6366f1" },
          { label: "Imported events", value: stats.importedEvents, color: "#0ea5e9" },
          { label: "Recurring commitments", value: stats.recurringCommitments, color: "#10b981" },
          { label: "Conflicts", value: stats.conflicts, color: stats.conflicts > 0 ? "#ef4444" : "#64748b" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Legend & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "INTERNAL", label: "Internal work blocks", color: "#6366f1" },
              { key: "EXTERNAL_SYNC", label: "External synced events", color: "#0ea5e9" },
              { key: "RECURRING_COMMITMENT", label: "Recurring commitments", color: "#10b981" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setFilters((current) => ({ ...current, [filter.key]: !current[filter.key as keyof typeof current] }))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters[filter.key as keyof typeof filters]
                    ? "border-transparent text-white"
                    : "border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
                style={{
                  backgroundColor: filters[filter.key as keyof typeof filters] ? filter.color : "transparent",
                }}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-90" />
                {filter.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            Imported commitments and recurring commitments reduce capacity and trigger conflict warnings when manual blocks overlap them.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dayEntries = getEntriesForDay(day);
            const dayIsToday = isToday(day);

            return (
              <div key={index} className="min-w-0">
                <div className={`text-center py-2 rounded-t-md text-xs font-medium mb-1 ${
                  dayIsToday ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)]"
                }`}>
                  <div>{WEEK_DAYS[index]}</div>
                  <div className="text-lg font-bold leading-none mt-0.5">{format(day, "d")}</div>
                </div>
                <div className="space-y-1 min-h-[160px]">
                  {dayEntries.map((entry) => {
                    const isBlock = entry.kind === "block";
                    const conflicts = isBlock ? entry.conflicts : [];
                    const baseStyles = isBlock
                      ? {
                          backgroundColor: `${entry.color}1f`,
                          borderColor: conflicts.length > 0 ? "#ef4444" : `${entry.color}50`,
                        }
                      : {
                          backgroundColor: `${entry.color}18`,
                          borderColor:
                            entry.commitment.sourceType === "EXTERNAL_SYNC"
                              ? `${entry.color}55`
                              : `${entry.color}75`,
                        };

                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`w-full text-left rounded-md border p-2 transition-all hover:shadow-sm ${
                          selectedEntry?.id === entry.id ? "ring-2 ring-[var(--primary)]/20" : ""
                        } ${
                          isBlock
                            ? entry.status === "COMPLETED"
                              ? "opacity-75"
                              : entry.status === "MISSED"
                                ? "opacity-50 border-dashed"
                                : ""
                            : entry.commitment.sourceType === "RECURRING_COMMITMENT"
                              ? "border-dashed"
                              : ""
                        }`}
                        style={baseStyles}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate text-xs" style={{ color: entry.color }}>
                              {entry.title}
                            </div>
                            <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                              {entry.startTime} - {entry.endTime}
                            </div>
                          </div>
                          {conflicts.length > 0 && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {isBlock ? EVENT_SOURCE_LABELS.INTERNAL : EVENT_SOURCE_LABELS[entry.commitment.sourceType]}
                          </Badge>
                          {!isBlock && (
                            <Badge variant="outline" className="text-[10px]">
                              {COMMITMENT_TYPE_LABELS[entry.commitment.commitmentType]}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => { setSelectedDate(format(day, "yyyy-MM-dd")); setEditBlock(null); setShowForm(true); }}
                    className="w-full rounded-md border border-dashed border-[var(--border)] py-1 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    + add block
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>All Items This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleEntries.map((entry) => {
                  const conflictCount = entry.kind === "block" ? entry.conflicts.length : 0;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-[var(--muted)]/20 ${
                        selectedEntry?.id === entry.id ? "border-[var(--primary)]/40 bg-[var(--primary)]/5" : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{entry.title}</span>
                            {entry.kind === "block" && conflictCount > 0 && (
                              <Badge variant="destructive" className="text-[10px]">{conflictCount} conflict{conflictCount === 1 ? "" : "s"}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex items-center gap-2">
                            <span>{format(entry.date, "EEE MMM d")}</span>
                            <span>{entry.startTime} - {entry.endTime}</span>
                            <span>{entry.durationMinutes}m</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedEntry ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Select a block or commitment to inspect its source and conflicts.
                </p>
              ) : selectedEntry.kind === "block" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-semibold">{selectedEntry.title}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {format(selectedEntry.date, "EEEE, MMM d")} · {selectedEntry.startTime} - {selectedEntry.endTime}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{EVENT_SOURCE_LABELS.INTERNAL}</Badge>
                    <Badge variant="outline">{selectedEntry.block.blockType.toLowerCase()}</Badge>
                    <Badge variant="outline">{selectedEntry.status.toLowerCase()}</Badge>
                  </div>

                  {selectedEntry.conflicts.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-600">Conflicts</p>
                      <div className="space-y-2">
                        {selectedEntry.conflicts.map((conflict) => (
                          <div key={conflict.id} className="rounded-md border border-red-200 bg-red-50 p-3">
                            <div className="font-medium text-sm">{conflict.title}</div>
                            <div className="text-xs text-red-700 mt-0.5">
                              {format(conflict.date, "EEE MMM d")} · {conflict.startTime} - {conflict.endTime}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-600">No fixed-commitment conflicts.</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditBlock(selectedEntry.block); setShowForm(true); }}>
                      <Pencil className="h-4 w-4" />
                      Edit block
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleStatus(selectedEntry.block)}>
                      {selectedEntry.status === "COMPLETED" ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {selectedEntry.status === "COMPLETED" ? "Reopen" : "Complete"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(selectedEntry.block.id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-semibold">{selectedEntry.title}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {format(selectedEntry.date, "EEEE, MMM d")} · {selectedEntry.startTime} - {selectedEntry.endTime}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{EVENT_SOURCE_LABELS[selectedEntry.commitment.sourceType]}</Badge>
                    <Badge variant="outline">{COMMITMENT_TYPE_LABELS[selectedEntry.commitment.commitmentType]}</Badge>
                    {selectedEntry.commitment.affectsCapacity ? (
                      <Badge variant="secondary">affects capacity</Badge>
                    ) : (
                      <Badge variant="outline">doesn&apos;t affect capacity</Badge>
                    )}
                  </div>

                  {selectedEntry.commitment.secondaryLabel && (
                    <div className="rounded-md bg-[var(--muted)]/40 p-3 text-sm">
                      {selectedEntry.commitment.secondaryLabel}
                    </div>
                  )}

                  {selectedEntry.commitment.description && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {selectedEntry.commitment.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <CalendarClock className="h-4 w-4" />
                    Fixed commitments are read-only here. Update the source calendar or template in Settings/Templates.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TimeBlockForm
        open={showForm}
        block={editBlock}
        defaultDate={selectedDate}
        availableTasks={availableTasks}
        onClose={() => { setShowForm(false); setEditBlock(null); }}
        onSaved={upsertBlock}
      />
    </div>
  );
}
