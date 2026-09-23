import type { Severity, SourceType } from "./security";

/**
 * Securis - Log ingestion types
 *
 * Defines the contract for the ingestion pipeline:
 *
 *   RawEventInput  -> (Zod) -> RawEvent -> (parser) -> ParsedEvent
 *                  -> (normalizer) -> NormalizedEvent -> (persist) -> SecurityEvent
 *
 * The pipeline never trusts the client: every field is validated, unknown keys
 * are stripped, and semantic checks (IP format, timestamp bounds, enum values)
 * run before anything is written to the database.
 *
 * Connection: used by server/ingestion/** and app/api/ingest/route.ts.
 */

/**
 * A raw event as accepted by the ingestion API. `sourceType` selects which
 * provider-specific fields the parser will look for, and `raw` carries the
 * original vendor payload when a collector forwards it verbatim.
 */
export interface RawEventInput {
  /** ISO-8601 string or epoch milliseconds/seconds. */
  timestamp?: string | number;
  /** Logical producer, e.g. "authentication-service". */
  source: string;
  /** Which class of system produced the event; drives parser selection. */
  sourceType: SourceType;
  /** Already-normalised event type, if the collector knows it. */
  eventType?: string;
  /** Severity as an enum string, a common word, or a 1-10 number. */
  severity?: string | number;
  username?: string | null;
  sourceIp?: string | null;
  destinationIp?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  /** Structured context (request ids, metrics, geolocation, ...). */
  metadata?: Record<string, unknown> | null;
  /** Provider-specific payload; parsed according to `sourceType`. */
  raw?: Record<string, unknown> | null;
}

/** Output of the parser: canonical fields merged with provider-specific data. */
export interface ParsedEvent {
  timestamp?: string | number;
  source: string;
  sourceType: SourceType;
  eventType?: string;
  severity?: string | number;
  username?: string | null;
  sourceIp?: string | null;
  destinationIp?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * A fully normalised event ready to be persisted as a `SecurityEvent`.
 * `timestamp` is a real Date and every enum is guaranteed valid.
 */
export interface NormalizedEvent {
  timestamp: Date;
  source: string;
  sourceType: SourceType;
  eventType: string;
  severity: Severity;
  username: string | null;
  sourceIp: string | null;
  destinationIp: string | null;
  userAgent: string | null;
  resource: string | null;
  action: string | null;
  status: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
}

/** A single rejected event and the reason it was rejected. */
export interface IngestionError {
  /** Zero-based index within the submitted batch. */
  index: number;
  /** Human-readable, safe-to-return reason. */
  message: string;
}

/** Who submitted the events. Recorded in the audit trail. */
export type IngestionActor =
  | { type: "api-key"; label: string }
  | { type: "user"; userId: string; email: string }
  | { type: "system" };

/** Summary returned by the ingestion pipeline. */
export interface IngestionResult {
  /** Number of events received in the request. */
  received: number;
  /** Number successfully normalised and persisted. */
  accepted: number;
  /** Number rejected by validation/normalisation. */
  rejected: number;
  /** Ids of the created SecurityEvent rows. */
  eventIds: string[];
  /** Details for each rejected event (capped for the response). */
  errors: IngestionError[];
  /**
   * Outcome of the detection run triggered by this ingestion (Phase 6).
   * Absent when no events were accepted.
   */
  detection?: {
    rulesEvaluated: number;
    findings: number;
    alertsCreated: number;
    alertsUpdated: number;
  };
}
