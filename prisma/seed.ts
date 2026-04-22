import "dotenv/config";
import {
  ActivityType,
  PrismaClient,
  Priority,
  TaskArea,
  Urgency,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { addDays, endOfDay, set, subDays } from "date-fns";
import {
  startOfDayTZ,
  startOfWeekTZ,
  todayTZ,
  toLocalDateKey,
} from "../lib/timezone";
import { normalizePostgresUrlForPg } from "../lib/postgres-url";

const pool = new Pool({
  connectionString: normalizePostgresUrlForPg(process.env.DATABASE_URL),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function randItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dayAt(date: Date, hours: number, minutes = 0) {
  return set(startOfDayTZ(date), { hours, minutes, seconds: 0, milliseconds: 0 });
}

async function clearDatabase() {
  await prisma.dailyPlanItem.deleteMany();
  await prisma.dailyBigRock.deleteMany();
  await prisma.routineSession.deleteMany();
  await prisma.weeklyPlanTask.deleteMany();
  await prisma.externalEvent.deleteMany();
  await prisma.timeBlock.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.weeklyPlan.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.healthLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.inboxItem.deleteMany();
  await prisma.futureItem.deleteMany();
  await prisma.recurringRoutine.deleteMany();
  await prisma.recurringTaskTemplate.deleteMany();
  await prisma.recurringCommitmentTemplate.deleteMany();
  await prisma.externalCalendar.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.somedayItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed script must not run in production. Set NODE_ENV=development to seed locally.");
  }

  console.log("Seeding WeekFlow V1 execution system...");
  await clearDatabase();

  const passwordHash = await bcrypt.hash(
    process.env.DEMO_USER_PASSWORD ?? "weekflow2024",
    10
  );

  const user = await prisma.user.create({
    data: {
      email: process.env.DEMO_USER_EMAIL ?? "demo@weekflow.app",
      name: "Demo User",
      passwordHash,
      weeklyCapacityMinutes: 2100,
      workingDaysPerWeek: 5,
      bigRockLimit: 3,
      workdayStartTime: "09:00",
      workdayEndTime: "18:00",
    },
  });

  const now = new Date();
  const today = todayTZ();
  const tomorrow = startOfDayTZ(addDays(today, 1));
  const weekStart = startOfWeekTZ(today);

  console.log(`Created demo user ${user.email}`);

  await prisma.inboxItem.createMany({
    data: [
      {
        userId: user.id,
        title: "Ask professor whether project proposal can use the alignment dataset",
        note: "Maybe mention uncertainty around eval metrics.",
        createdAt: subDays(now, 1),
      },
      {
        userId: user.id,
        title: "Figure out where the lab paycheck tax form went",
        note: "Probably buried in email.",
        createdAt: subDays(now, 1),
      },
      {
        userId: user.id,
        title: "Used guitar idea",
        note: "Not now. Would be fun once semester pressure drops.",
        createdAt: subDays(now, 2),
      },
      {
        userId: user.id,
        title: "Random thought: compare RLHF failure cases with debate setups",
        note: "Could become a research note later.",
      },
      {
        userId: user.id,
        title: "Buy replacement charger",
        note: "MacBook charger is getting sketchy.",
      },
    ],
  });

  const futureItems = await Promise.all([
    prisma.futureItem.create({
      data: {
        userId: user.id,
        title: "Apply for MA driving license",
        description: "Understand RMV documents, proof of residency, and timing around semester workload.",
        category: "LIFE_ADMIN",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 5),
      },
    }),
    prisma.futureItem.create({
      data: {
        userId: user.id,
        title: "Get bicycle for summer in Amherst",
        description: "Check used options, storage, budget, and whether repair shops are nearby.",
        category: "PERSONAL",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 14),
      },
    }),
    prisma.futureItem.create({
      data: {
        userId: user.id,
        title: "Research used bike shops",
        description: "Look around Amherst/Northampton and compare price ranges.",
        category: "PERSONAL",
        targetTimeframe: "Summer",
        reviewDate: addDays(today, 7),
      },
    }),
    prisma.futureItem.create({
      data: {
        userId: user.id,
        title: "Update resume for fall recruiting",
        description: "Refresh ML project, lab work, and systems coursework bullets.",
        category: "INTERNSHIP_PREP",
        targetTimeframe: "Fall",
        reviewDate: addDays(today, 2),
      },
    }),
    prisma.futureItem.create({
      data: {
        userId: user.id,
        title: "Learn Massachusetts driving rules",
        description: "Start with the RMV handbook and make a notes page.",
        category: "LIFE_ADMIN",
        targetTimeframe: "Later",
        status: "ACTIVE",
      },
    }),
  ]);

  const routines = await Promise.all([
    prisma.recurringRoutine.create({
      data: {
        userId: user.id,
        title: "Gym",
        description: "A real session counts. Flexible target; missing one does not break the system.",
        category: "HEALTH",
        recurrenceType: "WEEKLY",
        targetCount: 4,
        targetPeriod: "WEEK",
        preferredDays: [1, 3, 5, 6],
        preferredTime: "18:30",
        strictnessMode: "FLEXIBLE",
        generateTasks: false,
      },
    }),
    prisma.recurringRoutine.create({
      data: {
        userId: user.id,
        title: "DSA practice",
        description: "One focused LeetCode / patterns block.",
        category: "SDE_PREP",
        recurrenceType: "DAILY",
        targetCount: 1,
        targetPeriod: "DAY",
        strictnessMode: "FLEXIBLE",
        generateTasks: true,
        defaultTaskTitle: "DSA practice block",
        defaultTaskCategory: "SDE_PREP",
        defaultEffortEstimate: 60,
      },
    }),
    prisma.recurringRoutine.create({
      data: {
        userId: user.id,
        title: "ML interview prep",
        description: "Review one topic, implement one concept, or answer one applied question.",
        category: "ML_PREP",
        recurrenceType: "WEEKLY",
        targetCount: 4,
        targetPeriod: "WEEK",
        preferredDays: [1, 2, 4, 6],
        strictnessMode: "FLEXIBLE",
        generateTasks: true,
        defaultTaskTitle: "ML interview prep",
        defaultTaskCategory: "ML_PREP",
        defaultEffortEstimate: 75,
      },
    }),
    prisma.recurringRoutine.create({
      data: {
        userId: user.id,
        title: "AI safety research",
        description: "Sustained work on the alignment reading / experiment thread.",
        category: "AI_SAFETY_ALIGNMENT",
        recurrenceType: "WEEKLY",
        targetCount: 3,
        targetPeriod: "WEEK",
        preferredDays: [2, 4, 0],
        strictnessMode: "FLEXIBLE",
        generateTasks: true,
        defaultTaskTitle: "AI safety research session",
        defaultTaskCategory: "AI_SAFETY_ALIGNMENT",
        defaultEffortEstimate: 120,
      },
    }),
    prisma.recurringRoutine.create({
      data: {
        userId: user.id,
        title: "Weekly review",
        description: "Empty inbox, review future items, choose what actually belongs in the week.",
        category: "LIFE_ADMIN",
        recurrenceType: "WEEKLY",
        targetCount: 1,
        targetPeriod: "WEEK",
        preferredDays: [0],
        strictnessMode: "FLEXIBLE",
        generateTasks: true,
        defaultTaskTitle: "Weekly review",
        defaultTaskCategory: "LIFE_ADMIN",
        defaultEffortEstimate: 45,
      },
    }),
  ]);

  const routineSessions = [];
  for (const routine of routines) {
    const count = routine.title === "Gym" ? 2 : routine.title === "DSA practice" ? 4 : randInt(1, Math.max(1, routine.targetCount - 1));
    for (let index = 0; index < count; index++) {
      routineSessions.push({
        userId: user.id,
        routineId: routine.id,
        date: startOfDayTZ(addDays(weekStart, Math.min(index + 1, 6))),
        completed: true,
        notes: index === 0 ? "Seeded demo session" : null,
      });
    }
  }
  await prisma.routineSession.createMany({ data: routineSessions });

  const manualTasks = await Promise.all([
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Finish distributed systems homework",
        description: "Focus on the consensus questions before implementation details.",
        area: "COURSEWORK",
        status: "ACTIVE",
        priority: "CRITICAL",
        urgency: "HIGH",
        estimatedMinutes: 180,
        dueDate: addDays(today, 2),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Prepare advisor meeting notes",
        area: "RESEARCH",
        status: "TOMORROW",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 60,
        dueDate: tomorrow,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Run baseline experiments for alignment toy model",
        area: "AI_SAFETY_ALIGNMENT",
        status: "IN_PROGRESS",
        priority: "HIGH",
        urgency: "MEDIUM",
        estimatedMinutes: 240,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Apply to 2 internships",
        area: "INTERNSHIP_PREP",
        status: "ACTIVE",
        priority: "HIGH",
        urgency: "MEDIUM",
        estimatedMinutes: 90,
        dueDate: addDays(today, 4),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Review LLD parking lot design",
        area: "SDE_PREP",
        status: "ACTIVE",
        priority: "MEDIUM",
        urgency: "MEDIUM",
        estimatedMinutes: 75,
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Renew renters insurance",
        area: "LIFE_ADMIN",
        status: "BACKLOG",
        priority: "HIGH",
        urgency: "HIGH",
        estimatedMinutes: 25,
        dueDate: addDays(today, 3),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Submit reimbursement form",
        area: "JOB",
        status: "ACTIVE",
        priority: "MEDIUM",
        urgency: "HIGH",
        estimatedMinutes: 20,
        dueDate: subDays(today, 1),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: futureItems[4].title,
        description: futureItems[4].description,
        area: futureItems[4].category,
        status: "ACTIVE",
        priority: "MEDIUM",
        urgency: "LOW",
        sourceType: "PROMOTED_FUTURE",
        promotedFromFutureId: futureItems[4].id,
      },
    }),
  ]);

  await prisma.futureItem.update({
    where: { id: futureItems[4].id },
    data: { promotedTaskId: manualTasks[manualTasks.length - 1].id },
  });

  for (let index = 0; index < 26; index++) {
    const completedAt = subDays(today, randInt(1, 50));
    await prisma.task.create({
      data: {
        userId: user.id,
        title: `Completed demo task ${index + 1}`,
        area: randItem([
          "COURSEWORK",
          "RESEARCH",
          "INTERNSHIP_PREP",
          "SDE_PREP",
          "ML_PREP",
          "AI_SAFETY_ALIGNMENT",
          "LIFE_ADMIN",
        ] as TaskArea[]),
        status: "DONE",
        priority: randItem(["LOW", "MEDIUM", "HIGH"] as Priority[]),
        urgency: randItem(["LOW", "MEDIUM", "HIGH"] as Urgency[]),
        estimatedMinutes: randInt(25, 180),
        completedAt,
      },
    });
  }

  const routineTasks = [];
  for (const routine of routines.filter((routine) => routine.generateTasks)) {
    const count = routine.targetPeriod === "DAY" ? 1 : routine.targetCount;
    for (let index = 0; index < count; index++) {
      const dueDate = routine.targetPeriod === "DAY"
        ? today
        : startOfDayTZ(addDays(weekStart, routine.preferredDays[index % Math.max(1, routine.preferredDays.length)] ?? index));
      routineTasks.push({
        userId: user.id,
        title: count > 1 ? `${routine.defaultTaskTitle ?? routine.title} ${index + 1}/${count}` : routine.defaultTaskTitle ?? routine.title,
        description: routine.description,
        area: routine.defaultTaskCategory ?? routine.category,
        status: "ACTIVE" as const,
        priority: "MEDIUM" as const,
        urgency: "MEDIUM" as const,
        estimatedMinutes: routine.defaultEffortEstimate,
        dueDate,
        startDate: dueDate,
        isRecurring: true,
        sourceType: "ROUTINE" as const,
        originRoutineId: routine.id,
        routinePeriodKey: `${toLocalDateKey(weekStart)}:${index + 1}`,
        notes: `Generated from routine: ${routine.title}`,
      });
    }
  }
  await prisma.task.createMany({ data: routineTasks, skipDuplicates: true });

  const tomorrowCandidates = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "TOMORROW", "IN_PROGRESS"] },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 5,
  });

  const tomorrowPlan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: tomorrow,
      notes: "A good day: protect one research block, do one interview-prep block, and stop letting admin leak everywhere.",
    },
  });

  await prisma.dailyPlanItem.createMany({
    data: tomorrowCandidates.map((task, order) => ({
      dailyPlanId: tomorrowPlan.id,
      taskId: task.id,
      order,
      isTopPriority: order < 3,
    })),
  });

  const todayPlan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: today,
      notes: "Keep it narrow. Coursework first, then advisor notes.",
    },
  });

  await prisma.dailyPlanItem.createMany({
    data: manualTasks.slice(0, 3).map((task, order) => ({
      dailyPlanId: todayPlan.id,
      taskId: task.id,
      order,
      isTopPriority: true,
      completed: order === 0,
      completedAt: order === 0 ? now : null,
    })),
  });

  await prisma.dailyBigRock.createMany({
    data: manualTasks.slice(0, 3).map((task, order) => ({
      dailyPlanId: todayPlan.id,
      taskId: task.id,
      order,
      completed: order === 0,
      completedAt: order === 0 ? now : null,
    })),
  });

  for (let offset = 1; offset <= 8; offset++) {
    const date = startOfDayTZ(subDays(today, offset));
    const task = await prisma.task.findFirst({
      where: { userId: user.id, status: "DONE", completedAt: { lte: endOfDay(date) } },
      orderBy: { completedAt: "desc" },
    });
    if (!task) continue;

    const plan = await prisma.dailyPlan.create({
      data: { userId: user.id, date, notes: offset % 2 === 0 ? "Plan was too wide; learned the obvious thing again." : null },
    });
    await prisma.dailyPlanItem.create({
      data: {
        dailyPlanId: plan.id,
        taskId: task.id,
        order: 0,
        isTopPriority: true,
        completed: true,
        completedAt: task.completedAt,
      },
    });
  }

  await prisma.journalEntry.createMany({
    data: [
      {
        userId: user.id,
        date: today,
        title: "Trying to make the system feel lighter",
        bestMoment: "A surprisingly good conversation after class about interpretability projects.",
        notableConversation: "Talked through internship prep anxiety and realized I need fewer open loops, not more ambition.",
        wins: "Finished one homework section and got DSA reps in.",
        struggles: "Brain kept switching between coursework, research, and job admin.",
        brainDump: "Need to email TA, decide whether to continue baseline experiment, and not forget charger.",
        gratitude: "Coffee, sunlight, and having one place to put the mess.",
      },
      {
        userId: user.id,
        date: subDays(today, 1),
        bestMoment: "Gym felt easier than expected.",
        wins: "Submitted lab timesheet. Did one ML prep block.",
        struggles: "Avoided the insurance task again.",
        brainDump: "Driving license can wait but should stay visible.",
      },
      {
        userId: user.id,
        date: subDays(today, 3),
        title: "Messy but salvageable",
        freeformText: "Too many fronts, but the research thread still feels meaningful. Need to keep reducing the number of active promises.",
      },
    ],
  });

  await prisma.healthLog.createMany({
    data: Array.from({ length: 10 }, (_, index) => {
      const date = startOfDayTZ(subDays(today, index));
      const didActivity = index % 3 !== 1;
      return {
        userId: user.id,
        date,
        smokedToday: false,
        drankAlcoholToday: index === 6,
        alcoholCount: index === 6 ? 2 : null,
        didPhysicalActivityToday: didActivity,
        activityType: didActivity ? randItem(["GYM", "WALKING", "RUN"] as ActivityType[]) : null,
        activityDurationMinutes: didActivity ? randInt(25, 80) : null,
        notes: index === 0 ? "Health is optional in V1 navigation, but still useful context." : null,
      };
    }),
  });

  await prisma.recurringCommitmentTemplate.createMany({
    data: [
      {
        userId: user.id,
        title: "Distributed systems lecture",
        type: "CLASS",
        daysOfWeek: [1, 3],
        startTime: "10:00",
        endTime: "11:15",
        startDate: subDays(weekStart, 28),
        affectsCapacity: true,
      },
      {
        userId: user.id,
        title: "Part-time lab shift",
        type: "WORK",
        daysOfWeek: [2, 4],
        startTime: "14:00",
        endTime: "18:00",
        startDate: subDays(weekStart, 28),
        affectsCapacity: true,
      },
    ],
  });

  const calendarConnection = await prisma.calendarConnection.create({
    data: {
      userId: user.id,
      provider: "GOOGLE",
      providerAccountId: "demo-google-calendar",
      accountEmail: "demo.calendar@gmail.com",
      displayName: "Demo optional calendar",
      lastSyncedAt: now,
    },
  });

  const externalCalendar = await prisma.externalCalendar.create({
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
  });

  await prisma.externalEvent.createMany({
    data: [
      {
        userId: user.id,
        calendarId: externalCalendar.id,
        providerEventId: "demo-class-1",
        title: "Optional synced class sample",
        startTime: dayAt(addDays(today, 1), 10),
        endTime: dayAt(addDays(today, 1), 11, 15),
        status: "confirmed",
        affectsCapacity: true,
        lastSyncedAt: now,
      },
      {
        userId: user.id,
        calendarId: externalCalendar.id,
        providerEventId: "demo-class-2",
        title: "Optional synced seminar sample",
        startTime: dayAt(addDays(today, 3), 16),
        endTime: dayAt(addDays(today, 3), 17, 15),
        status: "confirmed",
        affectsCapacity: true,
        lastSyncedAt: now,
      },
    ],
  });

  for (let offset = -7; offset <= 5; offset++) {
    const date = startOfDayTZ(addDays(today, offset));
    await prisma.timeBlock.create({
      data: {
        userId: user.id,
        taskId: manualTasks[2].id,
        title: "Deep work: alignment experiment",
        blockType: "DEEP_WORK",
        sourceType: "INTERNAL",
        date,
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        status: offset < 0 ? "COMPLETED" : "PLANNED",
      },
    });
  }

  const completedTasks = await prisma.task.findMany({
    where: { userId: user.id, status: "DONE", completedAt: { not: null } },
    take: 20,
  });

  for (const task of completedTasks) {
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: "TASK_COMPLETED",
        entityId: task.id,
        entityType: "Task",
        metadata: { title: task.title },
        createdAt: task.completedAt ?? now,
      },
    });
  }

  await prisma.activityEvent.createMany({
    data: [
      {
        userId: user.id,
        type: "FUTURE_PROMOTED",
        entityId: futureItems[4].id,
        entityType: "FutureItem",
        metadata: { title: futureItems[4].title },
        createdAt: subDays(now, 4),
      },
      {
        userId: user.id,
        type: "INBOX_CAPTURED",
        entityType: "InboxItem",
        metadata: { count: 5 },
        createdAt: now,
      },
      {
        userId: user.id,
        type: "CALENDAR_SYNCED",
        entityId: calendarConnection.id,
        entityType: "CalendarConnection",
        metadata: { title: "Demo optional calendar" },
        createdAt: now,
      },
    ],
  });

  console.log("Seed complete");
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${process.env.DEMO_USER_PASSWORD ?? "weekflow2024"}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
