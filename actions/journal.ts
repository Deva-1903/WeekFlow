"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/server-auth";
import { parseLocalDate, todayTZ } from "@/lib/timezone";

const journalSchema = z.object({
  date: z.string().optional(),
  title: z.string().optional(),
  bestMoment: z.string().optional(),
  notableConversation: z.string().optional(),
  wins: z.string().optional(),
  struggles: z.string().optional(),
  brainDump: z.string().optional(),
  gratitude: z.string().optional(),
  freeformText: z.string().optional(),
});

export async function saveJournalEntry(data: z.input<typeof journalSchema>) {
  const userId = await requireUserId();
  const parsed = journalSchema.parse(data);
  const date = parsed.date ? parseLocalDate(parsed.date) : todayTZ();

  const entry = await prisma.journalEntry.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      title: parsed.title,
      bestMoment: parsed.bestMoment,
      notableConversation: parsed.notableConversation,
      wins: parsed.wins,
      struggles: parsed.struggles,
      brainDump: parsed.brainDump,
      gratitude: parsed.gratitude,
      freeformText: parsed.freeformText,
    },
    update: {
      title: parsed.title,
      bestMoment: parsed.bestMoment,
      notableConversation: parsed.notableConversation,
      wins: parsed.wins,
      struggles: parsed.struggles,
      brainDump: parsed.brainDump,
      gratitude: parsed.gratitude,
      freeformText: parsed.freeformText,
    },
  });

  await prisma.activityEvent.create({
    data: {
      userId,
      type: "JOURNAL_SAVED",
      entityId: entry.id,
      entityType: "JournalEntry",
      metadata: { date: entry.date.toISOString() },
    },
  });

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { success: true, entry };
}

