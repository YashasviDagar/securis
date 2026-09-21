import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Events · Securis" };

/**
 * /events - Normalised security event explorer.
 *
 * Phase 5 replaces this scaffold with the server-side paginated, searchable and
 * filterable event table plus the event detail view.
 */
export default function EventsPage() {
  return <NavModulePage href="/events" />;
}
