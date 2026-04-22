import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InboxClient } from "@/components/inbox/inbox-client";

export default async function InboxPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const items = await prisma.inboxItem.findMany({
    where: { userId },
    orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
    take: 80,
  });

  return <InboxClient initialItems={items} />;
}
