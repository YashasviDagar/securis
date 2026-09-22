import { parseEvent } from "./parser";
import { normalizeEvent, NormalizationError } from "./normalizer";
import { validateEvent } from "./validator";
import { createEvents } from "@/server/services/event-service";
import { recordAudit } from "@/server/services/audit-service";
import type { RawEvent } from "@/lib/validation/ingestion";
import type {
  IngestionActor,
  IngestionError,
  IngestionResult,
  NormalizedEvent,
} from "@/types/ingestion";

/**
 * Securis - Ingestion pipeline
 *
 * Orchestrates the full flow for a batch of events:
 *
 *   raw -> parse (source-specific) -> normalise -> validate -> persist
 *
 * Per-event failures do not fail the batch: each rejected event is reported by
 * index so a collector can retry only what was rejected. A single audit entry
 * is written per request to avoid flooding the audit trail with one row per
 * event.
 *
 * Extension point: Phase 6 invokes the detection engine immediately after
 * persistence (see the marker at the end of `ingestEvents`).
 *
 * Connection: parser -> normalizer -> validator -> event-service -> audit.
 */

/** How many per-event errors are echoed back in the API response. */
const MAX_REPORTED_ERRORS = 50;

/** Optional request context recorded in the audit trail. */
export interface IngestionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Ingest a batch of raw events.
 * @param rawEvents Validated raw events (see lib/validation/ingestion.ts).
 * @param actor     Who is submitting (API key, authenticated user or system).
 * @param context   Request metadata for the audit trail.
 */
export async function ingestEvents(
  rawEvents: RawEvent[],
  actor: IngestionActor = { type: "system" },
  context: IngestionContext = {},
): Promise<IngestionResult> {
  const accepted: NormalizedEvent[] = [];
  const errors: IngestionError[] = [];

  rawEvents.forEach((raw, index) => {
    try {
      const parsed = parseEvent(raw);
      const normalized = normalizeEvent(parsed);
      const issues = validateEvent(parsed, normalized);

      if (issues.length > 0) {
        errors.push({ index, message: issues.join(" ") });
        return;
      }

      accepted.push(normalized);
    } catch (error) {
      // NormalizationError messages are safe to return; anything else is not.
      const message =
        error instanceof NormalizationError
          ? error.message
          : "Event could not be processed.";
      errors.push({ index, message });
    }
  });

  const eventIds = await createEvents(accepted);

  // One audit entry per ingestion request, with a summary of the outcome.
  await recordAudit({
    actorId: actor.type === "user" ? actor.userId : null,
    actorEmail:
      actor.type === "user"
        ? actor.email
        : actor.type === "api-key"
          ? actor.label
          : "system",
    action: "EVENT_INGESTED",
    targetType: "SecurityEvent",
    targetLabel: accepted[0]?.source ?? null,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
    metadata: {
      received: rawEvents.length,
      accepted: accepted.length,
      rejected: errors.length,
      sourceTypes: [...new Set(accepted.map((event) => event.sourceType))],
    },
  });

  // --- Phase 6 extension point ---------------------------------------------
  // The detection engine will be invoked here with the newly created event ids
  // so detections run synchronously with ingestion.
  // -------------------------------------------------------------------------

  return {
    received: rawEvents.length,
    accepted: accepted.length,
    rejected: errors.length,
    eventIds,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
  };
}
