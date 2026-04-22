"use client";

import { useMemo, useState } from "react";
import { JournalEntry } from "@prisma/client";
import { BookOpen, Loader2, Plus, Search } from "lucide-react";
import { saveJournalEntry } from "@/actions/journal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/utils";
import { toLocalDateKey } from "@/lib/timezone";

interface Props {
  todayKey: string;
  initialEntry: JournalEntry | null;
  history: JournalEntry[];
}

function emptyForm(date: string) {
  return {
    date,
    title: "",
    bestMoment: "",
    notableConversation: "",
    wins: "",
    struggles: "",
    brainDump: "",
    gratitude: "",
    freeformText: "",
  };
}

function entryToForm(entry: JournalEntry) {
  return {
    date: toLocalDateKey(entry.date),
    title: entry.title ?? "",
    bestMoment: entry.bestMoment ?? "",
    notableConversation: entry.notableConversation ?? "",
    wins: entry.wins ?? "",
    struggles: entry.struggles ?? "",
    brainDump: entry.brainDump ?? "",
    gratitude: entry.gratitude ?? "",
    freeformText: entry.freeformText ?? "",
  };
}

function entryPreview(entry: JournalEntry): string {
  return (
    entry.title ||
    entry.bestMoment ||
    entry.wins ||
    entry.brainDump ||
    entry.freeformText ||
    "Untitled entry"
  );
}

function entrySnippet(entry: JournalEntry): string | null {
  const fields = [
    entry.brainDump,
    entry.freeformText,
    entry.wins,
    entry.struggles,
    entry.gratitude,
    entry.notableConversation,
  ].filter(Boolean) as string[];
  return fields[0] ?? null;
}

export function JournalClient({ todayKey, initialEntry, history }: Props) {
  const { toast } = useToast();
  const [entries, setEntries] = useState(history);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEntry?.id ?? (history[0]?.id ?? null)
  );
  const [form, setForm] = useState(() =>
    initialEntry
      ? entryToForm(initialEntry)
      : history[0]
      ? entryToForm(history[0])
      : emptyForm(todayKey)
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const needle = query.toLowerCase();
    return entries.filter((entry) =>
      [
        entry.title,
        entry.bestMoment,
        entry.notableConversation,
        entry.wins,
        entry.struggles,
        entry.brainDump,
        entry.gratitude,
        entry.freeformText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [entries, query]);

  function selectEntry(entry: JournalEntry) {
    setSelectedId(entry.id);
    setForm(entryToForm(entry));
  }

  function handleDateChange(newDate: string) {
    setForm(emptyForm(newDate));
    setSelectedId(null);
  }

  function handleNewEntry() {
    setSelectedId(null);
    setForm(emptyForm(todayKey));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveJournalEntry(form);
      const saved = result.entry as JournalEntry;
      setEntries((current) => {
        const index = current.findIndex((item) => item.id === saved.id);
        if (index === -1) return [saved, ...current];
        const next = [...current];
        next[index] = saved;
        return next;
      });
      setSelectedId(saved.id);
      toast({ title: "Journal saved" });
    } catch (error) {
      toast({
        title: "Could not save journal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            A calm place for memory, reflection, emotional clutter, and brain dumps.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewEntry}>
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Entries list */}
        <Card className="xl:sticky xl:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                placeholder="Search..."
              />
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {filtered.map((entry) => {
                  const isSelected = entry.id === selectedId;
                  const snippet = entrySnippet(entry);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => selectEntry(entry)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-(--primary)/5"
                          : "border-border hover:bg-(--muted)/40"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(entry.date)}
                      </p>
                      <p className="text-sm font-medium mt-0.5 line-clamp-1">
                        {entryPreview(entry)}
                      </p>
                      {snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {snippet}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--primary)]" />
              {selectedId ? "Edit Entry" : "New Entry"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Optional title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Best moment</Label>
                  <Textarea
                    rows={3}
                    value={form.bestMoment}
                    onChange={(e) => setForm({ ...form, bestMoment: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notable conversation</Label>
                  <Textarea
                    rows={3}
                    value={form.notableConversation}
                    onChange={(e) => setForm({ ...form, notableConversation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Wins</Label>
                  <Textarea
                    rows={3}
                    value={form.wins}
                    onChange={(e) => setForm({ ...form, wins: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Struggles</Label>
                  <Textarea
                    rows={3}
                    value={form.struggles}
                    onChange={(e) => setForm({ ...form, struggles: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Brain dump</Label>
                <Textarea
                  rows={5}
                  value={form.brainDump}
                  onChange={(e) => setForm({ ...form, brainDump: e.target.value })}
                  placeholder="Messy thoughts welcome."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gratitude</Label>
                  <Textarea
                    rows={3}
                    value={form.gratitude}
                    onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Freeform</Label>
                  <Textarea
                    rows={3}
                    value={form.freeformText}
                    onChange={(e) => setForm({ ...form, freeformText: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
