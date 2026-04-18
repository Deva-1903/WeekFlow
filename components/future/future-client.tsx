"use client";

import { useMemo, useState } from "react";
import { SomedayItem, TaskStatus } from "@prisma/client";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Plus,
  Sparkles,
} from "lucide-react";
import { addDays, format, isBefore, isToday, startOfDay } from "date-fns";
import { promoteSomedayItem, snoozeSomedayItem, updateSomedayStatus } from "@/actions/future";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AREA_LABELS, SOMEDAY_STATUS_LABELS } from "@/lib/utils";
import { FutureItemForm } from "./future-item-form";

type FutureItemRecord = SomedayItem & {
  generatedTask?: {
    id: string;
    title: string;
    status: TaskStatus;
  } | null;
};

interface Props {
  initialItems: FutureItemRecord[];
}

export function FutureClient({ initialItems }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<FutureItemRecord[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [timeframeFilter, setTimeframeFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<FutureItemRecord | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }

      if (statusFilter === "open" && !["SOMEDAY", "ACTIVE"].includes(item.status)) {
        return false;
      }
      if (statusFilter !== "all" && statusFilter !== "open" && item.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      if (timeframeFilter !== "all" && (item.targetTimeframe ?? "none") !== timeframeFilter) {
        return false;
      }

      const reviewDate = item.reviewDate ? startOfDay(item.reviewDate) : null;
      if (reviewFilter === "due" && (!reviewDate || isBefore(new Date(), reviewDate))) {
        return false;
      }
      if (reviewFilter === "overdue" && (!reviewDate || !isBefore(reviewDate, startOfDay(new Date())) || isToday(reviewDate))) {
        return false;
      }
      if (reviewFilter === "none" && reviewDate) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, items, reviewFilter, search, statusFilter, timeframeFilter]);

  const stats = {
    total: items.filter((item) => item.status !== "ARCHIVED").length,
    needsReview: items.filter((item) => item.reviewDate && (isToday(item.reviewDate) || isBefore(item.reviewDate, startOfDay(new Date())))).length,
    important: items.filter((item) => item.isImportant && ["SOMEDAY", "ACTIVE"].includes(item.status)).length,
    promoted: items.filter((item) => item.status === "ACTIVE").length,
  };

  function upsertItem(nextItem: FutureItemRecord) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === nextItem.id);
      if (index === -1) return [nextItem, ...current];
      const updated = [...current];
      updated[index] = nextItem;
      return updated;
    });
    setEditItem(null);
    setShowForm(false);
  }

  async function handlePromote(item: FutureItemRecord, nextStatus: TaskStatus) {
    try {
      const result = await promoteSomedayItem(item.id, nextStatus);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: "ACTIVE",
                promotedAt: new Date(),
                convertedTaskId: result.task.id,
                generatedTask: result.task,
              }
            : entry
        )
      );
      toast({
        title: nextStatus === "THIS_WEEK" ? "Promoted into This Week" : "Promoted into Tasks",
      });
    } catch (error) {
      toast({
        title: "Could not promote item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleStatusChange(item: FutureItemRecord, nextStatus: FutureItemRecord["status"]) {
    try {
      const result = await updateSomedayStatus(item.id, nextStatus);
      upsertItem(result.item as FutureItemRecord);
      toast({ title: `Marked as ${SOMEDAY_STATUS_LABELS[nextStatus].toLowerCase()}` });
    } catch (error) {
      toast({
        title: "Could not update item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSnooze(item: FutureItemRecord) {
    const nextReviewDate = format(addDays(startOfDay(new Date()), 7), "yyyy-MM-dd");

    try {
      const result = await snoozeSomedayItem(item.id, nextReviewDate);
      upsertItem(result.item as FutureItemRecord);
      toast({ title: "Review date moved out by one week" });
    } catch (error) {
      toast({
        title: "Could not snooze review",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Future</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Important later items that should not pollute the active backlog.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Future Item
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open future items", value: stats.total, icon: Sparkles, color: "#6366f1" },
          { label: "Needs review", value: stats.needsReview, icon: CalendarClock, color: "#f59e0b" },
          { label: "Important", value: stats.important, icon: Clock3, color: "#ef4444" },
          { label: "Promoted", value: stats.promoted, icon: ArrowUpRight, color: "#10b981" },
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr,1fr,1fr,1fr] gap-3">
        <div className="relative lg:col-span-2">
          <Filter className="absolute left-3 top-3.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search future items..."
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(SOMEDAY_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(AREA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any timeframe</SelectItem>
            <SelectItem value="none">No timeframe</SelectItem>
            {["Before semester", "Summer", "Fall", "Winter", "Later"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Review state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any review state</SelectItem>
            <SelectItem value="due">Due today or soon</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="none">No review date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No future items match these filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const reviewDate = item.reviewDate ? startOfDay(item.reviewDate) : null;
            const isReviewOverdue = Boolean(reviewDate && isBefore(reviewDate, startOfDay(new Date())) && !isToday(reviewDate));
            const isReviewToday = Boolean(reviewDate && isToday(reviewDate));

            return (
              <Card key={item.id} className="border-[var(--border)]/80">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        {item.isImportant && (
                          <Badge variant="destructive" className="text-[10px]">important</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {SOMEDAY_STATUS_LABELS[item.status]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{AREA_LABELS[item.category]}</Badge>
                        {item.targetTimeframe && (
                          <Badge variant="outline" className="text-[10px]">{item.targetTimeframe}</Badge>
                        )}
                        {item.roughEffort && (
                          <Badge variant="outline" className="text-[10px]">{item.roughEffort}</Badge>
                        )}
                        {item.generatedTask && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            linked task
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => { setEditItem(item); setShowForm(true); }}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.description && (
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>Created {format(item.createdAt, "MMM d, yyyy")}</span>
                    {reviewDate && (
                      <span className={isReviewOverdue ? "text-red-500 font-medium" : isReviewToday ? "text-amber-600 font-medium" : ""}>
                        Review {format(reviewDate, "MMM d, yyyy")}
                      </span>
                    )}
                    {!reviewDate && <span>No review date</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handlePromote(item, "BACKLOG")}>
                      Promote to backlog
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePromote(item, "THIS_WEEK")}>
                      Promote to this week
                    </Button>
                    {(isReviewToday || isReviewOverdue) && (
                      <Button size="sm" variant="ghost" onClick={() => handleSnooze(item)}>
                        Snooze 7 days
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleStatusChange(item, "DONE")}>
                      <CheckCircle2 className="h-4 w-4" />
                      Done
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleStatusChange(item, "ARCHIVED")}>
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FutureItemForm
        open={showForm}
        item={editItem}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSaved={(item) => upsertItem(item as FutureItemRecord)}
      />
    </div>
  );
}
