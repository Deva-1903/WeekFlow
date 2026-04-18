import "dotenv/config";
import {
  ActivityType,
  CalendarProvider,
  CommitmentType,
  EventSourceType,
  EventType,
  PrismaClient,
  Priority,
  SomedayStatus,
  TaskArea,
  TaskSourceType,
  TaskStatus,
  TimeBlockStatus,
  TimeBlockType,
  Urgency,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  addDays,
  endOfDay,
  format,
  set,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { prisma as appPrisma } from "../lib/prisma";
import { generateRecurringTasksForUser } from "../lib/recurring-tasks";
import { getFixedCommitmentsForRange, sumCommitmentMinutes } from "../lib/commitments";
import { getWeekEnd } from "../lib/utils";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function weekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function randItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dayAt(date: Date, hours: number, minutes = 0) {
  return set(startOfDay(date), { hours, minutes, seconds: 0, milliseconds: 0 });
}

async function main() {
  console.log("🌱 Seeding WeekFlow...");

  await prisma.dailyBigRock.deleteMany();
  await prisma.weeklyPlanTask.deleteMany();
  await prisma.externalEvent.deleteMany();
  await prisma.timeBlock.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.weeklyPlan.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.healthLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.recurringTaskTemplate.deleteMany();
  await prisma.recurringCommitmentTemplate.deleteMany();
  await prisma.externalCalendar.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.somedayItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(
    process.env.DEMO_USER_PASSWORD ?? "weekflow2024",
    10
  );

  const user = await prisma.user.create({
    data: {
      email: process.env.DEMO_USER_EMAIL ?? "demo@weekflow.app",
      name: "Demo User",
      passwordHash,
      weeklyCapacityMinutes: 2400,
      workingDaysPerWeek: 5,
      bigRockLimit: 3,
      workdayStartTime: "09:00",
      workdayEndTime: "18:00",
    },
  });

  console.log(`✓ Created demo user ${user.email}`);

  const now = new Date();
  const today = startOfDay(now);
  const currentWeekStart = weekStart(today);

  const recurringCommitments = await Promise.all([
    prisma.recurringCommitmentTemplate.create({
      data: {
        userId: user.id,
        title: "Graduate seminar block",
        type: "CLASS",
        sourceType: "RECURRING_COMMITMENT",
        daysOfWeek: [1, 3],
        startTime: "16:00",
        endTime: "17:15",
        startDate: subDays(currentWeekStart, 42),
        affectsCapacity: true,
        isActive: true,
      },
    }),
    prisma.recurringCommitmentTemplate.create({
      data: {
        userId: user.id,
        title: "Part-time job shift",
        type: "WORK",
        sourceType: "RECURRING_COMMITMENT",
        daysOfWeek: [2, 4, 6],
        startTime: "17:00",
        endTime: "21:00",
        startDate: subDays(currentWeekStart, 42),
        affectsCapacity: true,
        isActive: true,
      },
    }),
    prisma.recurringCommitmentTemplate.create({
      data: {
        userId: user.id,
        title: "Gym routine",
        type: "GYM",
        sourceType: "RECURRING_COMMITMENT",
        daysOfWeek: [1, 3, 5],
        startTime: "18:30",
        endTime: "19:30",
        startDate: subDays(currentWeekStart, 42),
        affectsCapacity: true,
        isActive: true,
      },
    }),
    prisma.recurringCommitmentTemplate.create({
      data: {
        userId: user.id,
        title: "Advisor sync",
        type: "MEETING",
        sourceType: "RECURRING_COMMITMENT",
        daysOfWeek: [4],
        startTime: "13:00",
        endTime: "14:00",
        startDate: subDays(currentWeekStart, 42),
        affectsCapacity: true,
        isActive: true,
      },
    }),
  ]);

  console.log(`✓ Created ${recurringCommitments.length} recurring commitment templates`);

  const recurringTaskTemplates = await Promise.all([
    prisma.recurringTaskTemplate.create({
      data: {
        userId: user.id,
        title: "Weekly review",
        description: "Reset the week using real capacity and choose fewer commitments.",
        area: "ADMIN",
        priority: "HIGH",
        estimatedMinutes: 45,
        recurrenceType: "WEEKLY",
        recurrenceConfig: { interval: 1, daysOfWeek: [0], generateDaysAhead: 21 },
        defaultStatus: "THIS_WEEK",
        isActive: true,
        createdAt: subDays(today, 35),
      },
    }),
    prisma.recurringTaskTemplate.create({
      data: {
        userId: user.id,
        title: "Laundry",
        description: "Run laundry before the week gets noisy.",
        area: "PERSONAL",
        priority: "MEDIUM",
        estimatedMinutes: 60,
        recurrenceType: "WEEKLY",
        recurrenceConfig: { interval: 1, daysOfWeek: [6], generateDaysAhead: 14 },
        defaultStatus: "BACKLOG",
        isActive: true,
        createdAt: subDays(today, 28),
      },
    }),
    prisma.recurringTaskTemplate.create({
      data: {
        userId: user.id,
        title: "Meal prep",
        description: "Prep a few easy meals for the week.",
        area: "HEALTH",
        priority: "MEDIUM",
        estimatedMinutes: 90,
        recurrenceType: "WEEKLY",
        recurrenceConfig: { interval: 1, daysOfWeek: [0], generateDaysAhead: 14 },
        defaultStatus: "BACKLOG",
        isActive: true,
        createdAt: subDays(today, 28),
      },
    }),
    prisma.recurringTaskTemplate.create({
      data: {
        userId: user.id,
        title: "Apply to 2 internships",
        description: "Keep outbound applications moving every Friday.",
        area: "INTERNSHIP_PREP",
        priority: "HIGH",
        estimatedMinutes: 90,
        recurrenceType: "WEEKLY",
        recurrenceConfig: { interval: 1, daysOfWeek: [5], generateDaysAhead: 14 },
        defaultStatus: "THIS_WEEK",
        isActive: true,
        createdAt: subDays(today, 42),
      },
    }),
    prisma.recurringTaskTemplate.create({
      data: {
        userId: user.id,
        title: "Review budget",
        description: "Quick monthly money review.",
        area: "ADMIN",
        priority: "MEDIUM",
        estimatedMinutes: 30,
        recurrenceType: "MONTHLY",
        recurrenceConfig: { interval: 1, dayOfMonth: 1, generateDaysAhead: 40 },
        defaultStatus: "BACKLOG",
        isActive: true,
        createdAt: subDays(today, 60),
      },
    }),
  ]);

  for (const pointInTime of [
    subDays(today, 28),
    subDays(today, 21),
    subDays(today, 14),
    subDays(today, 7),
    today,
  ]) {
    await generateRecurringTasksForUser(user.id, { now: pointInTime });
  }

  const generatedRecurringTasks = await prisma.task.findMany({
    where: { userId: user.id, sourceType: "RECURRING" },
    orderBy: [{ dueDate: "asc" }],
  });

  for (const task of generatedRecurringTasks) {
    if (!task.dueDate) continue;

    if (task.dueDate < currentWeekStart) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: Math.random() > 0.25 ? "DONE" : "BACKLOG",
          completedAt: Math.random() > 0.25 ? endOfDay(task.dueDate) : null,
        },
      });
    } else if (task.dueDate <= getWeekEnd(currentWeekStart)) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: task.title === "Weekly review" ? "THIS_WEEK" : task.dueDate <= today ? "TODAY" : "BACKLOG",
        },
      });
    }
  }

  console.log(`✓ Created ${recurringTaskTemplates.length} recurring task templates and generated tasks`);

  const calendarConnection = await prisma.calendarConnection.create({
    data: {
      userId: user.id,
      provider: "GOOGLE",
      providerAccountId: "demo-google-calendar",
      accountEmail: "demo.calendar@gmail.com",
      displayName: "WeekFlow Demo Calendar",
      lastSyncedAt: now,
    },
  });

  const [classesCalendar, workCalendar, personalCalendar, gymCalendar, otherCalendar] = await Promise.all([
    prisma.externalCalendar.create({
      data: {
        userId: user.id,
        connectionId: calendarConnection.id,
        providerCalendarId: "classes",
        name: "Classes",
        color: "#0ea5e9",
        isSelected: true,
        affectsCapacity: true,
        lastSyncedAt: now,
      },
    }),
    prisma.externalCalendar.create({
      data: {
        userId: user.id,
        connectionId: calendarConnection.id,
        providerCalendarId: "work",
        name: "Work",
        color: "#f97316",
        isSelected: true,
        affectsCapacity: true,
        lastSyncedAt: now,
      },
    }),
    prisma.externalCalendar.create({
      data: {
        userId: user.id,
        connectionId: calendarConnection.id,
        providerCalendarId: "personal",
        name: "Personal",
        color: "#64748b",
        isSelected: true,
        affectsCapacity: false,
        lastSyncedAt: now,
      },
    }),
    prisma.externalCalendar.create({
      data: {
        userId: user.id,
        connectionId: calendarConnection.id,
        providerCalendarId: "gym",
        name: "Gym",
        color: "#10b981",
        isSelected: true,
        affectsCapacity: false,
        lastSyncedAt: now,
      },
    }),
    prisma.externalCalendar.create({
      data: {
        userId: user.id,
        connectionId: calendarConnection.id,
        providerCalendarId: "other",
        name: "Other",
        color: "#8b5cf6",
        isSelected: false,
        affectsCapacity: true,
        lastSyncedAt: now,
      },
    }),
  ]);

  async function createExternalEvent(input: {
    calendarId: string;
    providerEventId: string;
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
    affectsCapacity: boolean;
    colorSource?: string;
    isRecurringInstance?: boolean;
  }) {
    await prisma.externalEvent.create({
      data: {
        userId: user.id,
        calendarId: input.calendarId,
        providerEventId: input.providerEventId,
        title: input.title,
        description: input.description,
        location: input.location,
        startTime: input.startTime,
        endTime: input.endTime,
        affectsCapacity: input.affectsCapacity,
        lastSyncedAt: now,
        isRecurringInstance: input.isRecurringInstance ?? true,
      },
    });
  }

  for (let offset = -42; offset <= 14; offset++) {
    const date = addDays(today, offset);
    const weekday = date.getDay();

    if ([1, 3].includes(weekday)) {
      await createExternalEvent({
        calendarId: classesCalendar.id,
        providerEventId: `classes-${format(date, "yyyy-MM-dd")}`,
        title: "Distributed Systems",
        startTime: dayAt(date, 10, 0),
        endTime: dayAt(date, 11, 15),
        location: "CS 301",
        affectsCapacity: true,
      });
    }

    if ([2, 4].includes(weekday)) {
      await createExternalEvent({
        calendarId: workCalendar.id,
        providerEventId: `work-${format(date, "yyyy-MM-dd")}`,
        title: "Campus lab shift",
        startTime: dayAt(date, 14, 0),
        endTime: dayAt(date, 18, 0),
        location: "Research Lab",
        affectsCapacity: true,
      });
    }

    if ([1, 3, 5].includes(weekday)) {
      await createExternalEvent({
        calendarId: gymCalendar.id,
        providerEventId: `gym-${format(date, "yyyy-MM-dd")}`,
        title: "Morning gym",
        startTime: dayAt(date, 7, 0),
        endTime: dayAt(date, 8, 0),
        affectsCapacity: false,
      });
    }

    if (weekday === 5) {
      await createExternalEvent({
        calendarId: personalCalendar.id,
        providerEventId: `personal-${format(date, "yyyy-MM-dd")}`,
        title: "Groceries + errands",
        startTime: dayAt(date, 18, 30),
        endTime: dayAt(date, 20, 0),
        affectsCapacity: false,
      });
    }
  }

  await createExternalEvent({
    calendarId: otherCalendar.id,
    providerEventId: "other-demo-event",
    title: "Apartment admin appointment",
    startTime: dayAt(addDays(today, 3), 12, 0),
    endTime: dayAt(addDays(today, 3), 13, 0),
    affectsCapacity: true,
    isRecurringInstance: false,
  });

  console.log("✓ Seeded mocked Google Calendar connection and external events");

  const somedayItems = await Promise.all([
    prisma.somedayItem.create({
      data: {
        userId: user.id,
        title: "Apply for MA driving license",
        description: "Need to understand paperwork, proof-of-residency, and road test steps.",
        category: "ADMIN",
        roughEffort: "Medium",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 5),
        isImportant: true,
        status: "SOMEDAY",
      },
    }),
    prisma.somedayItem.create({
      data: {
        userId: user.id,
        title: "Get bicycle for summer in Amherst",
        description: "Figure out budget, storage, and whether used is good enough.",
        category: "PERSONAL",
        roughEffort: "Small",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 14),
        isImportant: true,
        status: "SOMEDAY",
      },
    }),
    prisma.somedayItem.create({
      data: {
        userId: user.id,
        title: "Research used bike shops",
        description: "Compare prices and delivery options around Amherst/Northampton.",
        category: "PERSONAL",
        roughEffort: "Small",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 7),
        isImportant: false,
        status: "SOMEDAY",
      },
    }),
    prisma.somedayItem.create({
      data: {
        userId: user.id,
        title: "Update resume for fall recruiting",
        description: "Refresh projects, paper draft, and part-time lab work.",
        category: "INTERNSHIP_PREP",
        roughEffort: "Medium",
        targetTimeframe: "Fall",
        reviewDate: addDays(today, 2),
        isImportant: true,
        status: "SOMEDAY",
      },
    }),
  ]);

  const promotedSomeday = await prisma.somedayItem.create({
    data: {
      userId: user.id,
      title: "Learn Massachusetts driving rules",
      description: "Start with RMV handbook and note confusing edge cases.",
      category: "ADMIN",
      roughEffort: "Small",
      targetTimeframe: "Summer",
      reviewDate: null,
      isImportant: true,
      status: "ACTIVE",
      promotedAt: subDays(today, 4),
    },
  });

  const manualTasks = await Promise.all([
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Complete machine learning assignment 3",
        area: "COURSEWORK",
        status: "DONE",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 180,
        dueDate: subDays(today, 3),
        completedAt: subDays(today, 4),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Study for algorithms midterm",
        area: "COURSEWORK",
        status: "THIS_WEEK",
        priority: "CRITICAL",
        urgency: "HIGH",
        estimatedMinutes: 300,
        dueDate: addDays(today, 3),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Write related work section for paper",
        area: "RESEARCH",
        status: "IN_PROGRESS",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 180,
        dueDate: addDays(today, 1),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Meeting with advisor — prepare slides",
        area: "RESEARCH",
        status: "TODAY",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 60,
        dueDate: today,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Run baseline experiments on dataset A",
        area: "RESEARCH",
        status: "THIS_WEEK",
        priority: "HIGH",
        urgency: "MEDIUM",
        estimatedMinutes: 240,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Renew car insurance",
        area: "ADMIN",
        status: "BACKLOG",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 20,
        dueDate: addDays(today, 2),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Schedule dentist appointment",
        area: "HEALTH",
        status: "BACKLOG",
        priority: "LOW",
        urgency: "LOW",
        estimatedMinutes: 10,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Call parents",
        area: "PERSONAL",
        status: "TODAY",
        priority: "MEDIUM",
        urgency: "MEDIUM",
        estimatedMinutes: 30,
        dueDate: today,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: promotedSomeday.title,
        description: promotedSomeday.description,
        area: promotedSomeday.category,
        status: "THIS_WEEK",
        priority: "MEDIUM",
        urgency: "MEDIUM",
        sourceType: "PROMOTED_FROM_SOMEDAY",
        promotedFromSomedayId: promotedSomeday.id,
      },
    }),
  ]);

  await prisma.somedayItem.update({
    where: { id: promotedSomeday.id },
    data: { convertedTaskId: manualTasks[manualTasks.length - 1].id },
  });

  for (let index = 0; index < 18; index++) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: `Completed task from ${index + 2} weeks ago ${String.fromCharCode(65 + (index % 6))}`,
        area: randItem([
          "COURSEWORK",
          "RESEARCH",
          "INTERNSHIP_PREP",
          "PERSONAL",
          "ADMIN",
        ] as TaskArea[]),
        status: "DONE",
        priority: randItem(["LOW", "MEDIUM", "HIGH"] as Priority[]),
        urgency: randItem(["LOW", "MEDIUM", "HIGH"] as Urgency[]),
        estimatedMinutes: randInt(30, 240),
        completedAt: subDays(today, randInt(8, 56)),
      },
    });
  }

  console.log("✓ Created manual tasks and promoted future task");

  const currentWeekTasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS"] },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  const bigRockTasks = currentWeekTasks.slice(0, 3);
  const todayPlan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: today,
      notes: "Protect the afternoon for research and avoid reactive admin.",
    },
  });

  await prisma.dailyBigRock.createMany({
    data: bigRockTasks.map((task, order) => ({
      dailyPlanId: todayPlan.id,
      taskId: task.id,
      order,
      completed: order === 0,
      completedAt: order === 0 ? today : null,
    })),
  });

  const doneTasks = await prisma.task.findMany({
    where: { userId: user.id, status: "DONE", completedAt: { not: null } },
  });

  for (let offset = 1; offset <= 10; offset++) {
    const date = subDays(today, offset);
    const completedThatDay = doneTasks.filter((task) => {
      if (!task.completedAt) return false;
      return startOfDay(task.completedAt).getTime() === startOfDay(date).getTime();
    });

    if (completedThatDay.length === 0) continue;

    const plan = await prisma.dailyPlan.create({
      data: {
        userId: user.id,
        date: startOfDay(date),
      },
    });

    await prisma.dailyBigRock.createMany({
      data: completedThatDay.slice(0, 3).map((task, order) => ({
        dailyPlanId: plan.id,
        taskId: task.id,
        order,
        completed: true,
        completedAt: date,
      })),
    });
  }

  const focusTask = currentWeekTasks.find((task) => task.area === "RESEARCH") ?? currentWeekTasks[0];

  for (let offset = -21; offset <= 6; offset++) {
    const date = addDays(today, offset);
    const isPast = offset < 0;

    await prisma.timeBlock.create({
      data: {
        userId: user.id,
        taskId: focusTask?.id,
        title: "Deep work: research paper",
        blockType: "DEEP_WORK",
        sourceType: "INTERNAL",
        date: startOfDay(date),
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        status: isPast ? (Math.random() > 0.2 ? "COMPLETED" : "MISSED") : "PLANNED",
      },
    });

    if ([2, 4].includes(date.getDay())) {
      await prisma.timeBlock.create({
        data: {
          userId: user.id,
          title: "Deep work over lab shift",
          blockType: "DEEP_WORK",
          sourceType: "INTERNAL",
          date: startOfDay(date),
          startTime: "15:00",
          endTime: "16:30",
          durationMinutes: 90,
          status: isPast ? "MISSED" : "PLANNED",
          notes: "Intentional conflict sample for analytics.",
        },
      });
    }

    if (date.getDay() === 4) {
      await prisma.timeBlock.create({
        data: {
          userId: user.id,
          title: "Email + admin",
          blockType: "ADMIN",
          sourceType: "INTERNAL",
          date: startOfDay(date),
          startTime: "13:30",
          endTime: "14:15",
          durationMinutes: 45,
          status: isPast ? "COMPLETED" : "PLANNED",
        },
      });
    }
  }

  console.log("✓ Created time blocks with some intentional conflicts");

  for (let offset = 0; offset < 60; offset++) {
    const date = startOfDay(subDays(today, offset));
    const smoked = Math.random() < 0.25;
    const drank = Math.random() < 0.22;
    const active = Math.random() < 0.58;

    await prisma.healthLog.create({
      data: {
        userId: user.id,
        date,
        smokedToday: smoked,
        cigaretteCount: smoked ? randInt(1, 6) : null,
        drankAlcoholToday: drank,
        alcoholCount: drank ? randInt(1, 3) : null,
        didPhysicalActivityToday: active,
        activityType: active
          ? randItem(["GYM", "WALKING", "RUN", "CYCLING", "YOGA"] as ActivityType[])
          : null,
        activityDurationMinutes: active ? randInt(20, 75) : null,
        notes: offset === 0 ? "Felt pretty clear-headed today." : null,
      },
    });
  }

  console.log("✓ Created health logs");

  for (let weekIndex = 0; weekIndex < 8; weekIndex++) {
    const ws = weekStart(subDays(today, weekIndex * 7));
    const weekEnd = getWeekEnd(ws);
    const commitments = await getFixedCommitmentsForRange(user.id, ws, weekEnd);
    const fixedCommitmentMinutes = sumCommitmentMinutes(commitments);
    const selectedTasks =
      weekIndex === 0
        ? await prisma.task.findMany({
            where: {
              userId: user.id,
              status: { in: ["THIS_WEEK", "TODAY", "IN_PROGRESS"] },
            },
            take: 6,
            orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          })
        : await prisma.task.findMany({
            where: {
              userId: user.id,
              status: "DONE",
              completedAt: { gte: ws, lte: weekEnd },
            },
            take: 4,
            orderBy: { completedAt: "asc" },
          });

    const committedMinutes = selectedTasks.reduce(
      (sum, task) => sum + (task.estimatedMinutes ?? 0),
      0
    );

    const plan = await prisma.weeklyPlan.create({
      data: {
        userId: user.id,
        weekStart: ws,
        availableMinutes: user.weeklyCapacityMinutes,
        fixedCommitmentMinutes,
        remainingFocusMinutes: Math.max(user.weeklyCapacityMinutes - fixedCommitmentMinutes, 0),
        committedMinutes,
        weeklyGoals:
          weekIndex === 0
            ? "Finish the midterm prep, keep research moving, and respect real constraints."
            : null,
        reflectionWentWell: weekIndex > 0 ? "Protected more focus blocks than usual." : null,
        reflectionSlipped: weekIndex > 0 ? "Admin tasks kept leaking into evenings." : null,
        reflectionChange: weekIndex > 0 ? "Block admin earlier in the day." : null,
      },
    });

    if (selectedTasks.length > 0) {
      await prisma.weeklyPlanTask.createMany({
        data: selectedTasks.map((task) => ({
          weeklyPlanId: plan.id,
          taskId: task.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log("✓ Created weekly plans with fixed-commitment snapshots");

  const activityEvents = await prisma.task.findMany({
    where: { userId: user.id, status: "DONE", completedAt: { not: null } },
    select: { id: true, title: true, completedAt: true },
  });

  for (const task of activityEvents.slice(0, 24)) {
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: "TASK_COMPLETED",
        entityId: task.id,
        entityType: "Task",
        metadata: { title: task.title },
        createdAt: task.completedAt ?? subDays(today, 1),
      },
    });
  }

  for (let index = 0; index < 12; index++) {
    const task = randItem(currentWeekTasks);
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: "TASK_RESCHEDULED",
        entityId: task.id,
        entityType: "Task",
        metadata: { title: task.title },
        createdAt: subDays(today, randInt(0, 40)),
      },
    });
  }

  await prisma.activityEvent.create({
    data: {
      userId: user.id,
      type: "CALENDAR_SYNCED",
      entityId: calendarConnection.id,
      entityType: "CalendarConnection",
      metadata: { title: "WeekFlow Demo Calendar" },
      createdAt: now,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId: user.id,
      type: "SOMEDAY_PROMOTED",
      entityId: promotedSomeday.id,
      entityType: "SomedayItem",
      metadata: { title: promotedSomeday.title },
      createdAt: promotedSomeday.promotedAt ?? now,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId: user.id,
      type: "SOMEDAY_REVIEWED",
      entityId: somedayItems[0].id,
      entityType: "SomedayItem",
      metadata: { title: somedayItems[0].title },
      createdAt: subDays(today, 1),
    },
  });

  console.log("✓ Created activity events");
  console.log("✅ Seed complete");
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: ${process.env.DEMO_USER_PASSWORD ?? "weekflow2024"}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await appPrisma.$disconnect();
  });
