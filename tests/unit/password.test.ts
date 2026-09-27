import { describe, expect, it } from "vitest";
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from "@/security/password";

/**
 * Securis - Password policy and hashing tests
 */
describe("password policy", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordPolicy("Str0ng#Password!").ok).toBe(true);
  });

  it("rejects passwords that are too short", () => {
    const result = validatePasswordPolicy("Sh0rt#a");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at least/i);
  });

  it("rejects passwords missing a character class", () => {
    expect(validatePasswordPolicy("alllowercase123!").ok).toBe(false); // no uppercase
    expect(validatePasswordPolicy("ALLUPPERCASE123!").ok).toBe(false); // no lowercase
    expect(validatePasswordPolicy("NoNumbersHere!!").ok).toBe(false); // no number
    expect(validatePasswordPolicy("NoSymbolsHere123").ok).toBe(false); // no symbol
  });
});

describe("password hashing", () => {
  it("hashes with Argon2id and verifies the original password", async () => {
    const hash = await hashPassword("Str0ng#Password!");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "Str0ng#Password!")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Str0ng#Password!");
    expect(await verifyPassword(hash, "Wr0ng#Password!")).toBe(false);
  });

  it("returns false (never throws) for a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});
