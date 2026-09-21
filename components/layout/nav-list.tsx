"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/security";

/**
 * Securis - SidebarNav
 *
 * Client component that renders the grouped navigation model. It is a client
 * component only because it needs `usePathname()` to highlight the active
 * route; it holds no business logic.
 *
 * Role filtering: when a `role` is supplied (Phase 3 onward) entries whose
 * `allowedRoles` do not include it are hidden. This is purely cosmetic - the
 * authoritative authorization check always happens server-side.
 *
 * Connection: rendered by components/layout/sidebar.tsx (desktop) and
 * components/layout/mobile-nav.tsx (mobile sheet).
 */
export function SidebarNav({
  role,
  onNavigate,
}: {
  role?: Role;
  /** Invoked after a link is clicked (used to close the mobile sheet). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5" aria-label="Primary">
      {NAV_GROUPS.map((group) => {
        // Hide entries the current role cannot access, and hide groups that
        // become empty as a result.
        const items = group.items.filter(
          (item) => !role || !item.allowedRoles || item.allowedRoles.includes(role),
        );
        if (items.length === 0) return null;

        return (
          <div key={group.label} className="space-y-1">
            <p className="px-2 text-[0.68rem] font-medium tracking-wider text-muted-foreground/70 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground/80",
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.title}</span>
                      {/* Left accent bar marks the active route. */}
                      {isActive ? (
                        <span className="ml-auto h-4 w-0.5 rounded-full bg-primary" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
