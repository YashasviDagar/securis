import { describe, expect, it } from "vitest";
import { parseCondition } from "@/lib/validation/detection";
import { parseEventQuery } from "@/lib/validation/events";
import { parseAlertQuery } from "@/lib/validation/alerts";
import { consumeRateLimit, resetAllRateLimits } from "@/server/http/rate-limit";
import { isPrivateIp, isPublicIp } from "@/utils/ip";

/**
 * Securis - Validation, rate limiting and IP classification tests
 */

describe("detection condition validation", () => {
  it("accepts a valid threshold condition", () => {
    const result = parseCondition("THRESHOLD", {
      eventType: "LOGIN_FAILED",
      groupBy: "sourceIp",
      count: 5,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a threshold condition without a count", () => {
    const result = parseCondition("THRESHOLD", { eventType: "X", groupBy: "sourceIp" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown groupBy value", () => {
    const result = parseCondition("THRESHOLD", { groupBy: "nonsense", count: 1 });
    expect(result.ok).toBe(false);
  });

  it("accepts a correlation condition", () => {
    const result = parseCondition("CORRELATION", {
      failedEventType: "LOGIN_FAILED",
      successEventType: "LOGIN_SUCCESS",
      groupBy: "username",
      requireNewIp: true,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a user-based condition with minSignals", () => {
    const result = parseCondition("USER_BASED", {
      newIp: true,
      newDevice: true,
      minSignals: 2,
    });
    expect(result.ok).toBe(true);
  });
});

describe("query parsing is defensive", () => {
  it("falls back to defaults for malformed event queries", () => {
    const query = parseEventQuery({ page: "abc", pageSize: "9999", severity: "not-a-severity" });
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(25);
    expect(query.severity).toEqual([]);
  });

  it("parses a valid event query", () => {
    const query = parseEventQuery({ page: "2", severity: "HIGH,CRITICAL", sortBy: "severity" });
    expect(query.page).toBe(2);
    expect(query.severity).toEqual(["HIGH", "CRITICAL"]);
    expect(query.sortBy).toBe("severity");
  });

  it("ignores an unknown alert status", () => {
    const query = parseAlertQuery({ status: "BOGUS" });
    expect(query.status).toEqual([]);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then blocks", () => {
    resetAllRateLimits();
    const key = `test-${Date.now()}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(consumeRateLimit(key, 3, 60).allowed).toBe(true);
    }
    const blocked = consumeRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    resetAllRateLimits();
    consumeRateLimit("key-a", 1, 60);
    expect(consumeRateLimit("key-a", 1, 60).allowed).toBe(false);
    expect(consumeRateLimit("key-b", 1, 60).allowed).toBe(true);
  });
});

describe("IP classification", () => {
  it("classifies private and reserved ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.5.4")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });

  it("classifies publicly routable ranges", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("198.51.100.23")).toBe(true);
    expect(isPublicIp("192.168.1.1")).toBe(false);
  });
});
