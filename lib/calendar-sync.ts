import { CalendarProvider } from "@prisma/client";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3/calendars";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleUserInfoResponse {
  id: string;
  email?: string;
  name?: string;
}

interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  backgroundColor?: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  recurringEventId?: string;
  recurrence?: string[];
}

function assertGoogleEnv() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Calendar is not configured.");
  }
}

export function isGoogleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleCalendarRedirectUri(origin: string) {
  return `${origin}/api/calendar/google/callback`;
}

export function buildGoogleCalendarConnectUrl(origin: string, state: string) {
  assertGoogleEnv();

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGoogleCalendarRedirectUri(origin),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

async function exchangeGoogleCode(code: string, origin: string) {
  assertGoogleEnv();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getGoogleCalendarRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Could not complete Google Calendar connection.");
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function refreshGoogleToken(refreshToken: string) {
  assertGoogleEnv();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Could not refresh the Google Calendar connection.");
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function googleFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google Calendar request failed.");
  }

  return (await response.json()) as T;
}

async function fetchGoogleUserInfo(accessToken: string) {
  return googleFetch<GoogleUserInfoResponse>(GOOGLE_USERINFO_URL, accessToken);
}

async function fetchGoogleCalendarList(accessToken: string) {
  const response = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    GOOGLE_CALENDAR_LIST_URL,
    accessToken
  );

  return response.items ?? [];
}

async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const params = new URLSearchParams({
    singleEvents: "true",
    showDeleted: "false",
    orderBy: "startTime",
    maxResults: "2500",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
  });

  const encodedCalendarId = encodeURIComponent(calendarId);
  const response = await googleFetch<{ items?: GoogleCalendarEvent[] }>(
    `${GOOGLE_CALENDAR_API_BASE}/${encodedCalendarId}/events?${params.toString()}`,
    accessToken
  );

  return response.items ?? [];
}

function normalizeGoogleEventDate(date?: string, dateTime?: string) {
  if (dateTime) {
    return new Date(dateTime);
  }

  if (date) {
    return new Date(`${date}T00:00:00`);
  }

  return null;
}

export async function upsertGoogleCalendarConnection(
  userId: string,
  code: string,
  origin: string
) {
  const tokens = await exchangeGoogleCode(code, origin);
  const profile = await fetchGoogleUserInfo(tokens.access_token);

  const connection = await prisma.calendarConnection.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: "GOOGLE",
        providerAccountId: profile.id,
      },
    },
    create: {
      userId,
      provider: "GOOGLE",
      providerAccountId: profile.id,
      accountEmail: profile.email,
      displayName: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accountEmail: profile.email,
      displayName: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      syncError: null,
    },
  });

  return connection;
}

export async function ensureGoogleAccessToken(connectionId: string) {
  const connection = await prisma.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== CalendarProvider.GOOGLE) {
    throw new Error("Calendar connection not found.");
  }

  if (connection.accessToken && connection.tokenExpiry && connection.tokenExpiry > new Date(Date.now() + 60_000)) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error("Google Calendar connection needs to be reconnected.");
  }

  const refreshed = await refreshGoogleToken(connection.refreshToken);
  const updated = await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      tokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
      syncError: null,
    },
  });

  if (!updated.accessToken) {
    throw new Error("Google Calendar connection needs to be reconnected.");
  }

  return updated.accessToken;
}

function defaultCalendarAffectsCapacity(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("birthday") || normalized.includes("holiday")) {
    return false;
  }

  return true;
}

