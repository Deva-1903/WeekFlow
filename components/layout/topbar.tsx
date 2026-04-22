"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTZ } from "@/lib/timezone";

interface TopbarProps {
  userName?: string | null;
}

export function Topbar({ userName }: TopbarProps) {
  return (
    <header className="fixed top-0 left-56 right-0 h-14 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-sm z-30 flex items-center justify-between px-6">
      <div className="text-sm text-[var(--muted-foreground)]">
        {formatTZ(new Date(), "EEEE, MMMM d, yyyy")}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {userName ?? "User"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-[var(--muted-foreground)] gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
