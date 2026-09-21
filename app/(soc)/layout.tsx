import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Securis - SOC application shell
 *
 * Route group layout for every authenticated security-operations screen
 * (dashboard, events, alerts, incidents, detection rules, threat intelligence,
 * users, audit logs, settings, simulation, search).
 *
 * It composes the persistent chrome:
 *   - `Sidebar`  : desktop navigation (hidden below the `lg` breakpoint)
 *   - `Header`   : sticky top bar with the mobile navigation sheet
 *   - `<main>`   : the routed page content
 *
 * Phase 3 note: this is where the server-side session guard will live. The
 * layout will fetch the authenticated session and redirect unauthenticated
 * users to `/login`, passing the resolved `Role` down to the navigation.
 *
 * Connection: parent is app/layout.tsx; children are the pages under app/(soc)/.
 */
export default function SocLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
