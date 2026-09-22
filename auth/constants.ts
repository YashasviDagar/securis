/**
 * Securis - Authentication constants
 *
 * Central configuration for the session subsystem. Values that operators may
 * tune come from the environment (see .env.example); everything else is a
 * compile-time constant.
 */

/**
 * Name of the HttpOnly session cookie. The name is deliberately generic so it
 * does not advertise the framework or the token format.
 */
export const SESSION_COOKIE_NAME = "securis_session";

/** Session lifetime in minutes, read from the environment at startup. */
export const SESSION_TTL_MINUTES = (() => {
  const raw = Number(process.env.SESSION_TTL_MINUTES ?? "480");
  return Number.isFinite(raw) && raw > 0 ? raw : 480;
})();

/** Absolute session lifetime in milliseconds. */
export const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60 * 1000;

/**
 * How often `lastSeenAt` is refreshed. Writing on every request would hammer
 * the database for no analytical benefit, so updates are throttled.
 */
export const SESSION_LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/** Length of the opaque session token in bytes before base64url encoding. */
export const SESSION_TOKEN_BYTES = 32;
