import {
  Prisma,
  RecurringTaskTemplate,
  TaskArea,
  TaskSourceType,
} from "@prisma/client";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  getDateKey,
  getRecurringOccurrences,
  normalizeRecurrenceConfig,
} from "@/lib/planning";

type TemplateRecord = Prisma.RecurringTaskTemplateGetPayload<Record<string, never>>;

function buildGeneratedTaskInput(template: TemplateRecord, dueDate: Date) {
  return {
    userId: template.userId,
    title: template.title,
    description: template.description,
    area: template.area,
    priority: template.priority,
    urgency: "MEDIUM" as const,
    estimatedMinutes: template.estimatedMinutes,
    status: template.defaultStatus,
    dueDate: startOfDay(dueDate),
    startDate: startOfDay(dueDate),
    isRecurring: true,
    sourceType: "RECURRING" as TaskSourceType,
    originRecurringTemplateId: template.id,
    recurrencePeriodKey: getDateKey(dueDate),
  };
}

function getTemplateOccurrences(template: TemplateRecord, today: Date) {
  const config = normalizeRecurrenceConfig(
    template.recurrenceConfig,
    template.recurrenceType,
    template.createdAt
  );
  const rangeStart = startOfDay(today);
  const rangeEnd = endOfDay(addDays(rangeStart, config.generateDaysAhead));

  return getRecurringOccurrences(
    template.recurrenceType,
    config,
    template.createdAt,
    rangeStart,
    rangeEnd
  );
}

export async function generateRecurringTasksForUser(
  userId: string,
  options?: {
    templateId?: string;
    now?: Date;
  }
) {
  const now = options?.now ?? new Date();
  const templates = await prisma.recurringTaskTemplate.findMany({
    where: {
      userId,
      isActive: true,
      ...(options?.templateId ? { id: options.templateId } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (templates.length === 0) {
    return { createdCount: 0, tasks: [] as Array<{ id: string; title: string }> };
  }

  const candidateTasks = templates.flatMap((template) =>
    getTemplateOccurrences(template, now).map((occurrence) => ({
      template,
      input: buildGeneratedTaskInput(template, occurrence),
    }))
  );

  if (candidateTasks.length === 0) {
    return { createdCount: 0, tasks: [] as Array<{ id: string; title: string }> };
  }

  await prisma.task.createMany({
    data: candidateTasks.map(({ input }) => input),
    skipDuplicates: true,
  });

  const groupedByTemplate = new Map<string, string[]>();
  for (const candidate of candidateTasks) {
    const keys = groupedByTemplate.get(candidate.template.id) ?? [];
    keys.push(candidate.input.recurrencePeriodKey!);
    groupedByTemplate.set(candidate.template.id, keys);
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      sourceType: "RECURRING",
      OR: Array.from(groupedByTemplate.entries()).map(([templateId, periodKeys]) => ({
        originRecurringTemplateId: templateId,
        recurrencePeriodKey: { in: periodKeys },
      })),
    },
    select: {
      id: true,
      title: true,
      originRecurringTemplateId: true,
      recurrencePeriodKey: true,
    },
  });

  await prisma.$transaction([
    ...templates.map((template) =>
      prisma.recurringTaskTemplate.update({
        where: { id: template.id },
        data: { lastGeneratedAt: now },
      })
    ),
    ...templates.map((template) =>
      prisma.activityEvent.create({
        data: {
          userId,
          type: "RECURRING_TASK_GENERATED",
          entityId: template.id,
          entityType: "RecurringTaskTemplate",
          metadata: { title: template.title },
        },
      })
    ),
  ]);

  return { createdCount: tasks.length, tasks };
}
