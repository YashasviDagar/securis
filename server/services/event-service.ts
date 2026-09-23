import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import type { NormalizedEvent } from "@/types/ingestion";
import type {
  EventDetail,
  EventFacets,
  EventListItem,
  EventQuery,
  Paginated,
} from "@/types/events";

/**
 * Securis - Event service
 *
 * Owns persistence and querying of `SecurityEvent` rows. Business logic lives
 * in the ingestion/detection layers; this service is the only place that talks
 * to the event table, so indexes and query shapes stay in one file.
 *
 * Every list query is server-side paginated and filtered - the browser never
 * receives more rows than `pageSize`.
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

// -----------------------------------------------------------------------------
// Event explorer queries (Phase 5)
// -----------------------------------------------------------------------------

/** The projection used for table rows - deliberately small for performance. */
const LIST_SELECT = {
  id: true,
  timestamp: true,
  source: true,
  sourceType: true,
  eventType: true,
  severity: true,
  username: true,
  sourceIp: true,
  status: true,
  message: true,
} satisfies Prisma.SecurityEventSelect;

/**
 * Translate a validated `EventQuery` into a Prisma `where` clause.
 * All values are already validated, so this only composes filters.
 */
function buildWhere(query: EventQuery): Prisma.SecurityEventWhereInput {
  const where: Prisma.SecurityEventWhereInput = {};
  const and: Prisma.SecurityEventWhereInput[] = [];

  if (query.severity.length > 0) where.severity = { in: query.severity };
  if (query.eventType) where.eventType = query.eventType;
  if (query.source) where.source = query.source;
  if (query.sourceType) where.sourceType = query.sourceType;
  if (query.sourceIp) where.sourceIp = query.sourceIp;
  if (query.username) where.username = query.username;
  if (query.status) where.status = query.status;

  if (query.from || query.to) {
    where.timestamp = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  // Free-text search across the human-relevant columns. `mode: insensitive`
  // makes matching case-insensitive without changing the stored values.
  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { message: { contains: term, mode: "insensitive" } },
        { username: { contains: term, mode: "insensitive" } },
        { source: { contains: term, mode: "insensitive" } },
        { eventType: { contains: term, mode: "insensitive" } },
        { resource: { contains: term, mode: "insensitive" } },
        { sourceIp: { contains: term } },
        { destinationIp: { contains: term } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * List events for the explorer with server-side pagination, filtering and
 * sorting. The requested page is clamped to the available range so an
 * out-of-range `?page=999` still returns a sensible result.
 */
export async function listEvents(query: EventQuery): Promise<Paginated<EventListItem>> {
  const where = buildWhere(query);

  const total = await prisma.securityEvent.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const items = await prisma.securityEvent.findMany({
    where,
    // Secondary sort on id keeps pagination stable when timestamps collide.
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: LIST_SELECT,
  });

  return { items, page, pageSize: query.pageSize, total, totalPages };
}

/** Fetch a single event with its related alerts and incidents (detail view). */
export async function getEventById(id: string): Promise<EventDetail | null> {
  const event = await prisma.securityEvent.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      destinationIp: true,
      userAgent: true,
      resource: true,
      action: true,
      metadata: true,
      createdAt: true,
      alerts: {
        select: { id: true, title: true, severity: true, status: true },
        orderBy: { firstSeen: "desc" },
      },
      incidents: {
        select: { id: true, reference: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!event) return null;

  const { alerts, incidents, ...rest } = event;
  return { ...rest, relatedAlerts: alerts, relatedIncidents: incidents };
}

/**
 * Distinct filter values drawn from real data (not hard-coded lists) so the
 * dropdowns only ever offer values that exist in the database.
 */
export async function getEventFacets(): Promise<EventFacets> {
  const [sources, eventTypes, statuses] = await Promise.all([
    prisma.securityEvent.findMany({
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
      take: 200,
    }),
    prisma.securityEvent.findMany({
      distinct: ["eventType"],
      select: { eventType: true },
      orderBy: { eventType: "asc" },
      take: 200,
    }),
    prisma.securityEvent.findMany({
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
      take: 200,
    }),
  ]);

  return {
    sources: sources.map((row) => row.source),
    eventTypes: eventTypes.map((row) => row.eventType),
    statuses: statuses
      .map((row) => row.status)
      .filter((status): status is string => status !== null),
  };
}
