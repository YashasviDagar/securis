import { prisma } from "@/database/client";
import type { IndicatorType } from "@prisma/client";

/**
 * Securis - Threat intelligence matcher
 *
 * The service layer between the detection engine and the local threat
 * intelligence database. Keeping lookups here means external feeds (a future
 * integration) can be added behind the same interface without touching the
 * engine, and no API keys or feed URLs leak into detection code.
 *
 * Phase 11 builds the analyst-facing search and management UI on top of this
 * module; the risk engine (Phase 8) already consumes it.
 *
 * Connection: database/client.ts (ThreatIndicator) -> server/detection/engine.ts.
 */

export interface IndicatorMatch {
  id: string;
  type: IndicatorType;
  value: string;
  threatType: string | null;
  confidence: number;
  source: string;
  description: string | null;
}

/** Values to look up; any subset may be supplied. */
export interface IndicatorQuery {
  ip?: string | null;
  domain?: string | null;
  hash?: string | null;
  url?: string | null;
}

/**
 * Find the highest-confidence active indicator matching any of the supplied
 * values. Returns null when nothing matches.
 *
 * Only `active` indicators are considered, so analysts can retire a stale
 * indicator without deleting its history.
 */
export async function matchIndicator(
  query: IndicatorQuery,
): Promise<IndicatorMatch | null> {
  const or: { type: IndicatorType; value: string }[] = [];

  if (query.ip) or.push({ type: "IP", value: query.ip.trim() });
  if (query.domain) or.push({ type: "DOMAIN", value: query.domain.trim().toLowerCase() });
  if (query.hash) or.push({ type: "HASH", value: query.hash.trim().toLowerCase() });
  if (query.url) or.push({ type: "URL", value: query.url.trim() });

  if (or.length === 0) return null;

  const match = await prisma.threatIndicator.findFirst({
    where: { active: true, OR: or },
    orderBy: { confidence: "desc" },
    select: {
      id: true,
      type: true,
      value: true,
      threatType: true,
      confidence: true,
      source: true,
      description: true,
    },
  });

  return match;
}
