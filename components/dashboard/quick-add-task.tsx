"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createInboxItem } from "@/actions/inbox";
import { useToast } from "@/components/ui/use-toast";

export function QuickAddTask() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await createInboxItem({ title: title.trim() });
      toast({ title: "Captured to inbox", description: title });
      setTitle("");
      setOpen(false);
    } catch {
      toast({ title: "Error", description: "Could not capture item.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Quick Capture
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture to Inbox</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
          <Input
            placeholder="Anything on your mind..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={loading || !title.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Capture"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