export async function syncGoogleCalendarConnection(
  connectionId: string,
  options?: {
    pastDays?: number;
    futureDays?: number;
  }
) {
  const connection = await prisma.calendarConnection.findUnique({
    where: { id: connectionId },
    include: {
      externalCalendars: true,
    },
  });

  if (!connection) {
    throw new Error("Calendar connection not found.");
  }

  const accessToken = await ensureGoogleAccessToken(connectionId);
  const calendars = await fetchGoogleCalendarList(accessToken);
  const now = new Date();

  const syncedCalendars = await Promise.all(
    calendars.map((calendar) => {
      const existing = connection.externalCalendars.find(
        (item) => item.providerCalendarId === calendar.id
      );

      return prisma.externalCalendar.upsert({
        where: {
          connectionId_providerCalendarId: {
            connectionId: connection.id,
            providerCalendarId: calendar.id,
          },
        },
        create: {
          userId: connection.userId,
          connectionId: connection.id,
          providerCalendarId: calendar.id,
          name: calendar.summary,
          color: calendar.backgroundColor,
          isSelected: true,
          affectsCapacity: defaultCalendarAffectsCapacity(calendar.summary),
          lastSyncedAt: null,
        },
        update: {
          name: calendar.summary,
          color: calendar.backgroundColor,
          isSelected: existing?.isSelected ?? true,
          affectsCapacity:
            existing?.affectsCapacity ??
            defaultCalendarAffectsCapacity(calendar.summary),
        },
      });
    })
  );

  const rangeStart = startOfDay(addDays(now, -(options?.pastDays ?? 14)));
  const rangeEnd = endOfDay(addDays(now, options?.futureDays ?? 60));
  let syncedEventCount = 0;

  for (const calendar of syncedCalendars.filter((item) => item.isSelected)) {
    const events = await fetchGoogleCalendarEvents(
      accessToken,
      calendar.providerCalendarId,
      rangeStart,
      rangeEnd
    );

    const providerEventIds: string[] = [];

    for (const event of events) {
      const startTime = normalizeGoogleEventDate(
        event.start?.date,
        event.start?.dateTime
      );
      const endTime = normalizeGoogleEventDate(event.end?.date, event.end?.dateTime);

      if (!event.id || !startTime || !endTime) {
        continue;
      }

      providerEventIds.push(event.id);

      await prisma.externalEvent.upsert({
        where: {
          calendarId_providerEventId: {
            calendarId: calendar.id,
            providerEventId: event.id,
          },
        },
        create: {
          userId: connection.userId,
          calendarId: calendar.id,
          providerEventId: event.id,
          title: event.summary ?? "(Untitled event)",
          description: event.description,
          location: event.location,
          startTime,
          endTime,
          isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
          isRecurringInstance: Boolean(event.recurringEventId),
          recurrenceRuleRaw: event.recurrence?.join("\n") ?? null,
          status: event.status ?? "confirmed",
          affectsCapacity: calendar.affectsCapacity,
          lastSyncedAt: now,
        },
        update: {
          title: event.summary ?? "(Untitled event)",
          description: event.description,
          location: event.location,
          startTime,
          endTime,
          isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
          isRecurringInstance: Boolean(event.recurringEventId),
          recurrenceRuleRaw: event.recurrence?.join("\n") ?? null,
          status: event.status ?? "confirmed",
          affectsCapacity: calendar.affectsCapacity,
          lastSyncedAt: now,
        },
      });

      syncedEventCount += 1;
    }

    await prisma.externalEvent.deleteMany({
      where: {
        calendarId: calendar.id,
        startTime: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        ...(providerEventIds.length > 0
          ? {
              providerEventId: {
                notIn: providerEventIds,
              },
            }
          : {}),
      },
    });

    await prisma.externalCalendar.update({
      where: { id: calendar.id },
      data: { lastSyncedAt: now },
    });
  }

  const updatedConnection = await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncedAt: now,
      syncError: null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId: connection.userId,
      type: "CALENDAR_SYNCED",
      entityId: connection.id,
      entityType: "CalendarConnection",
      metadata: {
        title: connection.accountEmail ?? connection.displayName ?? "Google Calendar",
      },
    },
  });

  return {
    connection: updatedConnection,
    syncedCalendars,
    syncedEventCount,
    rangeStart,
    rangeEnd,
  };
}

export async function syncGoogleCalendarsForUser(userId: string) {
  const connections = await prisma.calendarConnection.findMany({
    where: {
      userId,
      provider: "GOOGLE",
    },
    orderBy: { createdAt: "asc" },
  });

  const results = [];

  for (const connection of connections) {
    try {
      const result = await syncGoogleCalendarConnection(connection.id);
      results.push(result);
    } catch (error) {
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          syncError:
            error instanceof Error ? error.message : "Calendar sync failed.",
        },
      });
      throw error;
    }
  }

  return results;
}
