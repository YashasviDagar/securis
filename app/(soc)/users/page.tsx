import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Users · Securis" };

/**
 * /users - Administrator-only user management.
 *
 * Phase 16 replaces this scaffold with user creation, role changes, account
 * disabling, login history and per-user activity. Every action is audit-logged
 * and authorized server-side.
 */
export default function UsersPage() {
  return <NavModulePage href="/users" />;
}
