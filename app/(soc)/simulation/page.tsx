import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Attack Simulation · Securis" };

/**
 * /simulation - Controlled attack simulation laboratory.
 *
 * Phase 14 replaces this scaffold with the buttons that generate *local* test
 * events (brute force, account takeover, ...) which flow through the real
 * ingestion and detection pipeline. It never targets external systems.
 */
export default function SimulationPage() {
  return <NavModulePage href="/simulation" />;
}
