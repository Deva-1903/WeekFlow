"use client";

import { useState } from "react";
import { SomedayItem } from "@prisma/client";
import { addDays, format, isBefore, isToday, startOfDay } from "date-fns";
import { CalendarClock, Clock3 } from "lucide-react";
import { markSomedayReviewedToday, snoozeSomedayItem } from "@/actions/future";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  items: SomedayItem[];
}

export function ReviewReminders({ items }: Props) {
  const { toast } = useToast();
  const [reminders, setReminders] = useState(items);

  async function handleReview(id: string) {
    try {
      await markSomedayReviewedToday(id);
      setReminders((current) => current.filter((item) => item.id !== id));
      toast({ title: "Marked as reviewed" });
    } catch (error) {
      toast({
        title: "Could not mark as reviewed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSnooze(id: string) {
    const nextReview = format(addDays(startOfDay(new Date()), 7), "yyyy-MM-dd");

    try {
      const result = await snoozeSomedayItem(id, nextReview);
      setReminders((current) =>
        current.map((item) => item.id === id ? (result.item as SomedayItem) : item)
      );
      toast({ title: "Review snoozed for one week" });
    } catch (error) {
      toast({
        title: "Could not snooze review",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-[var(--primary)]" />
          Needs Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Nothing needs a revisit right now.
          </p>
        ) : (
          <div className="space-y-3">
            {reminders.slice(0, 4).map((item) => {
              const reviewDate = item.reviewDate ? startOfDay(item.reviewDate) : null;
              const overdue = Boolean(reviewDate && isBefore(reviewDate, startOfDay(new Date())) && !isToday(reviewDate));
              const dueToday = Boolean(reviewDate && isToday(reviewDate));

              return (
                <div key={item.id} className="rounded-md border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {reviewDate && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          <Clock3 className="h-3.5 w-3.5" />
                          Review {format(reviewDate, "MMM d")}
                          {overdue && <Badge variant="destructive" className="text-[10px]">overdue</Badge>}
                          {dueToday && <Badge variant="warning" className="text-[10px]">today</Badge>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleReview(item.id)}>
                      Review today
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSnooze(item.id)}>
                      Snooze 7d
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
