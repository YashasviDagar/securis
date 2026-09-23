import type { IncidentStatus, Prisma, Severity } from "@prisma/client";
import { prisma } from "@/database/client";
import { recordAudit } from "@/server/services/audit-service";
import { findActiveUser, getAssignableUsers } from "@/server/services/user-service";
import { INCIDENT_STATUSES, SEVERITIES } from "@/types/security";
import type {
  CreateIncidentInput,
  UpdateIncidentInput,
} from "@/lib/validation/incidents";
import type {
  IncidentDetail,
  IncidentFacets,
  IncidentListItem,
  IncidentNoteItem,
  IncidentQuery,
} from "@/types/incidents";
import type { Paginated } from "@/types/common";

/**
 * Securis - Incident service
 *
 * An incident bundles one or more alerts into a coordinated investigation.
 * This service owns the incident lifecycle, its notes and its audit trail.
 *
 * Connection: database/client.ts -> Incident (+ IncidentNote, m2m alerts/events).
 */

/** Highest severity in a list, using the canonical ordering. */
const SEVERITY_RANK: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function highestSeverity(values: Severity[]): Severity {
  return values.reduce<Severity>(
    (highest, value) => (SEVERITY_RANK[value] > SEVERITY_RANK[highest] ? value : highest),
    "INFO",
  );
}

