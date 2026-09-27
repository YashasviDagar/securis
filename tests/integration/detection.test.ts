import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/database/client";
import { runDetection } from "@/server/detection";
import { resetAllRateLimits } from "@/server/http/rate-limit";

/**
 * Securis - Detection engine integration tests
 *
 * These exercise the real engine against the real database. Each test uses a
 * dedicated rule AND a dedicated event type (both unique), so the rule can only
 * ever match the events the test created — the seeded data is never disturbed
 * and never interferes. Everything created is removed afterwards.
 *
 * Requires a running database (see README: `npx prisma dev --detach`).
 */

/** A unique, upper-case token usable in rule codes and event types. */
function unique(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();
}

const createdRuleIds: string[] = [];
const createdSources: string[] = [];

async function makeRule(data: {
  code: string;
  ruleType: "THRESHOLD" | "TIME_WINDOW" | "CORRELATION" | "EVENT_MATCH" | "USER_BASED";
  condition: object;
  threshold?: number;
  timeWindowSeconds?: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  const rule = await prisma.detectionRule.create({
    data: {
      code: data.code,
      name: `Test rule ${data.code}`,
      description: "Created by the automated test suite.",
      ruleType: data.ruleType,
      severity: data.severity ?? "MEDIUM",
      condition: data.condition,
      threshold: data.threshold ?? null,
      timeWindowSeconds: data.timeWindowSeconds ?? null,
      enabled: true,
    },
    select: { id: true, code: true },
  });
  createdRuleIds.push(rule.id);
  return rule;
}

async function makeEvents(
  source: string,
  rows: {
    timestamp: Date;
    eventType: string;
    sourceIp?: string | null;
    username?: string | null;
    status?: string | null;
    sourceType?: "AUTH" | "API" | "WEB" | "SERVER";
  }[],
) {
  createdSources.push(source);
  await prisma.securityEvent.createMany({
    data: rows.map((row) => ({
      timestamp: row.timestamp,
      source,
      sourceType: row.sourceType ?? "AUTH",
      eventType: row.eventType,
      severity: "MEDIUM",
      sourceIp: row.sourceIp ?? null,
      username: row.username ?? null,
      status: row.status ?? null,
      message: `Test event ${row.eventType}`,
      metadata: { test: true },
    })),
  });
}

const alertsForRule = (ruleId: string) => prisma.alert.count({ where: { ruleId } });

const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000);

beforeEach(() => {
  resetAllRateLimits();
});

afterAll(async () => {
  await prisma.alert.deleteMany({ where: { ruleId: { in: createdRuleIds } } });
  await prisma.detectionRule.deleteMany({ where: { id: { in: createdRuleIds } } });
  await prisma.securityEvent.deleteMany({ where: { source: { in: createdSources } } });
  await prisma.$disconnect();
});

describe("brute force detection", () => {
  it("creates an alert for 5 failed logins from one IP within the window", async () => {
    const eventType = unique("LOGIN_FAILED_TEST");
    const rule = await makeRule({
      code: unique("TEST_BRUTE"),
      ruleType: "THRESHOLD",
      severity: "HIGH",
      condition: { eventType, groupBy: "sourceIp", count: 5 },
      threshold: 5,
      timeWindowSeconds: 300,
    });

    await makeEvents(
      unique("test-brute"),
      Array.from({ length: 5 }, (_, index) => ({
        timestamp: minutesAgo(3 - index * 0.5),
        eventType,
        sourceIp: "198.51.100.11",
      })),
    );

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(1);
  });

  it("does NOT alert for only 4 failed logins", async () => {
    const eventType = unique("LOGIN_FAILED_TEST");
    const rule = await makeRule({
      code: unique("TEST_BRUTE4"),
      ruleType: "THRESHOLD",
      severity: "HIGH",
      condition: { eventType, groupBy: "sourceIp", count: 5 },
      threshold: 5,
      timeWindowSeconds: 300,
    });

    await makeEvents(
      unique("test-brute4"),
      Array.from({ length: 4 }, (_, index) => ({
        timestamp: minutesAgo(3 - index * 0.5),
        eventType,
        sourceIp: "198.51.100.12",
      })),
    );

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(0);
  });

  it("does NOT alert when the failures fall outside the time window", async () => {
    const eventType = unique("LOGIN_FAILED_TEST");
    const rule = await makeRule({
      code: unique("TEST_BRUTEWIN"),
      ruleType: "THRESHOLD",
      severity: "HIGH",
      condition: { eventType, groupBy: "sourceIp", count: 5 },
      threshold: 5,
      timeWindowSeconds: 300, // 5 minutes
    });

    // Six failures spread over the last hour — none inside the 5-minute window.
    await makeEvents(
      unique("test-brutewin"),
      Array.from({ length: 6 }, (_, index) => ({
        timestamp: minutesAgo(10 + index * 8),
        eventType,
        sourceIp: "198.51.100.13",
      })),
    );

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(0);
  });
});

