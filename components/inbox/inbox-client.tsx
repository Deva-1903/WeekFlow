"use client";

import { useMemo, useState } from "react";
import { InboxItem } from "@prisma/client";
import { Archive, BookOpen, CheckSquare, Inbox, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  archiveInboxItem,
  createInboxItem,
  discardInboxItem,
  processInboxToFuture,
  processInboxToJournal,
  processInboxToTask,
} from "@/actions/inbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/utils";

interface Props {
  initialItems: InboxItem[];
}

export function InboxClient({ initialItems }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const openItems = useMemo(
    () => items.filter((item) => !item.archived && !item.processedAt),
    [items]
  );
  const processedItems = useMemo(
    () => items.filter((item) => item.archived || item.processedAt).slice(0, 8),
    [items]
  );

  async function handleCapture(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const result = await createInboxItem({
        title: title.trim(),
        note: note.trim() || undefined,
      });
      setItems((current) => [result.item as InboxItem, ...current]);
      setTitle("");
      setNote("");
      toast({ title: "Captured" });
    } catch (error) {
      toast({
        title: "Could not capture",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function process(
    item: InboxItem,
    action: "task" | "future" | "journal" | "discard" | "archive"
  ) {
    setProcessingId(item.id);
    try {
      if (action === "task") {
        await processInboxToTask(item.id, {
          title: item.title,
          description: item.note ?? undefined,
          area: "OTHER",
          priority: "MEDIUM",
          status: "ACTIVE",
        });
        toast({ title: "Converted to active task" });
      }

      if (action === "future") {
        await processInboxToFuture(item.id, {
          title: item.title,
          description: item.note ?? undefined,
          category: "OTHER",
        });
        toast({ title: "Moved to Future" });
      }

      if (action === "journal") {
        await processInboxToJournal(item.id);
        toast({ title: "Added to today&apos;s journal" });
      }

      if (action === "discard") {
        await discardInboxItem(item.id);
        toast({ title: "Discarded" });
      }

      if (action === "archive") {
        await archiveInboxItem(item.id);
        toast({ title: "Archived" });
      }

      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, archived: true, processedAt: new Date() }
            : entry
        )
      );
    } catch (error) {
      toast({
        title: "Could not process item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Capture first. Decide later. Nothing important should live only in your head.
        </p>
      </div>

      <Card className="border-[var(--primary)]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[var(--primary)]" />
            Fast Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCapture} className="space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Type anything: task, thought, reminder, future idea..."
              autoFocus
            />
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note/context"
                rows={2}
              />
              <Button type="submit" disabled={loading || !title.trim()} className="md:self-start">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Capture
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,0.8fr] gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Unprocessed</CardTitle>
              <Badge variant={openItems.length ? "warning" : "success"}>
                {openItems.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {openItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[var(--muted-foreground)]">Inbox clear. Tiny little miracle.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-sm font-semibold">{item.title}</h2>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatDateShort(item.createdAt)}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">
                          {item.note}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => process(item, "task")}
                        disabled={processingId === item.id}
                      >
                        <CheckSquare className="h-4 w-4" />
                        Task
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => process(item, "future")}
                        disabled={processingId === item.id}
                      >
                        <Sparkles className="h-4 w-4" />
                        Future
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => process(item, "journal")}
                        disabled={processingId === item.id}
                      >
                        <BookOpen className="h-4 w-4" />
                        Journal
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => process(item, "discard")}
                        disabled={processingId === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Discard
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => process(item, "archive")}
                        disabled={processingId === item.id}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Recent Processing</CardTitle>
          </CardHeader>
          <CardContent>
            {processedItems.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Processed items will show here.</p>
            ) : (
              <div className="space-y-2">
                {processedItems.map((item) => (
                  <div key={item.id} className="rounded-md bg-[var(--muted)]/40 p-3">
                    <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      {item.convertedToType ? `Converted to ${item.convertedToType.toLowerCase()}` : "Archived"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

