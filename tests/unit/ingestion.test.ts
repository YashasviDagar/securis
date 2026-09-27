import { describe, expect, it } from "vitest";
import { parseEvent } from "@/server/ingestion/parser";
import { normalizeEvent, normalizeEventType, normalizeSeverity } from "@/server/ingestion/normalizer";
import { validateEvent } from "@/server/ingestion/validator";

/**
 * Securis - Ingestion pipeline tests
 *
 * Parser → normaliser → validator, with no database involved.
 */

const base = {
  source: "test-source",
  sourceType: "AUTH" as const,
};

describe("parser", () => {
  it("derives LOGIN_FAILED from an authentication outcome", () => {
    const parsed = parseEvent({
      ...base,
      raw: { user: "Bob", ip: "10.0.0.5", outcome: "failed" },
    });
    expect(parsed.eventType).toBe("LOGIN_FAILED");
    expect(parsed.username).toBe("Bob");
    expect(parsed.sourceIp).toBe("10.0.0.5");
    expect(parsed.status).toBe("FAILURE");
  });

  it("prefers explicit top-level fields over raw payload fields", () => {
    const parsed = parseEvent({
      ...base,
      username: "explicit",
      raw: { user: "derived" },
    });
    expect(parsed.username).toBe("explicit");
  });

  it("preserves the raw payload inside metadata", () => {
    const parsed = parseEvent({ ...base, raw: { anything: true } });
    expect(parsed.metadata).toMatchObject({ raw: { anything: true } });
  });
});

describe("normaliser", () => {
  it("normalises event types to UPPER_SNAKE_CASE", () => {
    expect(normalizeEventType("login-failed", "AUTH")).toBe("LOGIN_FAILED");
    expect(normalizeEventType("Login Failed", "AUTH")).toBe("LOGIN_FAILED");
  });

  it("maps severity words and numbers onto the canonical scale", () => {
    expect(normalizeSeverity("warn", "X")).toBe("MEDIUM");
    expect(normalizeSeverity("critical", "X")).toBe("CRITICAL");
    expect(normalizeSeverity(9, "X")).toBe("CRITICAL");
    expect(normalizeSeverity(1, "X")).toBe("INFO");
  });

  it("falls back to a documented default when severity is missing", () => {
    expect(normalizeSeverity(undefined, "LOGIN_FAILED")).toBe("MEDIUM");
    expect(normalizeSeverity(undefined, "HEALTH_CHECK")).toBe("INFO");
  });

  it("lower-cases usernames and validates IPs", () => {
    const normalized = normalizeEvent({
      ...base,
      eventType: "LOGIN_SUCCESS",
      username: "MixedCase",
      sourceIp: "203.0.113.5",
      destinationIp: "not-an-ip",
    });
    expect(normalized.username).toBe("mixedcase");
    expect(normalized.sourceIp).toBe("203.0.113.5");
    expect(normalized.destinationIp).toBeNull();
  });

  it("accepts epoch seconds and milliseconds", () => {
    const seconds = normalizeEvent({ ...base, eventType: "X", timestamp: 1_700_000_000 });
    const millis = normalizeEvent({ ...base, eventType: "X", timestamp: 1_700_000_000_000 });
    expect(seconds.timestamp.getTime()).toBe(millis.timestamp.getTime());
  });

  it("throws a NormalizationError for an unparseable timestamp", () => {
    expect(() => normalizeEvent({ ...base, eventType: "X", timestamp: "not-a-date" })).toThrow();
  });
});

describe("validator", () => {
  it("rejects an event whose supplied source IP is invalid", () => {
    const parsed = parseEvent({ ...base, eventType: "LOGIN_FAILED", sourceIp: "999.999.999.999" });
    const normalized = normalizeEvent(parsed);
    const issues = validateEvent(parsed, normalized);
    expect(issues.join(" ")).toMatch(/sourceIp is not a valid IP/i);
  });

  it("rejects an event dated far in the future", () => {
    const parsed = parseEvent({
      ...base,
      eventType: "X",
      timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const normalized = normalizeEvent(parsed);
    expect(validateEvent(parsed, normalized).join(" ")).toMatch(/future/i);
  });

  it("accepts a well-formed event", () => {
    const parsed = parseEvent({
      ...base,
      eventType: "LOGIN_FAILED",
      severity: "MEDIUM",
      sourceIp: "192.168.1.10",
    });
    const normalized = normalizeEvent(parsed);
    expect(validateEvent(parsed, normalized)).toHaveLength(0);
  });
});
