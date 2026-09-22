import { isIP } from "node:net";
import { SEVERITIES, type Severity } from "@/types/security";
import type { NormalizedEvent, ParsedEvent } from "@/types/ingestion";

/**
 * Securis - Ingestion normaliser
 *
 * Converts a parsed event into the canonical `NormalizedEvent` shape: real
 * `Date` timestamps, validated enum values and cleaned strings. Normalisation
 * is *deterministic* - the same input always yields the same output - which is
 * essential for reproducible detections and tests.
 *
 * Throws `NormalizationError` with a safe, user-facing message when a field
 * cannot be normalised (e.g. an unparseable timestamp). The pipeline converts
 * that into a per-event rejection rather than failing the whole batch.
 *
 * Connection: server/ingestion/pipeline.ts.
 */

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}

/**
 * Words that map onto the canonical severity scale. This lets collectors send
 * syslog-style levels ("warn", "err") or SIEM-style levels ("critical")
 * without the platform rejecting them.
 */
const SEVERITY_WORDS: Record<string, Severity> = {
  info: "INFO",
  informational: "INFO",
  notice: "INFO",
  debug: "INFO",
  trace: "INFO",
  low: "LOW",
  minor: "LOW",
  medium: "MEDIUM",
  med: "MEDIUM",
  moderate: "MEDIUM",
  warn: "MEDIUM",
  warning: "MEDIUM",
  high: "HIGH",
  major: "HIGH",
  error: "HIGH",
  err: "HIGH",
  critical: "CRITICAL",
  crit: "CRITICAL",
  fatal: "CRITICAL",
  severe: "CRITICAL",
  emergency: "CRITICAL",
  alert: "CRITICAL",
};

/** Map a 1-10 numeric level onto the severity scale (see SEVERITY_WEIGHTS). */
function severityFromNumber(value: number): Severity {
  if (value <= 1) return "INFO";
  if (value <= 3) return "LOW";
  if (value <= 6) return "MEDIUM";
  if (value <= 8) return "HIGH";
  return "CRITICAL";
}

/**
 * Deterministic fallback severity derived from the event type when the producer
 * supplies none. Kept deliberately small and documented so it can be reasoned
 * about: failure-like events default to MEDIUM, everything else to INFO.
 */
function defaultSeverityForEventType(eventType: string): Severity {
  if (/(CRITICAL|BREACH|COMPROMISE)/.test(eventType)) return "CRITICAL";
  if (/(FAIL|FAILED|DENIED|DENY|ERROR|UNAUTHORIZED|FORBIDDEN)/.test(eventType)) {
    return "MEDIUM";
  }
  return "INFO";
}

/** Normalise any accepted severity representation into the canonical enum. */
export function normalizeSeverity(
  value: string | number | undefined,
  eventType: string,
): Severity {
  if (value === undefined || value === null || value === "") {
    return defaultSeverityForEventType(eventType);
  }

  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    return severityFromNumber(Number(value));
  }

  const text = String(value).trim().toLowerCase();
  // Exact enum match first (e.g. "HIGH").
  const upper = text.toUpperCase();
  if ((SEVERITIES as readonly string[]).includes(upper)) {
    return upper as Severity;
  }
  const mapped = SEVERITY_WORDS[text];
  if (mapped) return mapped;

  // Unknown severity words fall back rather than rejecting the event.
  return defaultSeverityForEventType(eventType);
}

/**
 * Normalise an event type to UPPER_SNAKE_CASE so equivalent types from
 * different collectors collapse onto the same value (e.g. "login-failed" and
 * "Login Failed" both become "LOGIN_FAILED").
 */
export function normalizeEventType(value: string | undefined, sourceType: string): string {
  const base = (value ?? `${sourceType}_EVENT`)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 128);
  return base.length ? base : "UNKNOWN_EVENT";
}

/**
 * Parse a timestamp from ISO string, epoch milliseconds or epoch seconds.
 * Missing timestamps default to "now" (the moment of ingestion).
 */
export function normalizeTimestamp(value: string | number | undefined): Date {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }

  if (typeof value === "number") {
    // Values below 1e12 are almost certainly epoch seconds, not milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      throw new NormalizationError("timestamp is not a valid epoch value.");
    }
    return date;
  }

  // Numeric strings are treated as epoch values.
  if (/^\d+$/.test(value.trim())) {
    return normalizeTimestamp(Number(value.trim()));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new NormalizationError("timestamp is not a valid date.");
  }
  return date;
}

/** Validate an IP address (v4 or v6). Returns null when absent/invalid. */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isIP(trimmed) ? trimmed : null;
}

/** Trim and lowercase a username; returns null when absent. */
function normalizeUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed.slice(0, 256) : null;
}

/** Uppercase and trim a status/action token; returns null when absent. */
function normalizeToken(value: string | null | undefined, max = 64): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toUpperCase().slice(0, max) : null;
}

/** Trim an optional free-text field. */
function normalizeText(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, max) : null;
}

/**
 * Normalise a parsed event into a persistable `NormalizedEvent`.
 * @throws NormalizationError when a field cannot be normalised.
 */
export function normalizeEvent(parsed: ParsedEvent): NormalizedEvent {
  const timestamp = normalizeTimestamp(parsed.timestamp);
  const eventType = normalizeEventType(parsed.eventType, parsed.sourceType);

  const source = parsed.source.trim();
  if (!source) {
    throw new NormalizationError("source is required.");
  }

  // A message is mandatory in the schema; synthesise one from the event type
  // when a collector omits it so analysts always see something meaningful.
  const message =
    normalizeText(parsed.message, 2000) ?? `Event ${eventType} received from ${source}`;

  return {
    timestamp,
    source: source.slice(0, 128),
    sourceType: parsed.sourceType,
    eventType,
    severity: normalizeSeverity(parsed.severity, eventType),
    username: normalizeUsername(parsed.username),
    sourceIp: normalizeIp(parsed.sourceIp),
    destinationIp: normalizeIp(parsed.destinationIp),
    userAgent: normalizeText(parsed.userAgent, 512),
    resource: normalizeText(parsed.resource, 512),
    action: normalizeToken(parsed.action),
    status: normalizeToken(parsed.status),
    message,
    metadata: parsed.metadata ?? null,
  };
}
