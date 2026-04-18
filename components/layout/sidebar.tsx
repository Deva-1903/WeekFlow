"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Calendar,
  BarChart3,
  Heart,
  Settings,
  ClipboardList,
  Zap,
  Sparkles,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/weekly-review", label: "Weekly Review", icon: CalendarDays },
  { href: "/daily-planner", label: "Daily Planner", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/future", label: "Future", icon: Sparkles },
  { href: "/templates", label: "Templates", icon: Repeat },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/health", label: "Health Log", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-[var(--border)] bg-[var(--card)] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--primary)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight text-[var(--foreground)]">WeekFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted-foreground)]">Personal Execution OS</p>
      </div>
    </aside>
  );
}
