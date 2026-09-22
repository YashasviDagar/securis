import { INGESTION_LIMITS } from "@/lib/validation/ingestion";
import type { NormalizedEvent, ParsedEvent } from "@/types/ingestion";

/**
 * Securis - Ingestion semantic validator
 *
 * Zod already guaranteed the *shape* of the payload. This module performs the
 * checks that need context: timestamp plausibility, metadata size, and whether
 * an IP that was supplied actually parsed as an IP.
 *
 * Returning a list of issues (rather than throwing on the first) lets the
 * pipeline report everything wrong with a single event.
 *
 * Connection: server/ingestion/pipeline.ts.
 */

/**
 * Validate a normalised event.
 * @param parsed     The pre-normalisation event (used to detect dropped fields).
 * @param normalized The normalised event about to be persisted.
 * @returns A list of human-readable problems; empty when the event is valid.
 */
export function validateEvent(
  parsed: ParsedEvent,
  normalized: NormalizedEvent,
): string[] {
  const issues: string[] = [];
  const now = Date.now();
  const ts = normalized.timestamp.getTime();

  // --- Timestamp plausibility ----------------------------------------------
  if (ts > now + INGESTION_LIMITS.maxFutureSkewMs) {
    issues.push("timestamp is too far in the future.");
  }
  if (ts < now - INGESTION_LIMITS.maxAgeMs) {
    issues.push("timestamp is older than the accepted retention window.");
  }

  // --- Field lengths --------------------------------------------------------
  if (normalized.message.length > INGESTION_LIMITS.maxMessageLength) {
    issues.push("message exceeds the maximum length.");
  }
  if (normalized.source.length > 128) {
    issues.push("source exceeds the maximum length.");
  }

  // --- Metadata size --------------------------------------------------------
  if (normalized.metadata) {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(normalized.metadata), "utf8");
      if (bytes > INGESTION_LIMITS.maxMetadataBytes) {
        issues.push("metadata exceeds the maximum allowed size.");
      }
    } catch {
      // A non-serialisable metadata object (e.g. circular) must be rejected.
      issues.push("metadata is not serialisable.");
    }
  }

  // --- Dropped IPs ----------------------------------------------------------
  // If a collector supplied an IP but normalisation produced null, the value was
  // not a valid address. Silently dropping it would corrupt investigations, so
  // the event is rejected instead.
  if (parsed.sourceIp && !normalized.sourceIp) {
    issues.push("sourceIp is not a valid IP address.");
  }
  if (parsed.destinationIp && !normalized.destinationIp) {
    issues.push("destinationIp is not a valid IP address.");
  }

  return issues;
}
