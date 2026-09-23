import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import { buildEventWhere } from "../conditions";
import { buildFinding } from "../finding";
import type { RuleEvaluator } from "../context";
import type { AggregateCondition, GroupByField } from "@/types/detection";

/**
 * Securis - THRESHOLD / TIME_WINDOW / IP_BASED evaluator
 *
 * Counts matching events per group inside the rule's time window and fires when
 * the count reaches the threshold. The counting is done by the database with a
 * `groupBy` aggregation; only the events belonging to qualifying groups are then
 * fetched (in a single query) for evidence.
 *
 * Used by: BRUTE_FORCE_001 (sourceIp), API_ABUSE_001 (sourceIp),
 * UNAUTHORIZED_ACCESS_001 (sourceIp).
 *
 * Connection: server/detection/engine.ts.
 */

/** Safety cap on how many qualifying groups are turned into findings. */
const MAX_GROUPS = 200;
/** Safety cap on evidence events fetched per evaluation. */
const MAX_EVIDENCE_EVENTS = 2000;

interface EvidenceRow {
  id: string;
  timestamp: Date;
  username: string | null;
  sourceIp: string | null;
  eventType: string;
}

export const evaluateAggregate: RuleEvaluator<AggregateCondition> = async ({
  rule,
  condition,
  from,
  to,
  windowSeconds,
  threshold,
}) => {
  const where = buildEventWhere(condition, from, to);
  const groupBy = condition.groupBy as GroupByField;

  // Database-side aggregation: counts per group, plus first/last timestamps.
  const groups = await prisma.securityEvent.groupBy({
    by: [groupBy],
    where,
    _count: { _all: true },
    _min: { timestamp: true },
    _max: { timestamp: true },
  });

  const qualifying = groups
    .filter((group) => {
      const value = group[groupBy as keyof typeof group];
      return value !== null && group._count._all >= threshold;
    })
    .slice(0, MAX_GROUPS);

  if (qualifying.length === 0) return [];

  const values = qualifying.map(
    (group) => group[groupBy as keyof typeof group] as string,
  );

  // Fetch evidence events for every qualifying group in one query.
  const evidenceWhere = {
    ...where,
    [groupBy]: { in: values },
  } as Prisma.SecurityEventWhereInput;

  const events = await prisma.securityEvent.findMany({
    where: evidenceWhere,
    orderBy: { timestamp: "asc" },
    take: MAX_EVIDENCE_EVENTS,
    select: {
      id: true,
      timestamp: true,
      username: true,
      sourceIp: true,
      eventType: true,
    },
  });

  // Bucket the evidence by group value.
  const eventsByGroup = new Map<string, EvidenceRow[]>();
  for (const event of events) {
    const value = (event as unknown as Record<string, unknown>)[groupBy];
    if (typeof value !== "string") continue;
    const list = eventsByGroup.get(value);
    if (list) list.push(event);
    else eventsByGroup.set(value, [event]);
  }

  const findings = [];
  for (const group of qualifying) {
    const value = group[groupBy as keyof typeof group] as string;
    const groupEvents = eventsByGroup.get(value) ?? [];
    const count = group._count._all;

    findings.push(
      buildFinding({
        rule,
        groupValue: value,
        firstSeen: group._min.timestamp ?? from,
        lastSeen: group._max.timestamp ?? to,
        eventIds: groupEvents.map((event) => event.id),
        sourceIp: groupBy === "sourceIp" ? value : groupEvents.find((e) => e.sourceIp)?.sourceIp ?? null,
        targetUser: groupBy === "username" ? value : groupEvents.find((e) => e.username)?.username ?? null,
        windowSeconds,
        eventCount: count,
        threshold,
        details: {
          groupBy,
          groupValue: value,
          count,
          threshold,
          windowSeconds,
          eventTypes: [...new Set(groupEvents.map((event) => event.eventType))],
        },
      }),
    );
  }

  return findings;
};
