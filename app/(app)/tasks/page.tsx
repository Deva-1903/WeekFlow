import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRecurringTasksForUser } from "@/lib/recurring-tasks";
import { generateRoutineTasksForUser } from "@/lib/routines";
import { TasksClient } from "@/components/tasks/tasks-client";

export default async function TasksPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  await generateRecurringTasksForUser(userId);
  await generateRoutineTasksForUser(userId);

  const tasks = await prisma.task.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return <TasksClient initialTasks={tasks} />;
}
