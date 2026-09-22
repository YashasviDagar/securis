/**
 * Securis - In-memory sliding-window rate limiter
 *
 * Protects authentication and API endpoints from brute force and abuse.
 *
 * Implementation notes and trade-offs:
 *   - State lives in a module-level Map, so limits are per server process. This
 *     is adequate for the single-instance development/demo deployment. For a
 *     horizontally scaled production deployment the same interface should be
 *     backed by Redis (the call sites would not change).
 *   - A sliding window is used: only timestamps inside the window count, so a
 *     burst cannot be hidden across a fixed-window boundary.
 *   - The Map is periodically swept to avoid unbounded growth from one-off
 *     client keys.
 *
 * Connection: used by server/services/auth-service.ts and (Phase 18) a generic
 * API rate-limit wrapper.
 */

interface Bucket {
  /** Timestamps (ms) of the attempts currently inside the window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Drop buckets whose most recent hit is older than the sweep threshold. */
function sweep(now: number, windowMs: number) {
  // Sweep at most once per window to keep this cheap.
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const newest = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - newest > windowMs) buckets.delete(key);
  }
}

let lastSweep = 0;

export interface RateLimitResult {
  /** True when the attempt is permitted. */
  allowed: boolean;
  /** Attempts remaining in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
  /** Total limit for the window. */
  limit: number;
}

/**
 * Record an attempt against `key` and report whether it is allowed.
 *
 * @param key           Unique bucket key, e.g. `login:ip:1.2.3.4`.
 * @param limit         Maximum attempts permitted within the window.
 * @param windowSeconds Window length in seconds.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  // Keep only attempts inside the current window.
  bucket.hits = bucket.hits.filter((ts) => now - ts < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterMs = windowMs - (now - oldest);
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
    limit,
  };
}

/**
 * Inspect a bucket without recording an attempt. Useful for pre-flight checks.
 */
export function peekRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = buckets.get(key);
  const hits = bucket ? bucket.hits.filter((ts) => now - ts < windowMs) : [];
  const remaining = Math.max(0, limit - hits.length);
  const oldest = hits[0] ?? now;
  return {
    allowed: hits.length < limit,
    remaining,
    retryAfterSeconds:
      hits.length < limit ? 0 : Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    limit,
  };
}

/** Clear a bucket (called after a successful login so failures don't linger). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test/maintenance helper: clear all limiter state. */
export function resetAllRateLimits(): void {
  buckets.clear();
}
