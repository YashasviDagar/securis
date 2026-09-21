import { redirect } from "next/navigation";

/**
 * Securis - Root route
 *
 * The application has no marketing landing page: it is an operational tool, so
 * the root route simply sends the operator to the SOC dashboard.
 *
 * Phase 3 note: once authentication exists this redirect will be mediated by
 * the session guard in app/(soc)/layout.tsx, which sends unauthenticated users
 * to /login instead.
 */
export default function RootPage() {
  redirect("/dashboard");
}
