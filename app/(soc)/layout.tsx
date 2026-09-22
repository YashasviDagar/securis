import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { findNavItem } from "@/lib/navigation";

/**
 * Securis - SOC application shell (authenticated + authorized)
 *
 * Route group layout for every security-operations screen. It performs two
 * authoritative, server-side checks before any page renders:
 *
 *   1. Authentication - no valid session redirects to /login.
 *   2. Authorization  - the current route's `requiredPermission` (declared in
 *      lib/navigation.ts) must be held by the user's role; otherwise the user
 *      is redirected to the dashboard with a `denied` marker.
 *
 * Doing the permission check here (rather than only inside pages) is important:
 * the layout resolves before the response begins streaming, so a denial is a
 * real HTTP 307 rather than a streamed client-side redirect. Pages keep their
 * own `requirePermission` calls as defence in depth.
 *
 * The request path is provided by middleware.ts through the `x-pathname`
 * header, because layouts do not receive the pathname directly.
 *
 * Connection: middleware.ts (x-pathname) -> auth/current-user.ts (session) ->
 * auth/rbac.ts (permissions) -> lib/navigation.ts (route requirements).
 */
export default async function SocLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();

  // 1. Authentication: no session (or expired/revoked) -> sign in.
  if (!session) {
    redirect("/login");
  }

  // 2. Authorization: enforce the current route's required capability.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const navItem = findNavItem(pathname);

  if (
    navItem?.requiredPermission &&
    !hasPermission(session.user.role, navItem.requiredPermission)
  ) {
    redirect(`/dashboard?denied=${encodeURIComponent(navItem.requiredPermission)}`);
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={session.user} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
