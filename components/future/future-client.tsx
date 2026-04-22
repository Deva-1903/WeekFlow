"use client";

import { useMemo, useState } from "react";
import { FutureItem, TaskStatus } from "@prisma/client";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Filter,
  Plus,
  Sparkles,
} from "lucide-react";
import { addDays, isBefore, isToday, startOfDay } from "date-fns";
import {
  clearFutureReviewDate,
  promoteFutureItem,
  snoozeFutureItem,
  updateFutureStatus,
} from "@/actions/future-items";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AREA_LABELS, FUTURE_STATUS_LABELS, formatDateShort } from "@/lib/utils";
import { toLocalDateKey } from "@/lib/timezone";
import { FutureItemForm } from "./future-item-form";

type FutureItemRecord = FutureItem & {
  promotedTask?: {
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
  const [reviewFilter, setReviewFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<FutureItemRecord | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }

      if (statusFilter === "open" && !["FUTURE", "ACTIVE"].includes(item.status)) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;

      const reviewDate = item.reviewDate ? startOfDay(item.reviewDate) : null;
      if (reviewFilter === "due" && (!reviewDate || isBefore(new Date(), reviewDate))) return false;
      if (reviewFilter === "overdue" && (!reviewDate || !isBefore(reviewDate, startOfDay(new Date())) || isToday(reviewDate))) return false;
      if (reviewFilter === "none" && reviewDate) return false;

      return true;
    });
  }, [categoryFilter, items, reviewFilter, search, statusFilter]);

  const stats = {
    open: items.filter((item) => ["FUTURE", "ACTIVE"].includes(item.status)).length,
    review: items.filter((item) => item.reviewDate && (isToday(item.reviewDate) || isBefore(item.reviewDate, startOfDay(new Date())))).length,
    promoted: items.filter((item) => item.status === "ACTIVE").length,
    done: items.filter((item) => item.status === "DONE").length,
  };

  function upsertItem(nextItem: FutureItemRecord) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === nextItem.id);
      if (index === -1) return [nextItem, ...current];
      const next = [...current];
      next[index] = { ...next[index], ...nextItem };
      return next;
    });
    setEditItem(null);
    setShowForm(false);
  }

  async function handlePromote(item: FutureItemRecord, status: TaskStatus) {
    try {
      const result = await promoteFutureItem(item.id, status);
      upsertItem({
        ...item,
        ...result.item,
        promotedTask: result.task,
      } as FutureItemRecord);
      toast({ title: status === "TOMORROW" ? "Promoted to tomorrow" : "Promoted to active tasks" });
    } catch (error) {
      toast({
        title: "Could not promote item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleStatus(item: FutureItemRecord, status: FutureItemRecord["status"]) {
    try {
      const result = await updateFutureStatus(item.id, status);
      upsertItem(result.item as FutureItemRecord);
      toast({ title: `Marked ${FUTURE_STATUS_LABELS[status].toLowerCase()}` });
    } catch (error) {
      toast({
        title: "Could not update item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSnooze(item: FutureItemRecord) {
    const nextReviewDate = toLocalDateKey(addDays(new Date(), 7));
    try {
      const result = await snoozeFutureItem(item.id, nextReviewDate);
      upsertItem(result.item as FutureItemRecord);
      toast({ title: "Review moved out one week" });
    } catch (error) {
      toast({
        title: "Could not snooze item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleReviewed(item: FutureItemRecord) {
    try {
      const result = await clearFutureReviewDate(item.id);
      upsertItem(result.item as FutureItemRecord);
      toast({ title: "Review cleared" });
    } catch (error) {
      toast({
        title: "Could not clear review",
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
            Important, not-now items. Review dates are reminders, not deadlines.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Future Item
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open", value: stats.open, icon: Sparkles, color: "#6366f1" },
          { label: "Needs review", value: stats.review, icon: CalendarClock, color: "#f59e0b" },
          { label: "Promoted", value: stats.promoted, icon: ArrowUpRight, color: "#10b981" },
          { label: "Done later", value: stats.done, icon: CheckCircle2, color: "#64748b" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <Icon className="h-4 w-4 mb-2" style={{ color: card.color }} />
                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{card.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_180px] gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search future items..." />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(FUTURE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(AREA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any review</SelectItem>
            <SelectItem value="due">Due now</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="none">No review date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-[var(--muted-foreground)]">
            No future items match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const reviewDate = item.reviewDate ? startOfDay(item.reviewDate) : null;
            const reviewOverdue = Boolean(reviewDate && isBefore(reviewDate, startOfDay(new Date())) && !isToday(reviewDate));
            const reviewToday = Boolean(reviewDate && isToday(reviewDate));

            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{AREA_LABELS[item.category]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{FUTURE_STATUS_LABELS[item.status]}</Badge>
                        {item.targetTimeframe && <Badge variant="outline" className="text-[10px]">{item.targetTimeframe}</Badge>}
                        {item.promotedTask && <Badge variant="success" className="text-[10px]">linked task</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setEditItem(item); setShowForm(true); }}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.description && (
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{item.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>Created {formatDateShort(item.createdAt)}</span>
                    {reviewDate && (
                      <span className={reviewOverdue ? "text-red-500 font-medium" : reviewToday ? "text-amber-600 font-medium" : ""}>
                        Review {formatDateShort(reviewDate)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handlePromote(item, "ACTIVE")}>
                      <ArrowUpRight className="h-4 w-4" />
                      Active Task
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePromote(item, "TOMORROW")}>
                      Tomorrow
                    </Button>
                    {reviewDate && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleReviewed(item)}>
                          Reviewed
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSnooze(item)}>
                          Snooze
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleStatus(item, "DONE")}>
                      <CheckCircle2 className="h-4 w-4" />
                      Done
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleStatus(item, "ARCHIVED")}>
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
        onSaved={upsertItem}
      />
    </div>
  );
}
