import { RecurringFrequency } from "@prisma/client";
import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export interface NormalizedRecurrenceConfig {
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  generateDaysAhead: number;
  customDates: string[];
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export const ROUGH_EFFORT_OPTIONS = ["Tiny", "Small", "Medium", "Large"];

export const TARGET_TIMEFRAME_OPTIONS = [
  "Before semester",
  "Summer",
  "Fall",
  "Winter",
  "Later",
];

export function getDateKey(date: Date) {
  return format(startOfDay(date), "yyyy-MM-dd");
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getDurationMinutes(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (endMinutes >= startMinutes) {
    return endMinutes - startMinutes;
  }

  return 24 * 60 - startMinutes + endMinutes;
}

export function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function getDateWithTimeRange(date: Date, startTime: string, endTime: string) {
  const startDateTime = combineDateAndTime(date, startTime);
  let endDateTime = combineDateAndTime(date, endTime);

  if (endDateTime <= startDateTime) {
    endDateTime = addDays(endDateTime, 1);
  }

  return { startDateTime, endDateTime };
}

export function rangesOverlap(
  rangeAStart: Date,
  rangeAEnd: Date,
  rangeBStart: Date,
  rangeBEnd: Date
) {
  return rangeAStart < rangeBEnd && rangeBStart < rangeAEnd;
}

export function enumerateDays(start: Date, end: Date) {
  return eachDayOfInterval({
    start: startOfDay(start),
    end: startOfDay(end),
  });
}

export function normalizeRecurrenceConfig(
  config: unknown,
  recurrenceType: RecurringFrequency,
  fallbackDate = new Date()
): NormalizedRecurrenceConfig {
  const raw = (config ?? {}) as Record<string, unknown>;

  const interval =
    typeof raw.interval === "number" && raw.interval > 0
      ? Math.floor(raw.interval)
      : 1;

  const daysOfWeek = Array.isArray(raw.daysOfWeek)
    ? raw.daysOfWeek
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : recurrenceType === "WEEKLY"
      ? [fallbackDate.getDay()]
      : [];

  const dayOfMonth =
    typeof raw.dayOfMonth === "number" &&
    raw.dayOfMonth >= 1 &&
    raw.dayOfMonth <= 31
      ? Math.floor(raw.dayOfMonth)
      : recurrenceType === "MONTHLY"
        ? fallbackDate.getDate()
        : null;

  const generateDaysAhead =
    typeof raw.generateDaysAhead === "number" && raw.generateDaysAhead >= 0
      ? Math.floor(raw.generateDaysAhead)
      : recurrenceType === "DAILY"
        ? 3
        : recurrenceType === "MONTHLY"
          ? 40
          : 14;

  const customDates = Array.isArray(raw.customDates)
    ? raw.customDates.filter((value): value is string => typeof value === "string")
    : [];

  return {
    interval,
    daysOfWeek,
    dayOfMonth,
    generateDaysAhead,
    customDates,
  };
}

export function matchesRecurringPattern(
  date: Date,
  recurrenceType: RecurringFrequency,
  config: NormalizedRecurrenceConfig,
  anchorDate: Date
) {
  const normalizedDate = startOfDay(date);
  const normalizedAnchor = startOfDay(anchorDate);

  switch (recurrenceType) {
    case "DAILY":
      return differenceInCalendarDays(normalizedDate, normalizedAnchor) % config.interval === 0;
    case "WEEKLY": {
      if (!config.daysOfWeek.includes(normalizedDate.getDay())) return false;
      return (
        differenceInCalendarWeeks(normalizedDate, startOfWeek(normalizedAnchor, { weekStartsOn: 1 }), {
          weekStartsOn: 1,
        }) %
          config.interval ===
        0
      );
    }
    case "MONTHLY": {
      if ((config.dayOfMonth ?? normalizedAnchor.getDate()) !== normalizedDate.getDate()) {
        return false;
      }

      return (
        differenceInCalendarMonths(
          startOfMonth(normalizedDate),
          startOfMonth(normalizedAnchor)
        ) %
          config.interval ===
        0
      );
    }
    case "CUSTOM":
      if (config.customDates.length > 0) {
        return config.customDates.includes(getDateKey(normalizedDate));
      }
      if (config.daysOfWeek.length > 0) {
        return config.daysOfWeek.includes(normalizedDate.getDay());
      }
      return false;
    default:
      return false;
  }
}

export function getRecurringOccurrences(
  recurrenceType: RecurringFrequency,
  config: NormalizedRecurrenceConfig,
  anchorDate: Date,
  rangeStart: Date,
  rangeEnd: Date
) {
  return enumerateDays(rangeStart, endOfDay(rangeEnd)).filter((date) =>
    matchesRecurringPattern(date, recurrenceType, config, anchorDate)
  );
}
