import { randomInt } from "node:crypto";
import type { RawEvent } from "@/lib/validation/ingestion";
import type { ScenarioDefinition, SimulationScenario } from "@/types/simulation";

/**
 * Securis - Simulation scenarios
 *
 * Builders that produce controlled, *local* security events. All addresses come
 * from RFC 5737 documentation ranges (198.51.100.0/24, 203.0.113.0/24) and all
 * events are tagged `metadata.simulation = true`, so simulated activity is
 * always distinguishable from real telemetry.
 *
 * Nothing here contacts an external system: the events are fed to the normal
 * ingestion pipeline and stored in Securis' own database.
 *
 * Connection: server/simulation/service.ts -> server/ingestion/pipeline.ts.
 */

const SIM_USERS = ["a.khan", "j.reyes", "m.osei", "s.malik", "l.chen"];
const SIM_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
  "python-requests/2.31",
  "curl/8.4.0",
  "go-http-client/2.0",
];

/** A fresh RFC 5737 test address each run, so detections produce new alerts. */
function randomIp(): string {
  return `198.51.100.${randomInt(2, 254)}`;
}

function randomUser(): string {
  return SIM_USERS[randomInt(0, SIM_USERS.length - 1)];
}

function randomAgent(): string {
  return SIM_AGENTS[randomInt(0, SIM_AGENTS.length - 1)];
}

