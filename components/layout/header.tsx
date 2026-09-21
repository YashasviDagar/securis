"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { findNavItem } from "@/lib/navigation";
import type { Role } from "@/types/security";

/**
 * Securis - Header
 *
 * Top application bar. It shows the mobile navigation trigger and the title of
 * the current module (derived from the navigation model via `usePathname`).
 *
 * Authentication note: the real session-aware user menu is introduced in
 * Phase 3. Until then the header offers a genuine link to the `/login` route
 * rather than a non-functional account button.
 *
 * Connection: composed by app/(soc)/layout.tsx.
 */
export function Header({ role }: { role?: Role }) {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <MobileNav role={role} />

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">
          {current?.title ?? "Securis"}
        </span>
        {current ? (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            · {current.description}
          </span>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/login">
            <LogIn className="size-3.5" aria-hidden="true" />
            Sign in
          </Link>
        </Button>
      </div>
    </header>
  );
}
