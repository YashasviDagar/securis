import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";
import { requirePermission } from "@/auth/current-user";

export const metadata: Metadata = { title: "Users · Securis" };

/**
 * /users - Administrator-only user management.
 *
 * Server-side authorization: `requirePermission("users:read")` redirects
 * unauthenticated users to /login and non-admins to the dashboard. This check
 * is authoritative and independent of whether the sidebar link is visible.
 *
 * Phase 16 replaces the scaffold with user creation, role changes, disabling,
 * login history and per-user activity.
 */
export default async function UsersPage() {
  await requirePermission("users:read");
  return <NavModulePage href="/users" />;
}
