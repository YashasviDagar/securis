import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Audit Logs · Securis" };

/**
 * /audit-logs - Immutable record of privileged actions.
 *
 * Phase 15 replaces this scaffold with the searchable/filterable audit trail
 * (actor, action, target, timestamp, IP, metadata).
 */
export default function AuditLogsPage() {
  return <NavModulePage href="/audit-logs" />;
}
