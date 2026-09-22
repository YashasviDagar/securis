import type { NextConfig } from "next";

/**
 * Securis - Next.js configuration
 *
 * This file configures the Next.js application. It is intentionally small in
 * Phase 1 and is expanded in Phase 18 (Security Hardening).
 *
 * `headers()` injects HTTP response headers for every route. These are part of
 * the "secure HTTP headers" requirement of the project. We keep a conservative
 * baseline here so the application is never served without basic protections,
 * then tighten Content-Security-Policy etc. during Phase 18.
 */

/** Baseline security headers applied to every response. */
const securityHeaders = [
  // Prevent the site from being embedded in an iframe (clickjacking defence).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing a response away from the declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak the full URL of the page to third parties in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict access to powerful browser features the SOC UI does not need.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Enforce HTTPS for two years once the app is served over TLS (no-op on http).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // React strict mode surfaces unsafe lifecycles and side effects during dev.
  reactStrictMode: true,
  // Hide the `X-Powered-By: Next.js` banner so we do not advertise the stack.
  poweredByHeader: false,
  // Emit a self-contained server bundle in .next/standalone so the production
  // Docker image does not need the full node_modules tree. This is enabled only
  // when NEXT_OUTPUT=standalone (set in the Dockerfile), because Next.js 16's
  // `next start` does not support the standalone output mode. Local production
  // checks therefore keep working with the normal `.next` output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [
      {
        // Apply the baseline headers to every path in the application.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
