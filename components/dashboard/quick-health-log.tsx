"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { upsertHealthLog } from "@/actions/health";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Props {
  existing?: {
    smokedToday: boolean;
    drankAlcoholToday: boolean;
    didPhysicalActivityToday: boolean;
  };
}

export function QuickHealthLog({ existing }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    smokedToday: existing?.smokedToday ?? false,
    drankAlcoholToday: existing?.drankAlcoholToday ?? false,
    didPhysicalActivityToday: existing?.didPhysicalActivityToday ?? false,
  });
  const { toast } = useToast();

  async function handleSave() {
    setLoading(true);
    try {
      await upsertHealthLog({
        date: format(new Date(), "yyyy-MM-dd"),
        ...values,
      });
      toast({ title: "Health log saved" });
      setOpen(false);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-1 text-xs">
          {existing ? "Update today's log" : "Log today"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Today&apos;s Health Log</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {[
            { key: "smokedToday" as const, label: "Smoked today?" },
            { key: "drankAlcoholToday" as const, label: "Drank alcohol today?" },
            { key: "didPhysicalActivityToday" as const, label: "Physical activity today?" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="text-sm font-normal">{label}</Label>
              <Switch
                id={key}
                checked={values[key]}
                onCheckedChange={(v) => setValues((p) => ({ ...p, [key]: v }))}
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
