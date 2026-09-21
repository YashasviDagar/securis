import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Incidents · Securis" };

/**
 * /incidents - Investigation and response workspace.
 *
 * Phase 10 replaces this scaffold with incident creation from alerts, the
 * incident lifecycle, assignment, notes and the related-event timeline.
 */
export default function IncidentsPage() {
  return <NavModulePage href="/incidents" />;
}
