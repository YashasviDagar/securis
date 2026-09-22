import { z } from "zod";
import { SOURCE_TYPES } from "@/types/security";

/**
 * Securis - Ingestion input validation (first line of defence)
 *
 * These schemas constrain the *shape* of incoming events. Deeper, semantic
 * validation (IP format, timestamp bounds, enum mapping) happens in
 * server/ingestion/validator.ts and normalizer.ts.
 *
 * Trust model: the ingestion endpoint is reachable by machines, so nothing is
 * assumed. Zod strips unknown keys by default, which prevents clients from
 * smuggling arbitrary fields into the database.
 */

/** Hard limits that protect the pipeline from oversized payloads. */
export const INGESTION_LIMITS = {
  /** Maximum events accepted in a single request. */
  maxBatchSize: 500,
  /** Maximum length of the human-readable message. */
  maxMessageLength: 2000,
  /** Maximum serialised size of the metadata object, in bytes. */
  maxMetadataBytes: 16 * 1024,
  /** Reject events dated further than this into the future (clock skew). */
  maxFutureSkewMs: 5 * 60 * 1000,
  /** Reject events older than this (retention / replay protection). */
  maxAgeMs: 5 * 365 * 24 * 60 * 60 * 1000,
} as const;

/**
 * A single raw event.
 *
 * `timestamp` and `severity` are deliberately permissive (string | number)
 * because real collectors emit both ISO strings and epoch numbers, and
 * severities as words or numbers. They are normalised afterwards.
 */
export const rawEventSchema = z.object({
  timestamp: z.union([z.string(), z.number()]).optional(),
  source: z.string().trim().min(1, "source is required.").max(128),
  sourceType: z.enum(SOURCE_TYPES, {
    message: "sourceType is not a supported source type.",
  }),
  eventType: z.string().trim().min(1).max(128).optional(),
  severity: z.union([z.string(), z.number()]).optional(),
  username: z.string().trim().max(256).nullish(),
  sourceIp: z.string().trim().max(64).nullish(),
  destinationIp: z.string().trim().max(64).nullish(),
  userAgent: z.string().trim().max(512).nullish(),
  resource: z.string().trim().max(512).nullish(),
  action: z.string().trim().max(64).nullish(),
  status: z.string().trim().max(64).nullish(),
  message: z
    .string()
    .trim()
    .max(INGESTION_LIMITS.maxMessageLength)
    .nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  raw: z.record(z.string(), z.unknown()).nullish(),
});

export type RawEvent = z.infer<typeof rawEventSchema>;

/**
 * Request body: either a single event or a batch of up to `maxBatchSize`.
 */
export const ingestPayloadSchema = z.union([
  rawEventSchema,
  z.array(rawEventSchema).min(1).max(INGESTION_LIMITS.maxBatchSize),
]);

/** Normalise a payload into an array of raw events. */
export function toRawEventArray(payload: RawEvent | RawEvent[]): RawEvent[] {
  return Array.isArray(payload) ? payload : [payload];
}
