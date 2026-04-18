import {
  CommitmentType,
  EventSourceType,
  Prisma,
  TaskStatus,
} from "@prisma/client";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getWeekEnd } from "@/lib/utils";
import {
  combineDateAndTime,
  enumerateDays,
  getDateKey,
  getDateWithTimeRange,
  getDurationMinutes,
  rangesOverlap,
} from "@/lib/planning";

const COMMITMENT_COLORS: Record<CommitmentType, string> = {
  CLASS: "#0ea5e9",
  WORK: "#f97316",
  GYM: "#10b981",
  MEETING: "#8b5cf6",
  PERSONAL: "#64748b",
  OTHER: "#94a3b8",
};

type ExternalEventWithCalendar = Prisma.ExternalEventGetPayload<{
  include: {
    calendar: {
      select: {
        id: true;
        name: true;
        color: true;
        affectsCapacity: true;
        isSelected: true;
      };
    };
  };
}>;

type RecurringCommitmentTemplateRecord =
  Prisma.RecurringCommitmentTemplateGetPayload<Record<string, never>>;

export interface FixedCommitment {
  id: string;
  sourceId: string;
  sourceType: EventSourceType;
  title: string;
  description?: string | null;
  location?: string | null;
  commitmentType: CommitmentType;
  date: Date;
  startDateTime: Date;
  endDateTime: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isAllDay: boolean;
  affectsCapacity: boolean;
  status?: string;
  color?: string | null;
  secondaryLabel?: string;
}

function inferCommitmentType(title: string, calendarName?: string | null) {
  const haystack = `${title} ${calendarName ?? ""}`.toLowerCase();

  if (haystack.includes("class") || haystack.includes("lecture") || haystack.includes("lab")) {
    return "CLASS";
  }
  if (haystack.includes("gym") || haystack.includes("workout") || haystack.includes("exercise")) {
    return "GYM";
  }
  if (haystack.includes("work") || haystack.includes("shift") || haystack.includes("office")) {
    return "WORK";
  }
  if (haystack.includes("meeting") || haystack.includes("advisor") || haystack.includes("standup")) {
    return "MEETING";
  }
  if (haystack.includes("personal") || haystack.includes("family")) {
    return "PERSONAL";
  }

  return "OTHER";
}

function buildExternalCommitment(event: ExternalEventWithCalendar): FixedCommitment {
  const commitmentType = inferCommitmentType(event.title, event.calendar.name);

  return {
    id: `external:${event.id}`,
    sourceId: event.id,
    sourceType: event.sourceType,
    title: event.title,
    description: event.description,
    location: event.location,
    commitmentType,
    date: startOfDay(event.startTime),
    startDateTime: event.startTime,
    endDateTime: event.endTime,
    startTime: format(event.startTime, "HH:mm"),
    endTime: format(event.endTime, "HH:mm"),
    durationMinutes: Math.max(
      0,
      Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60000)
    ),
    isAllDay: event.isAllDay,
    affectsCapacity: event.affectsCapacity && event.calendar.affectsCapacity,
    status: event.status,
    color: event.calendar.color ?? COMMITMENT_COLORS[commitmentType],
    secondaryLabel: event.calendar.name,
  };
}

function buildRecurringCommitment(
  template: RecurringCommitmentTemplateRecord,
  date: Date
): FixedCommitment {
  const { startDateTime, endDateTime } = getDateWithTimeRange(
    date,
    template.startTime,
    template.endTime
  );

  return {
    id: `recurring:${template.id}:${getDateKey(date)}`,
    sourceId: template.id,
    sourceType: template.sourceType,
    title: template.title,
    commitmentType: template.type,
    date: startOfDay(date),
    startDateTime,
    endDateTime,
    startTime: template.startTime,
    endTime: template.endTime,
    durationMinutes: getDurationMinutes(template.startTime, template.endTime),
    isAllDay: false,
    affectsCapacity: template.affectsCapacity,
    color: COMMITMENT_COLORS[template.type],
    secondaryLabel: "Recurring commitment",
  };
}

export function expandRecurringCommitments(
  templates: RecurringCommitmentTemplateRecord[],
  rangeStart: Date,
  rangeEnd: Date
) {
  const days = enumerateDays(rangeStart, rangeEnd);

  return templates.flatMap((template) =>
    days
      .filter((date) => {
        if (!template.daysOfWeek.includes(date.getDay())) return false;
        if (template.startDate && startOfDay(date) < startOfDay(template.startDate)) {
          return false;
        }
        if (template.endDate && startOfDay(date) > startOfDay(template.endDate)) {
          return false;
        }

        return true;
      })
      .map((date) => buildRecurringCommitment(template, date))
  );
}

