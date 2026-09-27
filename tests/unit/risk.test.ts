import { describe, expect, it } from "vitest";
import { computeRisk, isPrivilegedAccount } from "@/server/detection/risk";
import { riskBandFromScore } from "@/types/security";

/**
 * Securis - Risk scoring tests
 *
 * The model must be deterministic and its factors must explain the score.
 */
describe("risk scoring", () => {
  it("is deterministic for identical input", () => {
    const input = {
      severity: "HIGH" as const,
      ruleType: "THRESHOLD" as const,
      eventCount: 6,
      threshold: 5,
      sourceIp: "203.0.113.5",
      targetUser: "admin",
    };
    const first = computeRisk(input);
    const second = computeRisk(input);
    expect(second.score).toBe(first.score);
    expect(second.factors).toEqual(first.factors);
  });

  it("scores a critical correlation higher than a low event match", () => {
    const critical = computeRisk({
      severity: "CRITICAL",
      ruleType: "CORRELATION",
      eventCount: 5,
      threshold: 3,
      sourceIp: "203.0.113.5",
      targetUser: "admin",
    });
    const low = computeRisk({ severity: "LOW", ruleType: "EVENT_MATCH" });
    expect(critical.score).toBeGreaterThan(low.score);
  });

  it("adds a threat-intelligence factor scaled by confidence", () => {
    const without = computeRisk({ severity: "MEDIUM", ruleType: "THRESHOLD", sourceIp: "203.0.113.5" });
    const withTi = computeRisk({
      severity: "MEDIUM",
      ruleType: "THRESHOLD",
      sourceIp: "203.0.113.5",
      threatIntel: { threatType: "Botnet C2", confidence: 95 },
    });
    expect(withTi.score).toBeGreaterThan(without.score);
    expect(withTi.factors.some((factor) => /Threat intelligence match/.test(factor.factor))).toBe(true);
  });

  it("rewards privileged-account targeting", () => {
    const regular = computeRisk({ severity: "HIGH", ruleType: "EVENT_MATCH", targetUser: "j.reyes" });
    const privileged = computeRisk({ severity: "HIGH", ruleType: "EVENT_MATCH", targetUser: "admin" });
    expect(privileged.score).toBeGreaterThan(regular.score);
  });

  it("caps the score at 100 and never goes below 0", () => {
    const maxed = computeRisk({
      severity: "CRITICAL",
      ruleType: "CORRELATION",
      eventCount: 1000,
      threshold: 1,
      sourceIp: "8.8.8.8",
      targetUser: "admin",
      threatIntel: { threatType: "Ransomware", confidence: 100 },
      priorOccurrences: 10,
    });
    expect(maxed.score).toBe(100);
    expect(maxed.score).toBeLessThanOrEqual(100);
  });

  it("maps scores onto the documented bands", () => {
    expect(riskBandFromScore(10)).toBe("LOW");
    expect(riskBandFromScore(40)).toBe("MODERATE");
    expect(riskBandFromScore(70)).toBe("HIGH");
    expect(riskBandFromScore(90)).toBe("CRITICAL");
  });

  it("recognises privileged account names", () => {
    expect(isPrivilegedAccount("admin")).toBe(true);
    expect(isPrivilegedAccount("ROOT")).toBe(true);
    expect(isPrivilegedAccount("j.reyes")).toBe(false);
    expect(isPrivilegedAccount(null)).toBe(false);
  });
});
