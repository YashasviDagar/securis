import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";
import { requirePermission } from "@/auth/current-user";

export const metadata: Metadata = { title: "Audit Logs · Securis" };

/**
 * /audit-logs - Immutable record of privileged actions.
 *
 * Server-side authorization: administrators only. Phase 15 replaces the
 * scaffold with the searchable/filterable audit trail.
 */
export default async function AuditLogsPage() {
  await requirePermission("audit:read");
  return <NavModulePage href="/audit-logs" />;
}
