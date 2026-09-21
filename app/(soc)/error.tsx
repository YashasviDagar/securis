"use client";

import { ErrorState } from "@/components/shared/error-state";

/**
 * Securis - Console error boundary
 *
 * Catches rendering/data errors thrown by any route inside the (soc) group and
 * shows a safe, generic message. Next.js passes the `reset` callback which
 * re-renders the failed segment.
 *
 * Security note: `error.message` is deliberately NOT rendered. Detailed errors
 * (including database messages) are logged server-side and never leaked to the
 * browser (Phase 18).
 *
 * Connection: applies to every route under app/(soc)/**.
 */
export default function SocError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the real error for operators; the digest correlates it with server logs.
  console.error("[Securis] console route error:", error);

  return (
    <ErrorState
      title="Unable to load this module"
      description="The console encountered an unexpected error while loading this screen. The incident has been logged."
      onRetry={reset}
    />
  );
}
