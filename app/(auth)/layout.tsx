import type { ReactNode } from "react";

/**
 * Securis - Authentication layout
 *
 * Full-screen centered layout for unauthenticated screens (currently /login).
 * It renders a subtle grid backdrop to match the SOC aesthetic without adding
 * any non-functional UI.
 *
 * Connection: wraps app/(auth)/login/page.tsx.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      {/* Decorative background: radial glow + faint grid, purely presentational. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
