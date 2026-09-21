import type { Metadata } from "next";
import { NavModulePage } from "@/components/shared/nav-module-page";

export const metadata: Metadata = { title: "Settings · Securis" };

/**
 * /settings - Platform and personal configuration.
 *
 * Phase 18 replaces this scaffold with the hardened configuration surface
 * (password policy, session controls, security headers status, ...).
 */
export default function SettingsPage() {
  return <NavModulePage href="/settings" />;
}