describe("account takeover correlation", () => {
  it("alerts when failures are followed by a success from a new IP", async () => {
    const failedType = unique("LOGIN_FAILED_TEST");
    const successType = unique("LOGIN_SUCCESS_TEST");
    const rule = await makeRule({
      code: unique("TEST_ATO"),
      ruleType: "CORRELATION",
      severity: "CRITICAL",
      condition: {
        failedEventType: failedType,
        successEventType: successType,
        groupBy: "username",
        count: 3,
        requireNewIp: true,
      },
      threshold: 3,
      timeWindowSeconds: 600,
    });

    const username = unique("victim");
    const ip = "198.51.100.20";

    await makeEvents(unique("test-ato"), [
      ...Array.from({ length: 3 }, (_, index) => ({
        timestamp: minutesAgo(4 - index * 0.5),
        eventType: failedType,
        username,
        sourceIp: ip,
      })),
      { timestamp: secondsAgo(20), eventType: successType, username, sourceIp: ip },
    ]);

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(1);
  });
});

describe("API abuse detection", () => {
  it("alerts when a single IP exceeds the request threshold in the window", async () => {
    const eventType = unique("API_REQUEST_TEST");
    const rule = await makeRule({
      code: unique("TEST_API"),
      ruleType: "TIME_WINDOW",
      severity: "MEDIUM",
      condition: { eventType, groupBy: "sourceIp", count: 100 },
      threshold: 100,
      timeWindowSeconds: 60,
    });

    await makeEvents(
      unique("test-api"),
      Array.from({ length: 105 }, (_, index) => ({
        timestamp: secondsAgo(50 - index * 0.4),
        eventType,
        sourceType: "API" as const,
        sourceIp: "192.0.2.77",
      })),
    );

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(1);
  });
});

describe("event match detection", () => {
  it("alerts on a privilege escalation event", async () => {
    const eventType = unique("ADMIN_PRIVILEGE_GRANTED_TEST");
    const rule = await makeRule({
      code: unique("TEST_PRIV"),
      ruleType: "EVENT_MATCH",
      severity: "HIGH",
      condition: { eventType },
    });

    await makeEvents(unique("test-priv"), [
      { timestamp: secondsAgo(30), eventType, username: unique("escalator"), sourceIp: "10.0.0.9" },
    ]);

    await runDetection({ to: now, ruleCodes: [rule.code] });
    expect(await alertsForRule(rule.id)).toBe(1);
  });
});

describe("detection idempotency", () => {
  it("does not create duplicate alerts when run twice over the same events", async () => {
    const eventType = unique("LOGIN_FAILED_TEST");
    const rule = await makeRule({
      code: unique("TEST_IDEM"),
      ruleType: "THRESHOLD",
      severity: "HIGH",
      condition: { eventType, groupBy: "sourceIp", count: 5 },
      threshold: 5,
      timeWindowSeconds: 300,
    });

    await makeEvents(
      unique("test-idem"),
      Array.from({ length: 6 }, (_, index) => ({
        timestamp: minutesAgo(2 - index * 0.2),
        eventType,
        sourceIp: "198.51.100.99",
      })),
    );

    await runDetection({ to: now, ruleCodes: [rule.code] });
    const first = await alertsForRule(rule.id);
    await runDetection({ to: now, ruleCodes: [rule.code] });
    const second = await alertsForRule(rule.id);

    expect(first).toBe(1);
    expect(second).toBe(1);
  });
});
