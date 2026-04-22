import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JournalClient } from "@/components/journal/journal-client";
import { todayTZ, toLocalDateKey } from "@/lib/timezone";

export default async function JournalPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const today = todayTZ();

  const [todayEntry, history] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
    prisma.journalEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ]);

  return (
    <JournalClient
      todayKey={toLocalDateKey(today)}
      initialEntry={todayEntry}
      history={history}
    />
  );
}
