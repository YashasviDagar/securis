import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Detection Rules · Securis" };

/**
 * /detection-rules - Management of the rules the detection engine evaluates.
 *
 * Phase 12 replaces this scaffold with the rule list and the admin-only
 * create/edit/enable/disable/delete workflow backed by the database.
 */
export default function DetectionRulesPage() {
  return <NavModulePage href="/detection-rules" />;
}