/** ISO timestamp `offsetMs` in the past. */
function ago(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const SOURCE = "simulation-lab";

/** 6 failed logins from one IP — triggers BRUTE_FORCE_001. */
function bruteForce(): RawEvent[] {
  const ip = randomIp();
  return Array.from({ length: 6 }, (_, index) => ({
    timestamp: ago((6 - index) * 10_000),
    source: SOURCE,
    sourceType: "AUTH" as const,
    eventType: "LOGIN_FAILED",
    severity: "MEDIUM" as const,
    username: "admin",
    sourceIp: ip,
    userAgent: "python-requests/2.31",
    resource: "/login",
    action: "LOGIN",
    status: "FAILURE",
    message: "Simulated failed authentication attempt",
    metadata: { simulation: true, scenario: "BRUTE_FORCE", attempt: index + 1 },
  }));
}

/** 4 failures then a success from a new IP — triggers ACCOUNT_TAKEOVER_001. */
function accountTakeover(): RawEvent[] {
  const ip = randomIp();
  const username = randomUser();
  const failures: RawEvent[] = Array.from({ length: 4 }, (_, index) => ({
    timestamp: ago((5 - index) * 15_000),
    source: SOURCE,
    sourceType: "AUTH" as const,
    eventType: "LOGIN_FAILED",
    severity: "MEDIUM" as const,
    username,
    sourceIp: ip,
    userAgent: "curl/8.4.0",
    resource: "/login",
    action: "LOGIN",
    status: "FAILURE",
    message: "Simulated failed authentication attempt",
    metadata: { simulation: true, scenario: "ACCOUNT_TAKEOVER", attempt: index + 1 },
  }));

  const success: RawEvent = {
    timestamp: ago(5_000),
    source: SOURCE,
    sourceType: "AUTH",
    eventType: "LOGIN_SUCCESS",
    severity: "HIGH",
    username,
    sourceIp: ip,
    userAgent: "curl/8.4.0",
    resource: "/login",
    action: "LOGIN",
    status: "SUCCESS",
    message: "Simulated successful login from a new source IP",
    metadata: { simulation: true, scenario: "ACCOUNT_TAKEOVER", newIp: true },
  };

  return [...failures, success];
}

/** Role change + privilege grant — triggers PRIVILEGE_ESCALATION_001. */
function privilegeEscalation(): RawEvent[] {
  const username = randomUser();
  const ip = randomIp();
  return [
    {
      timestamp: ago(20_000),
      source: SOURCE,
      sourceType: "APPLICATION",
      eventType: "USER_ROLE_CHANGED",
      severity: "HIGH",
      username,
      sourceIp: ip,
      userAgent: randomAgent(),
      resource: "/users",
      action: "UPDATE",
      status: "SUCCESS",
      message: "Simulated role change to SECURITY_ANALYST",
      metadata: { simulation: true, scenario: "PRIVILEGE_ESCALATION" },
    },
    {
      timestamp: ago(10_000),
      source: SOURCE,
      sourceType: "APPLICATION",
      eventType: "ADMIN_PRIVILEGE_GRANTED",
      severity: "HIGH",
      username,
      sourceIp: ip,
      userAgent: randomAgent(),
      resource: "/users",
      action: "GRANT",
      status: "SUCCESS",
      message: "Simulated administrative privilege grant",
      metadata: { simulation: true, scenario: "PRIVILEGE_ESCALATION" },
    },
  ];
}

/** 105 API requests in ~50s — triggers API_ABUSE_001. */
function apiAbuse(): RawEvent[] {
  const ip = randomIp();
  return Array.from({ length: 105 }, (_, index) => ({
    timestamp: ago(50_000 - index * 450),
    source: SOURCE,
    sourceType: "API" as const,
    eventType: "API_REQUEST",
    severity: "LOW" as const,
    sourceIp: ip,
    userAgent: "go-http-client/2.0",
    resource: "/api/v1/events",
    action: "READ",
    status: "200",
    message: "Simulated high-frequency API request",
    metadata: { simulation: true, scenario: "API_ABUSE", sequence: index + 1 },
  }));
}

/** 12 rejected requests — triggers UNAUTHORIZED_ACCESS_001. */
function unauthorizedAccess(): RawEvent[] {
  const ip = randomIp();
  return Array.from({ length: 12 }, (_, index) => ({
    timestamp: ago((12 - index) * 5_000),
    source: SOURCE,
    sourceType: "API" as const,
    eventType: "API_REQUEST",
    severity: "MEDIUM" as const,
    sourceIp: ip,
    userAgent: "curl/8.4.0",
    resource: "/api/v1/users",
    action: "READ",
    status: index % 3 === 0 ? "403" : "401",
    message: "Simulated unauthenticated request rejected",
    metadata: { simulation: true, scenario: "UNAUTHORIZED_ACCESS" },
  }));
}

/** Ordinary traffic — expected to trigger nothing. */
function normalTraffic(): RawEvent[] {
  const events: RawEvent[] = [];
  for (let index = 0; index < 20; index += 1) {
    const roll = index % 4;
    const username = randomUser();
    const ip = randomIp();
    if (roll === 0) {
      events.push({
        timestamp: ago(index * 3_000),
        source: SOURCE,
        sourceType: "AUTH",
        eventType: "LOGIN_SUCCESS",
        severity: "INFO",
        username,
        sourceIp: ip,
        userAgent: randomAgent(),
        resource: "/login",
        action: "LOGIN",
        status: "SUCCESS",
        message: "Simulated normal successful login",
        metadata: { simulation: true, scenario: "NORMAL_TRAFFIC" },
      });
    } else if (roll === 1) {
      events.push({
        timestamp: ago(index * 3_000),
        source: SOURCE,
        sourceType: "WEB",
        eventType: "HTTP_REQUEST",
        severity: "INFO",
        username,
        sourceIp: ip,
        userAgent: randomAgent(),
        resource: "/dashboard",
        action: "GET",
        status: "200",
        message: "Simulated normal page view",
        metadata: { simulation: true, scenario: "NORMAL_TRAFFIC" },
      });
    } else if (roll === 2) {
      events.push({
        timestamp: ago(index * 3_000),
        source: SOURCE,
        sourceType: "API",
        eventType: "API_REQUEST",
        severity: "INFO",
        username,
        sourceIp: ip,
        resource: "/api/v1/events",
        action: "READ",
        status: "200",
        message: "Simulated normal API request",
        metadata: { simulation: true, scenario: "NORMAL_TRAFFIC" },
      });
    } else {
      events.push({
        timestamp: ago(index * 3_000),
        source: SOURCE,
        sourceType: "SERVER",
        eventType: "HEALTH_CHECK",
        severity: "INFO",
        sourceIp: ip,
        resource: "cpu",
        action: "MONITOR",
        status: "OK",
        message: "Simulated normal health check",
        metadata: { simulation: true, scenario: "NORMAL_TRAFFIC" },
      });
    }
  }
  return events;
}

/** Build the events for a scenario. */
export function buildScenarioEvents(scenario: SimulationScenario): RawEvent[] {
  switch (scenario) {
    case "BRUTE_FORCE":
      return bruteForce();
    case "ACCOUNT_TAKEOVER":
      return accountTakeover();
    case "PRIVILEGE_ESCALATION":
      return privilegeEscalation();
    case "API_ABUSE":
      return apiAbuse();
    case "UNAUTHORIZED_ACCESS":
      return unauthorizedAccess();
    case "NORMAL_TRAFFIC":
      return normalTraffic();
  }
}

/** Metadata shown in the simulation lab UI. */
export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    id: "BRUTE_FORCE",
    name: "Brute Force",
    description: "Six failed logins for 'admin' from a single IP within a minute.",
    expectedRule: "BRUTE_FORCE_001",
    eventCount: 6,
    severity: "HIGH",
  },
  {
    id: "ACCOUNT_TAKEOVER",
    name: "Account Takeover",
    description: "Four failed logins followed by a success from a new IP.",
    expectedRule: "ACCOUNT_TAKEOVER_001",
    eventCount: 5,
    severity: "CRITICAL",
  },
  {
    id: "PRIVILEGE_ESCALATION",
    name: "Privilege Escalation",
    description: "A role change followed by an administrative privilege grant.",
    expectedRule: "PRIVILEGE_ESCALATION_001",
    eventCount: 2,
    severity: "HIGH",
  },
  {
    id: "API_ABUSE",
    name: "API Abuse",
    description: "105 API requests from one IP in under a minute.",
    expectedRule: "API_ABUSE_001",
    eventCount: 105,
    severity: "MEDIUM",
  },
  {
    id: "UNAUTHORIZED_ACCESS",
    name: "Unauthorized Access",
    description: "Twelve 401/403 responses from a single IP.",
    expectedRule: "UNAUTHORIZED_ACCESS_001",
    eventCount: 12,
    severity: "MEDIUM",
  },
  {
    id: "NORMAL_TRAFFIC",
    name: "Normal Traffic",
    description: "Ordinary logins, page views, API calls and health checks.",
    expectedRule: null,
    eventCount: 20,
    severity: "INFO",
  },
];
