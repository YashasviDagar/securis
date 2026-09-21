import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Global Search · Securis" };

/**
 * /search - Cross-entity security search.
 *
 * Phase 17 replaces this scaffold with search across events, alerts, incidents,
 * threat indicators and users, including filters and pagination.
 */
export default function SearchPage() {
  return <NavModulePage href="/search" />;
}
