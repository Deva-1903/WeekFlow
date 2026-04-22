import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FutureClient } from "@/components/future/future-client";

export default async function FuturePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const items = await prisma.futureItem.findMany({
    where: { userId },
    include: {
      promotedTask: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: [
      { reviewDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  return <FutureClient initialItems={items} />;
}
