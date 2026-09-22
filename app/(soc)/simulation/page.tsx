import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";
import { requirePermission } from "@/auth/current-user";

export const metadata: Metadata = { title: "Attack Simulation · Securis" };

/**
 * /simulation - Controlled attack simulation laboratory.
 *
 * Server-side authorization: administrators and security analysts only
 * (`simulation:run`); viewers cannot generate traffic.
 *
 * Phase 14 replaces the scaffold with the buttons that drive the real ingestion
 * and detection pipeline against local test data.
 */
export default async function SimulationPage() {
  await requirePermission("simulation:run");
  return <NavModulePage href="/simulation" />;
}
