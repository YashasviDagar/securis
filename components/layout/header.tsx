"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { findNavItem } from "@/lib/navigation";
import type { SessionUser } from "@/types/auth";

/**
 * Securis - Header
 *
 * Top application bar. It shows the mobile navigation trigger, the title of the
 * current module (derived from the navigation model) and the authenticated
 * user's menu with a working sign-out action.
 *
 * The `user` prop is supplied by the guarded server layout, which has already
 * validated the session - this component never fetches or trusts auth state on
 * its own.
 *
 * Connection: app/(soc)/layout.tsx -> components/layout/user-menu.tsx.
 */
export function Header({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <MobileNav role={user.role} />

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
        <UserMenu user={user} />
      </div>
    </header>
  );
}
