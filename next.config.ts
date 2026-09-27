import type { NextConfig } from "next";

/**
 * Securis - Next.js configuration
 *
 * Security headers are applied to every response. Phase 18 hardened these with
 * a Content-Security-Policy and several cross-origin isolation headers.
 *
 * CSP note: Next.js injects small inline bootstrap scripts for hydration, so
 * `script-src` must allow `'unsafe-inline'` unless a nonce is threaded through
 * the framework. A nonce-based policy (removing `'unsafe-inline'`) is the
 * documented next step; everything else is locked to `'self'`.
 */

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 * `'unsafe-eval'` is added in development only (React Fast Refresh needs it).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

/** Baseline security headers applied to every response. */
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Clickjacking: the console must never be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()",
  },
  // Enforce HTTPS for two years once served over TLS (no-op on http).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Do not leak the origin to other origins via the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Resources may only be loaded by same-origin documents.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Disable legacy cross-domain policy files.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Never advertise the framework.
  poweredByHeader: false,
  // Standalone output only when building for Docker (see Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