/** Generate the next sequential reference for the current year (INC-YYYY-NNN). */
async function nextReference(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INC-${year}-`;

  const last = await prisma.incident.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const nextNumber = last
    ? Number.parseInt(last.reference.slice(prefix.length), 10) + 1
    : 1;

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

/** Row projection for the incident board. */
const LIST_SELECT = {
  id: true,
  reference: true,
  title: true,
  severity: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  _count: { select: { alerts: true, events: true, notes: true } },
} satisfies Prisma.IncidentSelect;

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(incident: IncidentRow): IncidentListItem {
  return {
    id: incident.id,
    reference: incident.reference,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    assignedTo: incident.assignedTo ?? null,
    alertCount: incident._count.alerts,
    eventCount: incident._count.events,
    noteCount: incident._count.notes,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    resolvedAt: incident.resolvedAt,
  };
}

/** Build the Prisma `where` clause for an incident query. */
function buildWhere(query: IncidentQuery): Prisma.IncidentWhereInput {
  const where: Prisma.IncidentWhereInput = {};
  const and: Prisma.IncidentWhereInput[] = [];

  if (query.severity.length > 0) where.severity = { in: query.severity };
  if (query.status.length > 0) where.status = { in: query.status };
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.assigned === "assigned") where.assignedToId = { not: null };
  if (query.assigned === "unassigned") where.assignedToId = null;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { reference: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List incidents with server-side pagination, filtering and sorting. */
export async function listIncidents(
  query: IncidentQuery,
): Promise<Paginated<IncidentListItem>> {
  const where = buildWhere(query);

  const total = await prisma.incident.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.incident.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: LIST_SELECT,
  });

  return { items: rows.map(toListItem), page, pageSize: query.pageSize, total, totalPages };
}

/** Fetch one incident with its alerts, related events and notes. */
export async function getIncidentById(id: string): Promise<IncidentDetail | null> {
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      description: true,
      resolution: true,
      alerts: {
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          riskScore: true,
          sourceIp: true,
          targetUser: true,
        },
        orderBy: { riskScore: "desc" },
      },
      events: {
        orderBy: { timestamp: "asc" },
        select: {
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
        },
      },
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!incident) return null;

  const notes: IncidentNoteItem[] = incident.notes.map((note) => ({
    id: note.id,
    body: note.body,
    authorName: note.author.name,
    authorEmail: note.author.email,
    createdAt: note.createdAt,
  }));

  return {
    ...toListItem(incident),
    description: incident.description,
    resolution: incident.resolution,
    alerts: incident.alerts,
    relatedEvents: incident.events,
    notes,
  };
}

/** Distinct filter values drawn from real data. */
export async function getIncidentFacets(): Promise<IncidentFacets> {
  const analysts = await getAssignableUsers();
  return {
    statuses: [...INCIDENT_STATUSES],
    severities: [...SEVERITIES],
    analysts: analysts.map(({ id, name, email }) => ({ id, name, email })),
  };
}

/**
 * Alerts that can be bundled into a new incident: the highest-risk open ones.
 * Used to populate the create-incident dialog on the incident board.
 */
export async function getCandidateAlerts(
  limit = 50,
): Promise<{ id: string; title: string; severity: Severity }[]> {
  return prisma.alert.findMany({
    where: { status: { in: ["NEW", "INVESTIGATING"] } },
    orderBy: { riskScore: "desc" },
    take: limit,
    select: { id: true, title: true, severity: true },
  });
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

export interface MutationActor {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create an incident from one or more alerts.
 *
 * The incident inherits the highest severity of its alerts and links the union
 * of those alerts' events, so its timeline is complete from the moment it is
 * opened.
 */
export async function createIncident(
  input: CreateIncidentInput,
  actor: MutationActor,
): Promise<IncidentDetail | null> {
  const alerts = await prisma.alert.findMany({
    where: { id: { in: input.alertIds } },
    select: { id: true, severity: true, events: { select: { id: true } } },
  });
  if (alerts.length === 0) return null;

  if (input.assignedToId) {
    const assignee = await findActiveUser(input.assignedToId);
    if (!assignee) return null;
  }

  const severity = input.severity ?? highestSeverity(alerts.map((alert) => alert.severity));
  const eventIds = [...new Set(alerts.flatMap((alert) => alert.events.map((e) => e.id)))];
  const reference = await nextReference();

  const incident = await prisma.incident.create({
    data: {
      reference,
      title: input.title,
      description: input.description,
      severity,
      status: "OPEN",
      assignedToId: input.assignedToId ?? null,
      alerts: { connect: alerts.map((alert) => ({ id: alert.id })) },
      events: eventIds.length ? { connect: eventIds.map((id) => ({ id })) } : undefined,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "INCIDENT_CREATED",
    targetType: "Incident",
    targetId: incident.id,
    targetLabel: reference,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { alertIds: alerts.map((alert) => alert.id), severity, eventCount: eventIds.length },
  });

  return getIncidentById(incident.id);
}

/** Statuses that count as closed and stamp `resolvedAt`. */
const CLOSING_STATUSES = new Set<IncidentStatus>(["RESOLVED", "CLOSED"]);

/**
 * Apply a partial update to an incident (status, assignment, resolution,
 * title, description). Only the supplied fields are changed.
 */
export async function updateIncident(
  id: string,
  patch: UpdateIncidentInput,
  actor: MutationActor,
): Promise<IncidentDetail | null> {
  const current = await prisma.incident.findUnique({
    where: { id },
    select: { id: true, reference: true, status: true, assignedToId: true, resolvedAt: true },
  });
  if (!current) return null;

  if (patch.assignedToId) {
    const assignee = await findActiveUser(patch.assignedToId);
    if (!assignee) return null;
  }

  const data: Prisma.IncidentUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.resolution !== undefined) data.resolution = patch.resolution;
  if (patch.assignedToId !== undefined) {
    data.assignedTo = patch.assignedToId
      ? { connect: { id: patch.assignedToId } }
      : { disconnect: true };
  }
  if (patch.status !== undefined) {
    data.status = patch.status;
    data.resolvedAt = CLOSING_STATUSES.has(patch.status) ? new Date() : null;
  }

  await prisma.incident.update({ where: { id }, data });

  // Choose the most specific audit action for the change.
  let action: "INCIDENT_UPDATED" | "INCIDENT_RESOLVED" | "INCIDENT_CLOSED" =
    "INCIDENT_UPDATED";
  if (patch.status === "RESOLVED") action = "INCIDENT_RESOLVED";
  if (patch.status === "CLOSED") action = "INCIDENT_CLOSED";

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetType: "Incident",
    targetId: id,
    targetLabel: current.reference,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: {
      statusFrom: current.status,
      statusTo: patch.status ?? current.status,
      assignedToId: patch.assignedToId ?? undefined,
      hasResolution: patch.resolution !== undefined ? Boolean(patch.resolution) : undefined,
    },
  });

  return getIncidentById(id);
}

/** Append an analyst note to an incident. */
export async function addIncidentNote(
  id: string,
  authorId: string,
  body: string,
  actor: MutationActor,
): Promise<IncidentNoteItem | null> {
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { id: true, reference: true },
  });
  if (!incident) return null;

  const note = await prisma.incidentNote.create({
    data: { incidentId: id, authorId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "INCIDENT_NOTE_ADDED",
    targetType: "Incident",
    targetId: id,
    targetLabel: incident.reference,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { noteId: note.id, length: body.length },
  });

  return {
    id: note.id,
    body: note.body,
    authorName: note.author.name,
    authorEmail: note.author.email,
    createdAt: note.createdAt,
  };
}
