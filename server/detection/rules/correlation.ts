import { prisma } from "@/database/client";
import { buildEventWhere } from "../conditions";
import { buildFinding } from "../finding";
import type { RuleEvaluator } from "../context";
import type { CorrelationCondition } from "@/types/detection";

/**
 * Securis - CORRELATION evaluator
 *
 * Relates two different event types for the same group: a burst of failures
 * followed by a success. Optionally requires the success to come from an IP
 * that has never been seen for that group before ("new IP").
 *
 * Produces AT MOST ONE finding per group (username or source IP), choosing the
 * earliest qualifying success. This prevents a long history of successful
 * logins from generating an alert per success.
 *
 * Used by: ACCOUNT_TAKEOVER_001.
 *
 * Connection: server/detection/engine.ts.
 */

interface Row {
  id: string;
  timestamp: Date;
  username: string | null;
  sourceIp: string | null;
}

/** Read the group key from a row (username or sourceIp). */
function groupValueOf(row: Row, groupBy: "username" | "sourceIp"): string | null {
  return groupBy === "username" ? row.username : row.sourceIp;
}

export const evaluateCorrelation: RuleEvaluator<CorrelationCondition> = async ({
  rule,
  condition,
  from,
  to,
  windowSeconds,
  threshold,
}) => {
  const groupBy = condition.groupBy;
  const minFailures = condition.count ?? threshold ?? 3;

  const [failures, successes] = await Promise.all([
    prisma.securityEvent.findMany({
      where: buildEventWhere({ eventType: condition.failedEventType }, from, to),
      orderBy: { timestamp: "asc" },
      select: { id: true, timestamp: true, username: true, sourceIp: true },
    }),
    prisma.securityEvent.findMany({
      where: buildEventWhere({ eventType: condition.successEventType }, from, to),
      orderBy: { timestamp: "asc" },
      select: { id: true, timestamp: true, username: true, sourceIp: true },
    }),
  ]);

  if (failures.length === 0 || successes.length === 0) return [];

  // Bucket failures and successes by group.
  const failuresByGroup = new Map<string, Row[]>();
  for (const failure of failures) {
    const key = groupValueOf(failure, groupBy);
    if (!key) continue;
    const list = failuresByGroup.get(key);
    if (list) list.push(failure);
    else failuresByGroup.set(key, [failure]);
  }

  const successesByGroup = new Map<string, Row[]>();
  for (const success of successes) {
    const key = groupValueOf(success, groupBy);
    if (!key) continue;
    const list = successesByGroup.get(key);
    if (list) list.push(success);
    else successesByGroup.set(key, [success]);
  }

  /** Cache of source IPs previously seen for a group (before the window). */
  const knownIpsCache = new Map<string, Set<string | null>>();
  async function knownIpsFor(key: string): Promise<Set<string | null>> {
    const cached = knownIpsCache.get(key);
    if (cached) return cached;

    const priorIps = await prisma.securityEvent.findMany({
      where:
        groupBy === "username"
          ? { timestamp: { lt: from }, username: key, sourceIp: { not: null } }
          : { timestamp: { lt: from }, sourceIp: key },
      select: { sourceIp: true },
      distinct: ["sourceIp"],
      take: 200,
    });
    const set = new Set(priorIps.map((row) => row.sourceIp));
    knownIpsCache.set(key, set);
    return set;
  }

  const findings = [];

  // One finding per group: the earliest success that follows enough failures.
  for (const [key, groupFailures] of failuresByGroup) {
    if (groupFailures.length < minFailures) continue;

    const groupSuccesses = successesByGroup.get(key) ?? [];
    let chosen: Row | null = null;
    let isNewIp = false;

    for (const success of groupSuccesses) {
      const priorFailures = groupFailures.filter(
        (failure) => failure.timestamp <= success.timestamp,
      );
      if (priorFailures.length < minFailures) continue;

      if (condition.requireNewIp && success.sourceIp) {
        const known = await knownIpsFor(key);
        if (known.has(success.sourceIp)) continue;
        isNewIp = true;
      }

      chosen = success;
      break;
    }

    if (!chosen) continue;

    const priorFailures = groupFailures.filter(
      (failure) => failure.timestamp <= chosen!.timestamp,
    );
    const firstFailure = priorFailures[0]!;

    findings.push(
      buildFinding({
        rule,
        groupValue: key,
        firstSeen: firstFailure.timestamp,
        lastSeen: chosen.timestamp,
        eventIds: [...priorFailures.map((failure) => failure.id), chosen!.id],
        sourceIp: chosen.sourceIp ?? firstFailure.sourceIp ?? null,
        targetUser: groupBy === "username" ? key : chosen.username ?? null,
        windowSeconds,
        eventCount: priorFailures.length,
        threshold: minFailures,
        details: {
          groupBy,
          groupValue: key,
          failedAttempts: priorFailures.length,
          requiredFailures: minFailures,
          successAt: chosen.timestamp.toISOString(),
          successSourceIp: chosen.sourceIp,
          newSourceIp: isNewIp,
          windowSeconds,
        },
      }),
    );
  }

  return findings;
};
