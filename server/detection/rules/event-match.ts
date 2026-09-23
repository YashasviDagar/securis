import { prisma } from "@/database/client";
import { buildEventWhere } from "../conditions";
import { buildFinding } from "../finding";
import type { RuleEvaluator } from "../context";
import type { EventMatchCondition } from "@/types/detection";

/**
 * Securis - EVENT_MATCH evaluator
 *
 * Fires when one or more events match the rule's filters. Matches are grouped
 * by username (falling back to source IP, then a single global group) so that
 * one alert is produced per actor rather than one per event.
 *
 * Used by: PRIVILEGE_ESCALATION_001, SENSITIVE_RESOURCE_ACCESS_001.
 *
 * Connection: server/detection/engine.ts.
 */

/** Safety cap on the number of events inspected by a single evaluation. */
const MAX_MATCHED_EVENTS = 1000;

export const evaluateEventMatch: RuleEvaluator<EventMatchCondition> = async ({
  rule,
  condition,
  from,
  to,
  windowSeconds,
}) => {
  const where = buildEventWhere(condition, from, to);

  const events = await prisma.securityEvent.findMany({
    where,
    orderBy: { timestamp: "asc" },
    take: MAX_MATCHED_EVENTS,
    select: {
      id: true,
      timestamp: true,
      username: true,
      sourceIp: true,
      eventType: true,
      resource: true,
      severity: true,
      message: true,
    },
  });

  if (events.length === 0) return [];

  // Group by the most specific actor available.
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = event.username ?? event.sourceIp ?? "global";
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }

  const findings = [];
  for (const [key, groupEvents] of groups) {
    const first = groupEvents[0]!;
    const last = groupEvents[groupEvents.length - 1]!;

    findings.push(
      buildFinding({
        rule,
        groupValue: key,
        firstSeen: first.timestamp,
        lastSeen: last.timestamp,
        eventIds: groupEvents.map((event) => event.id),
        sourceIp: groupEvents.find((event) => event.sourceIp)?.sourceIp ?? null,
        targetUser: groupEvents.find((event) => event.username)?.username ?? null,
        windowSeconds,
        eventCount: groupEvents.length,
        threshold: 1,
        details: {
          matchedEvents: groupEvents.length,
          eventTypes: [...new Set(groupEvents.map((event) => event.eventType))],
          resources: [
            ...new Set(
              groupEvents
                .map((event) => event.resource)
                .filter((resource): resource is string => resource !== null),
            ),
          ],
        },
      }),
    );
  }

  return findings;
};
