import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FutureClient } from "@/components/future/future-client";

export default async function FuturePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const items = await prisma.somedayItem.findMany({
    where: { userId },
    include: {
      generatedTask: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: [
      { isImportant: "desc" },
      { reviewDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  return <FutureClient initialItems={items} />;
}
