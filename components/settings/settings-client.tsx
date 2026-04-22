"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Loader2, RefreshCcw, Target, User, Clock } from "lucide-react";
import { updateUserSettings } from "@/actions/settings";
import {
  syncCalendarConnectionNow,
  syncCalendarsNow,
  updateExternalCalendarPreferences,
} from "@/actions/calendar-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  weeklyCapacityHours: z.number().int().min(1).max(100),
  workingDaysPerWeek: z.number().int().min(1).max(7),
  bigRockLimit: z.number().int().min(1).max(5),
  workdayStartTime: z.string().min(1),
  workdayEndTime: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

type CalendarConnectionRecord = {
  id: string;
  accountEmail: string | null;
  displayName: string | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  externalCalendars: Array<{
    id: string;
    name: string;
    color: string | null;
    isSelected: boolean;
    affectsCapacity: boolean;
    lastSyncedAt: Date | null;
  }>;
};

interface Props {
  user: {
    name: string | null;
    email: string;
    weeklyCapacityMinutes: number;
    workingDaysPerWeek: number;
    bigRockLimit: number;
    workdayStartTime: string;
    workdayEndTime: string;
  };
  googleCalendarConfigured: boolean;
  calendarConnections: CalendarConnectionRecord[];
}

export function SettingsClient({
  user,
  googleCalendarConfigured,
  calendarConnections,
}: Props) {
  const { toast } = useToast();
  const [connections, setConnections] = useState(calendarConnections);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name ?? "",
      weeklyCapacityHours: Math.round(user.weeklyCapacityMinutes / 60),
      workingDaysPerWeek: user.workingDaysPerWeek,
      bigRockLimit: user.bigRockLimit,
      workdayStartTime: user.workdayStartTime,
      workdayEndTime: user.workdayEndTime,
    },
  });

  async function onSubmit(data: FormData) {
    try {
      await updateUserSettings({
        name: data.name,
        weeklyCapacityMinutes: data.weeklyCapacityHours * 60,
        workingDaysPerWeek: data.workingDaysPerWeek,
        bigRockLimit: data.bigRockLimit,
        workdayStartTime: data.workdayStartTime,
        workdayEndTime: data.workdayEndTime,
      });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" });
    }
  }

  async function handleSyncAll() {
    try {
      setSyncingAll(true);
      const result = await syncCalendarsNow();
      toast({
        title: "Calendars synced",
        description: `${result.syncedEventCount} imported events refreshed.`,
      });
    } catch (error) {
      toast({
        title: "Calendar sync failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleSyncConnection(connectionId: string) {
    try {
      setSyncingConnectionId(connectionId);
      await syncCalendarConnectionNow(connectionId);
      setConnections((current) =>
        current.map((connection) =>
          connection.id === connectionId
            ? { ...connection, lastSyncedAt: new Date(), syncError: null }
            : connection
        )
      );
      toast({ title: "Calendar connection synced" });
    } catch (error) {
      toast({
        title: "Calendar sync failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncingConnectionId(null);
    }
  }

  async function handleCalendarToggle(
    connectionId: string,
    calendarId: string,
    field: "isSelected" | "affectsCapacity",
    value: boolean
  ) {
    const previous = connections;
    setConnections((current) =>
      current.map((connection) =>
        connection.id !== connectionId
          ? connection
          : {
              ...connection,
              externalCalendars: connection.externalCalendars.map((calendar) =>
                calendar.id === calendarId
                  ? { ...calendar, [field]: value }
                  : calendar
              ),
            }
      )
    );

    try {
      await updateExternalCalendarPreferences(calendarId, { [field]: value });
    } catch (error) {
      setConnections(previous);
      toast({
        title: "Could not update calendar preference",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Configure profile and planning defaults. Calendar sync is optional and secondary.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--primary)]" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled className="bg-[var(--muted)]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--primary)]" />
              Weekly Capacity Rules
            </CardTitle>
              <CardDescription>
              These defaults support planning without turning WeekFlow into a heavy calendar system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Focus hours per week</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  {...register("weeklyCapacityHours", { valueAsNumber: true })}
                />
                {errors.weeklyCapacityHours && <p className="text-xs text-red-500">{errors.weeklyCapacityHours.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Working days per week</Label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  {...register("workingDaysPerWeek", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Typical workday starts</Label>
                <Input type="time" {...register("workdayStartTime")} />
              </div>
              <div className="space-y-1.5">
                <Label>Typical workday ends</Label>
                <Input type="time" {...register("workdayEndTime")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--primary)]" />
              Daily Planning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Big Rock limit per day</Label>
              <Input
                type="number"
                min={1}
                max={5}
                {...register("bigRockLimit", { valueAsNumber: true })}
                className="w-24"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </form>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[var(--primary)]" />
                Optional Calendar Connections
              </CardTitle>
              <CardDescription>
                Secondary calendar features stay separate from tasks and are safe to leave disabled.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {googleCalendarConfigured ? (
                <Button asChild variant="outline">
                  <Link href="/api/calendar/google/connect">Connect Google Calendar</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Google Calendar unavailable
                </Button>
              )}
              <Button onClick={handleSyncAll} disabled={syncingAll || connections.length === 0}>
                {syncingAll && <Loader2 className="h-4 w-4 animate-spin" />}
                Sync all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!googleCalendarConfigured && (
            <div className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
              Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable Google Calendar sync. The rest of WeekFlow still works without it.
            </div>
          )}

          {connections.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
              No calendar accounts connected yet.
            </div>
          ) : (
            connections.map((connection) => (
              <div key={connection.id} className="rounded-lg border border-[var(--border)] p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {connection.displayName ?? connection.accountEmail ?? "Google Calendar"}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {connection.accountEmail ?? "Connected account"}
                    </p>
                    {connection.lastSyncedAt && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Last synced {formatDistanceToNow(connection.lastSyncedAt, { addSuffix: true })}
                      </p>
                    )}
                    {connection.syncError && (
                      <p className="text-xs text-red-500 mt-1">{connection.syncError}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncConnection(connection.id)}
                    disabled={syncingConnectionId === connection.id}
                  >
                    {syncingConnectionId === connection.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    <RefreshCcw className="h-4 w-4" />
                    Sync now
                  </Button>
                </div>

                <div className="space-y-3">
                  {connection.externalCalendars.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Run sync once to pull the available calendar list.
                    </p>
                  ) : (
                    connection.externalCalendars.map((calendar) => (
                      <div key={calendar.id} className="grid grid-cols-[1fr,auto,auto] items-center gap-4 rounded-md border border-[var(--border)] p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: calendar.color ?? "#94a3b8" }}
                            />
                            <span className="text-sm font-medium truncate">{calendar.name}</span>
                          </div>
                          {calendar.lastSyncedAt && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                              Refreshed {formatDistanceToNow(calendar.lastSyncedAt, { addSuffix: true })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted-foreground)]">Show in calendar</span>
                          <Switch
                            checked={calendar.isSelected}
                            onCheckedChange={(checked) =>
                              handleCalendarToggle(connection.id, calendar.id, "isSelected", checked)
                            }
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted-foreground)]">Affects capacity</span>
                          <Switch
                            checked={calendar.affectsCapacity}
                            onCheckedChange={(checked) =>
                              handleCalendarToggle(connection.id, calendar.id, "affectsCapacity", checked)
                            }
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