export async function getFixedCommitmentsForRange(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const [externalEvents, recurringTemplates] = await Promise.all([
    prisma.externalEvent.findMany({
      where: {
        userId,
        startTime: { lte: rangeEnd },
        endTime: { gte: rangeStart },
        calendar: {
          isSelected: true,
        },
        status: { not: "cancelled" },
      },
      include: {
        calendar: {
          select: {
            id: true,
            name: true,
            color: true,
            affectsCapacity: true,
            isSelected: true,
          },
        },
      },
      orderBy: [{ startTime: "asc" }],
    }),
    prisma.recurringCommitmentTemplate.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ startTime: "asc" }, { title: "asc" }],
    }),
  ]);

  return [
    ...externalEvents.map((event) => buildExternalCommitment(event)),
    ...expandRecurringCommitments(recurringTemplates, rangeStart, rangeEnd),
  ].sort((left, right) => left.startDateTime.getTime() - right.startDateTime.getTime());
}

export function sumCommitmentMinutes(commitments: FixedCommitment[], onlyCapacity = true) {
  return commitments.reduce((sum, commitment) => {
    if (onlyCapacity && !commitment.affectsCapacity) {
      return sum;
    }

    return sum + commitment.durationMinutes;
  }, 0);
}

export async function getWeeklyCapacityBreakdown(
  userId: string,
  weekStart: Date,
  options?: {
    selectedTaskIds?: string[];
    theoreticalMinutes?: number;
    taskStatuses?: TaskStatus[];
  }
) {
  const normalizedWeekStart = startOfDay(weekStart);
  const weekEnd = endOfDay(getWeekEnd(normalizedWeekStart));

  const [user, fixedCommitments, taskMinutesAggregate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        weeklyCapacityMinutes: true,
      },
    }),
    getFixedCommitmentsForRange(userId, normalizedWeekStart, weekEnd),
    prisma.task.aggregate({
      where: {
        userId,
        ...(options?.selectedTaskIds?.length
          ? { id: { in: options.selectedTaskIds } }
          : {
              status: {
                in: options?.taskStatuses ?? ["THIS_WEEK", "TODAY", "IN_PROGRESS"],
              },
            }),
      },
      _sum: {
        estimatedMinutes: true,
      },
    }),
  ]);

  const theoreticalMinutes =
    options?.theoreticalMinutes ?? user?.weeklyCapacityMinutes ?? 2400;
  const fixedCommitmentMinutes = sumCommitmentMinutes(fixedCommitments, true);
  const remainingFocusMinutes = Math.max(theoreticalMinutes - fixedCommitmentMinutes, 0);
  const committedTaskMinutes = taskMinutesAggregate._sum.estimatedMinutes ?? 0;

  return {
    weekStart: normalizedWeekStart,
    weekEnd,
    theoreticalMinutes,
    fixedCommitmentMinutes,
    remainingFocusMinutes,
    committedTaskMinutes,
    overloadMinutes: Math.max(committedTaskMinutes - remainingFocusMinutes, 0),
    isOverloaded: committedTaskMinutes > remainingFocusMinutes,
    commitments: fixedCommitments,
  };
}

export async function getFixedCommitmentConflicts(
  userId: string,
  input: {
    date: Date;
    startTime: string;
    endTime: string;
  }
) {
  const normalizedDate = startOfDay(input.date);
  const windowStart = normalizedDate;
  const windowEnd = endOfDay(addDays(normalizedDate, 1));
  const { startDateTime, endDateTime } = getDateWithTimeRange(
    normalizedDate,
    input.startTime,
    input.endTime
  );
  const commitments = await getFixedCommitmentsForRange(userId, windowStart, windowEnd);

  return commitments.filter((commitment) =>
    rangesOverlap(
      commitment.startDateTime,
      commitment.endDateTime,
      startDateTime,
      endDateTime
    )
  );
}

export function getConflictsForTimeBlocks(
  timeBlocks: Array<{
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
  }>,
  fixedCommitments: FixedCommitment[]
) {
  return new Map(
    timeBlocks.map((block) => {
      const { startDateTime, endDateTime } = getDateWithTimeRange(
        block.date,
        block.startTime,
        block.endTime
      );

      const overlapping = fixedCommitments.filter((commitment) =>
        rangesOverlap(
          commitment.startDateTime,
          commitment.endDateTime,
          startDateTime,
          endDateTime
        )
      );

      return [block.id, overlapping] as const;
    })
  );
}

export async function getCalendarConflictCount(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const [timeBlocks, fixedCommitments] = await Promise.all([
    prisma.timeBlock.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(rangeStart),
          lte: endOfDay(rangeEnd),
        },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    }),
    getFixedCommitmentsForRange(userId, startOfDay(rangeStart), endOfDay(rangeEnd)),
  ]);

  const conflicts = getConflictsForTimeBlocks(timeBlocks, fixedCommitments);
  return Array.from(conflicts.values()).filter((items) => items.length > 0).length;
}
