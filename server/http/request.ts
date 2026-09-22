import { NextResponse } from "next/server";

/**
 * Securis - HTTP request helpers
 *
 * Small, dependency-free utilities shared by every route handler: client IP
 * extraction, same-origin enforcement (a lightweight CSRF control) and safe
 * JSON responses.
 *
 * Security note: error responses never include stack traces, database messages
 * or internal identifiers. Internal details are logged server-side instead.
 */

/**
 * Best-effort client IP.
 *
 * Trust order: `x-forwarded-for` (first hop) then `x-real-ip`. Behind a trusted
 * proxy these headers are set by the proxy; when the app is exposed directly
 * they are attacker-controlled, so the value is treated as *untrusted input*
 * everywhere it is used (rate-limit keys, audit metadata) and is never used for
 * an authorization decision.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** The caller's User-Agent, truncated to a sane length for storage. */
export function getUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  return ua ? ua.slice(0, 512) : null;
}

/**
 * Lightweight CSRF defence: verify that a mutating request originates from our
 * own origin. Combined with the `SameSite=Lax` session cookie this blocks
 * cross-site form posts. A full double-submit token is added in Phase 18.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Same-origin fetch/XHR always sends Origin for non-GET requests.
  if (!origin) {
    // No Origin header: allow only if there is also no Referer (e.g. same-origin
    // navigations in some browsers), otherwise reject.
    return !request.headers.get("referer");
  }
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/** A successful JSON response. */
export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

/**
 * A safe error JSON response. `message` must already be user-appropriate; never
 * pass raw exception messages here.
 */
export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Convert an unknown thrown value into a loggable string without leaking it. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
