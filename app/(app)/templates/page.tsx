import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "@/components/templates/templates-client";

export default async function TemplatesPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [recurringCommitments, recurringTaskTemplates] = await Promise.all([
    prisma.recurringCommitmentTemplate.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurringTaskTemplate.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <TemplatesClient
      recurringCommitments={recurringCommitments}
      recurringTaskTemplates={recurringTaskTemplates}
    />
  );
}
