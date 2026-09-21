import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Threat Intelligence · Securis" };

/**
 * /threat-intelligence - Local indicator database (IPs, domains, hashes, URLs).
 *
 * Phase 11 replaces this scaffold with indicator search and the service layer
 * that lets detections raise risk when an event matches a known indicator.
 */
export default function ThreatIntelligencePage() {
  return <NavModulePage href="/threat-intelligence" />;
}
