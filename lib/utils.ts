import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  APP_TIMEZONE,
  startOfWeekTZ,
  endOfWeekTZ,
  startOfDayTZ,
  todayTZ,
  isOverdueTZ,
  getWeeksBackTZ,
  getDaysBackTZ,
  formatWeekRangeTZ,
} from "./timezone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeekTZ(date);
}

export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeekTZ(date);
}

export function toDateOnly(date: Date): Date {
  return startOfDayTZ(date);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, "MMM d, yyyy");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, "MMM d");
}

export function formatWeekRange(weekStart: Date): string {
  return formatWeekRangeTZ(weekStart);
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function getWeeksBack(n: number): Date[] {
  return getWeeksBackTZ(n);
}

export function getDaysBack(n: number): Date[] {
  return getDaysBackTZ(n);
}

export function isOverdue(dueDate: Date | null | undefined): boolean {
  return isOverdueTZ(dueDate);
}

export const AREA_LABELS: Record<string, string> = {
  COURSEWORK: "Coursework",
  RESEARCH: "Research",
  INTERNSHIP_PREP: "Internship Prep",
  PERSONAL: "Personal",
  HEALTH: "Health",
  ADMIN: "Admin",
  SOCIAL: "Social",
  OTHER: "Other",
};

export const AREA_COLORS: Record<string, string> = {
  COURSEWORK: "#6366f1",
  RESEARCH: "#8b5cf6",
  INTERNSHIP_PREP: "#06b6d4",
  PERSONAL: "#10b981",
  HEALTH: "#f59e0b",
  ADMIN: "#64748b",
  SOCIAL: "#f97316",
  OTHER: "#94a3b8",
};

export const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  THIS_WEEK: "This Week",
  TODAY: "Today",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  SKIPPED: "Skipped",
  ARCHIVED: "Archived",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  DEEP_WORK: "Deep Work",
  ADMIN: "Admin",
  CLASS: "Class",
  EXERCISE: "Exercise",
  PERSONAL: "Personal",
  SOCIAL: "Social",
  REST: "Rest",
  OTHER: "Other",
};

export const BLOCK_TYPE_COLORS: Record<string, string> = {
  DEEP_WORK: "#6366f1",
  ADMIN: "#64748b",
  CLASS: "#0ea5e9",
  EXERCISE: "#10b981",
  PERSONAL: "#8b5cf6",
  SOCIAL: "#f97316",
  REST: "#94a3b8",
  OTHER: "#cbd5e1",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  GYM: "Gym",
  WALKING: "Walking",
  SPORTS: "Sports",
  RUN: "Run",
  CYCLING: "Cycling",
  YOGA: "Yoga",
  OTHER: "Other",
};

export const TASK_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  RECURRING: "Recurring",
  PROMOTED_FROM_SOMEDAY: "Promoted",
};

export const SOMEDAY_STATUS_LABELS: Record<string, string> = {
  SOMEDAY: "Someday",
  ACTIVE: "Promoted",
  DONE: "Done",
  DROPPED: "Dropped",
  ARCHIVED: "Archived",
};

export const EVENT_SOURCE_LABELS: Record<string, string> = {
  INTERNAL: "Manual block",
  EXTERNAL_SYNC: "Imported event",
  RECURRING_COMMITMENT: "Recurring commitment",
};

export const COMMITMENT_TYPE_LABELS: Record<string, string> = {
  CLASS: "Class",
  WORK: "Work",
  GYM: "Gym",
  MEETING: "Meeting",
  PERSONAL: "Personal",
  OTHER: "Other",
};

export const COMMITMENT_TYPE_COLORS: Record<string, string> = {
  CLASS: "#0ea5e9",
  WORK: "#f97316",
  GYM: "#10b981",
  MEETING: "#8b5cf6",
  PERSONAL: "#64748b",
  OTHER: "#94a3b8",
};
