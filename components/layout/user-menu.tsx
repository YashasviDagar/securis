"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldHalf, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/types/auth";

/**
 * Securis - User menu
 *
 * Shows the signed-in identity and provides a working sign-out action that
 * revokes the session server-side (POST /api/auth/logout) before returning to
 * the login screen.
 *
 * Connection: app/api/auth/logout -> server/services/auth-service.ts.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Always return to the login screen, even if the network call failed.
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
            <UserRound className="size-3.5" aria-hidden="true" />
          </span>
          <span className="hidden text-xs font-medium sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[0.68rem] tracking-wide text-primary uppercase">
            <ShieldHalf className="size-3" aria-hidden="true" />
            {user.role.replace("_", " ")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
