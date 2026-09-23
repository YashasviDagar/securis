/**
 * Securis - Error helpers
 *
 * A dependency-free place for error utilities so that non-Next contexts (the
 * database seed, scripts, tests) can use them without pulling in `next/server`.
 *
 * Connection: server/http/request.ts re-exports `describeError` for HTTP code;
 * server/detection/engine.ts imports it directly.
 */

/**
 * Convert an unknown thrown value into a loggable string.
 * Never returns the value's contents beyond a safe message, and never throws.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
