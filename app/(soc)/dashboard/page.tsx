import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Dashboard · Securis" };

/**
 * /dashboard - Security operations overview.
 *
 * Phase 13 replaces this scaffold with real, database-backed metrics and charts
 * (events over time, severity breakdown, top source IPs, recent alerts, ...).
 */
export default function DashboardPage() {
  return <NavModulePage href="/dashboard" />;
}
