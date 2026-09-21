import Link from "next/link";
import { ShieldHalf } from "lucide-react";
import { SidebarNav } from "@/components/layout/nav-list";
import type { Role } from "@/types/security";

/**
 * Securis - Brand mark
 *
 * Reusable logo/brand block. Shared by the desktop sidebar and the mobile
 * navigation sheet so the identity is consistent everywhere.
 *
 * Connection: components/layout/sidebar.tsx, components/layout/mobile-nav.tsx.
 */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
        <ShieldHalf className="size-4.5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Securis
        </span>
        <span className="mt-0.5 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          Security Operations
        </span>
      </span>
    </Link>
  );
}

/**
 * Securis - Sidebar
 *
 * Persistent left navigation for desktop viewports (hidden below `lg`). It is a
 * server component: all interactivity lives in the client `SidebarNav`.
 *
 * Connection: composed by app/(soc)/layout.tsx.
 */
export function Sidebar({ role }: { role?: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-3">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <SidebarNav role={role} />
      </div>
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[0.68rem] text-muted-foreground/70">
          v0.1.0 · Phase 1 foundation
        </p>
      </div>
    </aside>
  );
}
