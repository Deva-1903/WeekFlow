import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-56 overflow-hidden">
        <Topbar userName={session.user?.name} />
        <main className="flex-1 overflow-y-auto pt-14 bg-background">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
