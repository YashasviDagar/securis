import { prisma } from "@/database/client";
import { buildEventWhere } from "../conditions";
import { buildFinding } from "../finding";
import type { RuleEvaluator } from "../context";
import type { UserBasedCondition } from "@/types/detection";

/**
 * Securis - USER_BASED evaluator
 *
 * Behavioural detection for a user. The trigger event is a successful
 * authentication; the rule evaluates a set of independent signals:
 *
 *   - newIp              : the source IP was never seen for this user before.
 *   - newDevice          : the user agent was never seen for this user before.
 *   - offHours           : the login happened inside the configured off-hours.
 *   - failedBeforeSuccess: at least `count` failures preceded the success.
 *
 * Produces AT MOST ONE finding per user, choosing the first successful login
 * whose satisfied-signal count reaches `minSignals` (defaults to the number of
 * enabled signals).
 *
 * Used by: SUSPICIOUS_LOGIN_PATTERN_001.
 *
 * Connection: server/detection/engine.ts.
 */

/** Count how many signals the condition enables. */
function enabledSignalCount(condition: UserBasedCondition): number {
  return [
    condition.newIp,
    condition.newDevice,
    condition.offHours,
    condition.failedBeforeSuccess,
  ].filter(Boolean).length;
}

/** Is the given UTC hour inside the off-hours window? (window may wrap) */
function isOffHours(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

interface SuccessRow {
  id: string;
  timestamp: Date;
  username: string | null;
  sourceIp: string | null;
  userAgent: string | null;
}

export const evaluateUserBased: RuleEvaluator<UserBasedCondition> = async ({
  rule,
  condition,
  from,
  to,
  windowSeconds,
  threshold,
}) => {
  const enabled = enabledSignalCount(condition);
  if (enabled === 0) return []; // Misconfigured: nothing to detect.

  const minSignals = condition.minSignals ?? enabled;
  const requiredFailures = condition.count ?? threshold ?? 3;
  const offStart = condition.offHoursStart ?? 22;
  const offEnd = condition.offHoursEnd ?? 6;
  const successType = condition.eventType ?? "LOGIN_SUCCESS";

  const successFilters = {
    eventType: successType,
    sourceType: condition.sourceType,
    status: condition.status,
    resource: condition.resource,
    username: condition.username,
  };

  const [successes, failures] = await Promise.all([
    prisma.securityEvent.findMany({
      where: buildEventWhere(successFilters, from, to),
      orderBy: { timestamp: "asc" },
      select: { id: true, timestamp: true, username: true, sourceIp: true, userAgent: true },
    }),
    prisma.securityEvent.findMany({
      where: buildEventWhere({ eventType: "LOGIN_FAILED" }, from, to),
      orderBy: { timestamp: "asc" },
      select: { id: true, timestamp: true, username: true, sourceIp: true },
    }),
  ]);

  // Group successes by username so we evaluate each user once.
  const successesByUser = new Map<string, SuccessRow[]>();
  for (const success of successes) {
    if (!success.username) continue;
    const list = successesByUser.get(success.username);
    if (list) list.push(success);
    else successesByUser.set(success.username, [success]);
  }

  // Per-user history caches (IPs/user agents seen before the window).
  const ipCache = new Map<string, Set<string | null>>();
  const agentCache = new Map<string, Set<string | null>>();

  async function knownIps(username: string): Promise<Set<string | null>> {
    const cached = ipCache.get(username);
    if (cached) return cached;
    const rows = await prisma.securityEvent.findMany({
      where: { timestamp: { lt: from }, username, sourceIp: { not: null } },
      select: { sourceIp: true },
      distinct: ["sourceIp"],
      take: 200,
    });
    const set = new Set(rows.map((row) => row.sourceIp));
    ipCache.set(username, set);
    return set;
  }

  async function knownAgents(username: string): Promise<Set<string | null>> {
    const cached = agentCache.get(username);
    if (cached) return cached;
    const rows = await prisma.securityEvent.findMany({
      where: { timestamp: { lt: from }, username, userAgent: { not: null } },
      select: { userAgent: true },
      distinct: ["userAgent"],
      take: 200,
    });
    const set = new Set(rows.map((row) => row.userAgent));
    agentCache.set(username, set);
    return set;
  }

  const findings = [];

  for (const [username, userSuccesses] of successesByUser) {
    let chosen: SuccessRow | null = null;
    let chosenSignals: string[] = [];
    let chosenDetail: Record<string, unknown> = {};

    // Evaluate successes in chronological order and take the first qualifying.
    for (const success of userSuccesses) {
      const signals: string[] = [];
      const detail: Record<string, unknown> = {};

      if (condition.newIp) {
        const known = await knownIps(username);
        if (success.sourceIp && !known.has(success.sourceIp)) {
          signals.push("newIp");
          detail.sourceIp = success.sourceIp;
        }
      }

      if (condition.newDevice) {
        const known = await knownAgents(username);
        if (success.userAgent && !known.has(success.userAgent)) {
          signals.push("newDevice");
          detail.userAgent = success.userAgent;
        }
      }

      if (condition.offHours) {
        const hour = success.timestamp.getUTCHours();
        if (isOffHours(hour, offStart, offEnd)) {
          signals.push("offHours");
          detail.loginHourUtc = hour;
        }
      }

      if (condition.failedBeforeSuccess) {
        const priorFailures = failures.filter(
          (failure) =>
            failure.username === username && failure.timestamp <= success.timestamp,
        );
        if (priorFailures.length >= requiredFailures) {
          signals.push("failedBeforeSuccess");
          detail.priorFailures = priorFailures.length;
        }
      }

      if (signals.length >= minSignals) {
        chosen = success;
        chosenSignals = signals;
        chosenDetail = detail;
        break;
      }
    }

    if (!chosen) continue;

    const priorFailures = failures.filter(
      (failure) => failure.username === username && failure.timestamp <= chosen!.timestamp,
    );
    const firstSeen = priorFailures.length > 0 ? priorFailures[0]!.timestamp : chosen.timestamp;

    findings.push(
      buildFinding({
        rule,
        groupValue: username,
        firstSeen,
        lastSeen: chosen.timestamp,
        eventIds: [...priorFailures.map((failure) => failure.id), chosen.id],
        sourceIp: chosen.sourceIp,
        targetUser: username,
        windowSeconds,
        eventCount: priorFailures.length,
        threshold: requiredFailures,
        details: {
          signals: chosenSignals,
          minSignals,
          enabledSignals: enabled,
          ...chosenDetail,
        },
      }),
    );
  }

  return findings;
};
