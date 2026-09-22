import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";
import { requirePermission } from "@/auth/current-user";

export const metadata: Metadata = { title: "Detection Rules · Securis" };

/**
 * /detection-rules - Management of the rules the detection engine evaluates.
 *
 * Server-side authorization: rule management is administrator-only
 * (`rules:write`). Analysts may still see which rule produced an alert through
 * the alert detail view.
 *
 * Phase 12 replaces the scaffold with the CRUD workflow backed by the database.
 */
export default async function DetectionRulesPage() {
  await requirePermission("rules:write");
  return <NavModulePage href="/detection-rules" />;
}
