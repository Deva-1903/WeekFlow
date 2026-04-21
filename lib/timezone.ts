/**
 * Centralized timezone utilities for WeekFlow.
 *
 * The user is in America/New_York. All user-facing date logic — "today",
 * "this week", overdue checks, analytics buckets — must use this timezone.
 *
 * STORAGE CONVENTION
 * ------------------
 * Date-only fields (dueDate, reviewDate, HealthLog.date, etc.) are stored as
 * "midnight in America/New_York expressed as UTC". This means:
 *   - May 10 EDT (UTC-4) is stored as 2026-05-10T04:00:00.000Z
 *   - Jan 10 EST (UTC-5) is stored as 2026-01-10T05:00:00.000Z
 *
 * Never use startOfDay(new Date()) on the server — that produces UTC midnight,
 * which is the wrong day for users in New York after 7 PM EST / 8 PM EDT.
 *
 * Datetime fields (completedAt, createdAt, time block start/end) are stored
 * as plain UTC timestamps and are fine as-is.
 */

import {
  toZonedTime,
  fromZonedTime,
  formatInTimeZone,
} from "date-fns-tz";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  isBefore,
  isEqual,
  parseISO,
  format,
} from "date-fns";

export const APP_TIMEZONE = "America/New_York";

/** Current moment converted to the user's timezone (useful for display). */
export function nowInTZ(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/**
 * Returns a UTC Date representing the start of today (midnight) in
 * America/New_York. Use this everywhere "today" is needed server-side.
 */
export function todayTZ(): Date {
  return startOfDayTZ(new Date());
}

/**
 * Returns a UTC Date representing midnight of the given date in
 * America/New_York. Handles DST automatically.
 */
export function startOfDayTZ(date: Date): Date {
  const zoned = toZonedTime(date, APP_TIMEZONE);
  const localMidnight = startOfDay(zoned);
  return fromZonedTime(localMidnight, APP_TIMEZONE);
}

/**
 * Returns a UTC Date representing 23:59:59.999 of the given date in
 * America/New_York.
 */
export function endOfDayTZ(date: Date): Date {
  const zoned = toZonedTime(date, APP_TIMEZONE);
  const localEndOfDay = endOfDay(zoned);
  return fromZonedTime(localEndOfDay, APP_TIMEZONE);
}

/**
 * Returns a UTC Date representing the start of the week (Monday midnight)
 * for the week containing the given date, in America/New_York.
 */
export function startOfWeekTZ(date: Date = new Date()): Date {
  const zoned = toZonedTime(date, APP_TIMEZONE);
  const localWeekStart = startOfWeek(zoned, { weekStartsOn: 1 });
  return fromZonedTime(localMidnight(localWeekStart), APP_TIMEZONE);
}

/**
 * Returns a UTC Date representing the end of the week (Sunday 23:59:59.999)
 * for the week containing the given date, in America/New_York.
 */
export function endOfWeekTZ(date: Date = new Date()): Date {
  const zoned = toZonedTime(date, APP_TIMEZONE);
  const localWeekEnd = endOfWeek(zoned, { weekStartsOn: 1 });
  return fromZonedTime(endOfDay(localWeekEnd), APP_TIMEZONE);
}

/**
 * Converts a calendar date string ("2026-05-10") into a UTC Date representing
 * midnight of that date in America/New_York.
 *
 * Use this whenever a user types or submits a date string in forms.
 */
export function parseLocalDate(dateStr: string): Date {
  // parseISO gives midnight UTC; we re-interpret as midnight in NY
  const [year, month, day] = dateStr.split("-").map(Number);
  const localMidnightStr = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`;
  return fromZonedTime(localMidnightStr, APP_TIMEZONE);
}

/**
 * Formats a UTC Date in America/New_York using a date-fns format string.
 */
export function formatTZ(date: Date, fmt: string): string {
  return formatInTimeZone(date, APP_TIMEZONE, fmt);
}

/**
 * Returns the local date string ("2026-05-10") for a UTC Date interpreted
 * in America/New_York. Used for day-bucketing in analytics and streaks.
 */
export function toLocalDateKey(date: Date): string {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Returns true if the given UTC Date falls on today in America/New_York.
 */
export function isTodayTZ(date: Date): boolean {
  return toLocalDateKey(date) === toLocalDateKey(new Date());
}

/**
 * Returns true if the due date is before today in America/New_York
 * and not today itself (i.e., strictly overdue).
 */
export function isOverdueTZ(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  const today = todayTZ();
  return isBefore(dueDate, today) && !isTodayTZ(dueDate);
}

/**
 * Returns an array of N week-start dates (Monday midnights in NY),
 * ending with the current week, oldest first.
 */
export function getWeeksBackTZ(n: number): Date[] {
  const weeks: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    weeks.push(startOfWeekTZ(subDays(new Date(), i * 7)));
  }
  return weeks;
}

/**
 * Returns an array of N day-start dates (midnights in NY),
 * ending with today, oldest first.
 */
export function getDaysBackTZ(n: number): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(startOfDayTZ(subDays(new Date(), i)));
  }
  return days;
}

/**
 * Returns a human-readable week range string, formatted in NY timezone.
 * e.g. "Apr 21 – Apr 27, 2026"
 */
export function formatWeekRangeTZ(weekStart: Date): string {
  const weekEnd = endOfWeekTZ(weekStart);
  return `${formatTZ(weekStart, "MMM d")} – ${formatTZ(weekEnd, "MMM d, yyyy")}`;
}

// Internal helper — strips time from a zoned date object
function localMidnight(zonedDate: Date): Date {
  return startOfDay(zonedDate);
}
