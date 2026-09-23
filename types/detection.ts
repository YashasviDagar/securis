import type { RuleType, Severity, SourceType } from "./security";

/**
 * Securis - Detection engine types
 *
 * The detection engine evaluates database-stored rules against stored events.
 * A rule's `condition` column holds a JSON document whose shape depends on the
 * rule's `ruleType`; the schemas in lib/validation/detection.ts validate it.
 *
 * A rule evaluation produces zero or more `DetectionFinding`s, each of which is
 * turned into (or merged with) an `Alert` by the alert service.
 *
 * Connection: server/detection/** (evaluation), server/services/alert-service.ts
 * (persistence), types/security.ts (RuleType).
 */

/** Which field an aggregate/correlation rule groups by. */
export const GROUP_BY_FIELDS = ["sourceIp", "username", "source", "eventType"] as const;
export type GroupByField = (typeof GROUP_BY_FIELDS)[number];

/** Fields shared by every condition: the "what to match" filters. */
interface BaseMatchFilters {
  eventType?: string | string[];
  sourceType?: SourceType | SourceType[];
  status?: string | string[];
  resource?: string | string[];
  username?: string;
}

/**
 * EVENT_MATCH - fire when a single event matches the filters.
 * Example: privilege escalation, sensitive-resource access.
 */
export interface EventMatchCondition extends BaseMatchFilters {
  /** How `resource` is compared. Defaults to "exact"; use "contains" for paths. */
  resourceMatch?: "exact" | "contains";
  /** Substring that must appear in the message. */
  messageContains?: string;
}

/**
 * THRESHOLD / TIME_WINDOW / IP_BASED - count matching events per group inside a
 * time window and fire when the count reaches the threshold.
 * Examples: brute force (sourceIp), unauthorized access (sourceIp), API abuse.
 */
export interface AggregateCondition extends BaseMatchFilters {
  groupBy: GroupByField;
  /** Minimum number of matching events in the window. */
  count: number;
  /** Window length; falls back to the rule's timeWindowSeconds. */
  windowSeconds?: number;
}

/**
 * CORRELATION - relate two different event types for the same group.
 * Example: several failed logins followed by a successful login (account
 * takeover), optionally from a previously unseen IP.
 */
export interface CorrelationCondition {
  failedEventType: string;
  successEventType: string;
  groupBy: "username" | "sourceIp";
  /** Minimum failures before the success. Defaults to the rule threshold (3). */
  count?: number;
  windowSeconds?: number;
  /** Require the successful login to come from an IP unseen for the group. */
  requireNewIp?: boolean;
}

/**
 * USER_BASED - behavioural signals for a user.
 * Example: suspicious login pattern (new IP + new device + off-hours + prior
 * failures).
 */
export interface UserBasedCondition extends BaseMatchFilters {
  /** Successful logins are the trigger event for this rule type. */
  newIp?: boolean;
  newDevice?: boolean;
  offHours?: boolean;
  failedBeforeSuccess?: boolean;
  /** Minimum number of enabled signals required to fire. Defaults to all. */
  minSignals?: number;
  /** Failures required for the failedBeforeSuccess signal. Defaults to threshold. */
  count?: number;
  windowSeconds?: number;
  /** Off-hours window start hour (UTC, inclusive). Defaults to 22. */
  offHoursStart?: number;
  /** Off-hours window end hour (UTC, exclusive). Defaults to 6. */
  offHoursEnd?: number;
}

/** The union of all supported condition documents. */
export type RuleCondition =
  | EventMatchCondition
  | AggregateCondition
  | CorrelationCondition
  | UserBasedCondition;

/** A rule as loaded from the database for evaluation. */
export interface DetectionRuleRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  ruleType: RuleType;
  severity: Severity;
  condition: unknown;
  threshold: number | null;
  timeWindowSeconds: number | null;
  enabled: boolean;
}

/** The output of evaluating one rule: a candidate alert. */
export interface DetectionFinding {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  ruleType: RuleType;
  severity: Severity;
  title: string;
  description: string;
  /** Stable idempotency key (see Alert.dedupeKey). */
  dedupeKey: string;
  /** The group the finding is about (IP, username, ...). Null for global. */
  groupValue: string | null;
  /** Deterministic 0-100 risk score (see server/detection/risk.ts). */
  riskScore: number;
  riskFactors: { factor: string; weight: number }[];
  /** Matching threat-intelligence indicator, if the engine found one. */
  threatIntel?: {
    type: string;
    value: string;
    threatType: string | null;
    confidence: number;
    source: string;
  } | null;
  /** Number of events contributing to the detection. */
  eventCount?: number;
  /** Threshold the rule required. */
  threshold?: number;
  sourceIp: string | null;
  targetUser: string | null;
  firstSeen: Date;
  lastSeen: Date;
  eventIds: string[];
  /** Human-readable evidence, shown in the alert detail view. */
  details: Record<string, unknown>;
}

/** Summary of a detection run. */
export interface DetectionRunResult {
  rulesEvaluated: number;
  findings: number;
  alertsCreated: number;
  alertsUpdated: number;
  /** Rules whose condition could not be parsed (should be empty). */
  errors: { ruleCode: string; message: string }[];
  /** Alerts touched by this run, for API responses and the simulation lab. */
  alerts: {
    id: string;
    title: string;
    severity: Severity;
    status: string;
    riskScore: number;
  }[];
}
