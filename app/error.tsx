"use client";

import { ErrorState } from "@/components/shared/error-state";

/**
 * Securis - Global error boundary
 *
 * Last-resort boundary for errors thrown outside the (soc) group (for example
 * during login rendering). It never exposes internal error details to the user.
 *
 * Connection: wraps the entire app, including app/(soc)/** and app/(auth)/**.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[Securis] application error:", error);

  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background p-6 text-foreground">
        <ErrorState
          title="Application error"
          description="Securis hit an unexpected error. The incident has been logged."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
