import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import type { NormalizedEvent } from "@/types/ingestion";

/**
 * Securis - Event service
 *
 * Owns persistence and querying of `SecurityEvent` rows. Business logic lives
 * in the ingestion/detection layers; this service is the only place that talks
 * to the event table, so indexes and query shapes stay in one file.
 *
 * Connection: database/client.ts (Prisma) -> SecurityEvent table.
 */

/** Convert a normalised event into a Prisma create input. */
function toCreateInput(event: NormalizedEvent): Prisma.SecurityEventCreateManyInput {
  return {
    timestamp: event.timestamp,
    source: event.source,
    sourceType: event.sourceType,
    eventType: event.eventType,
    severity: event.severity,
    username: event.username,
    sourceIp: event.sourceIp,
    destinationIp: event.destinationIp,
    userAgent: event.userAgent,
    resource: event.resource,
    action: event.action,
    status: event.status,
    message: event.message,
    metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Persist a batch of normalised events and return their ids.
 *
 * `createManyAndReturn` performs a single INSERT ... RETURNING, which keeps the
 * ingestion path efficient and gives the caller the ids needed for the
 * response and downstream detection.
 */
export async function createEvents(events: NormalizedEvent[]): Promise<string[]> {
  if (events.length === 0) return [];

  const created = await prisma.securityEvent.createManyAndReturn({
    data: events.map(toCreateInput),
    select: { id: true },
  });

  return created.map((row) => row.id);
}

/** Count events, optionally since a given time (used by dashboards/health). */
export async function countEvents(since?: Date): Promise<number> {
  return prisma.securityEvent.count({
    where: since ? { timestamp: { gte: since } } : undefined,
  });
}
