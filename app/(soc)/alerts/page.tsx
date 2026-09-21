import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Alerts · Securis" };

/**
 * /alerts - Alerts raised by the detection engine.
 *
 * Phase 9 replaces this scaffold with the alert queue, filters, assignment,
 * status workflow, notes and the alert detail/timeline view.
 */
export default function AlertsPage() {
  return <NavModulePage href="/alerts" />;
}
