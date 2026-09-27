import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/database/client";
import { authenticate } from "@/server/services/auth-service";
import { hashPassword } from "@/security/password";
import { resetAllRateLimits } from "@/server/http/rate-limit";

/**
 * Securis - Authentication integration tests
 *
 * Exercise the real authentication service against the database: correct and
 * incorrect passwords, disabled accounts, rate limiting and account-existence
 * concealment. Test users are created and removed by the suite.
 */

const PASSWORD = "Str0ng#Password!";
const createdUserIds: string[] = [];
const createdEmails: string[] = [];

function uniqueEmail(prefix: string): string {
  const email = `${prefix}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@test.local`;
  createdEmails.push(email);
  return email;
}

/** A unique IP per attempt so tests never trip each other's IP limit. */
function uniqueIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
}

async function makeUser(options: { isActive?: boolean } = {}) {
  const email = uniqueEmail("auth");
  const user = await prisma.user.create({
    data: {
      name: "Auth Test User",
      email,
      passwordHash: await hashPassword(PASSWORD),
      role: "VIEWER",
      isActive: options.isActive ?? true,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  return user;
}

beforeEach(() => {
  resetAllRateLimits();
});

afterAll(async () => {
  await prisma.loginSession.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { in: createdEmails } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("authenticate", () => {
  it("succeeds with the correct password", async () => {
    const user = await makeUser();
    const result = await authenticate(
      { email: user.email, password: PASSWORD },
      { ipAddress: uniqueIp(), userAgent: "vitest" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.user.email).toBe(user.email);
      expect(result.token.length).toBeGreaterThan(20);
    }
  });

  it("rejects an incorrect password with a generic reason", async () => {
    const user = await makeUser();
    const result = await authenticate(
      { email: user.email, password: "Wr0ng#Password!" },
      { ipAddress: uniqueIp(), userAgent: "vitest" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("INVALID_CREDENTIALS");
      expect(result.message).toBe("Invalid email or password.");
    }
  });

  it("rejects a disabled account", async () => {
    const user = await makeUser({ isActive: false });
    const result = await authenticate(
      { email: user.email, password: PASSWORD },
      { ipAddress: uniqueIp(), userAgent: "vitest" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ACCOUNT_DISABLED");
  });

  it("does not reveal whether an unknown email exists", async () => {
    const result = await authenticate(
      { email: uniqueEmail("ghost"), password: PASSWORD },
      { ipAddress: uniqueIp(), userAgent: "vitest" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("INVALID_CREDENTIALS");
      expect(result.message).toBe("Invalid email or password.");
    }
  });

  it("rate limits repeated failures from the same account", async () => {
    const user = await makeUser();
    const ip = uniqueIp();

    // Exhaust the per-account limit (default 5) with wrong passwords.
    let last = await authenticate(
      { email: user.email, password: "Wr0ng#Password!" },
      { ipAddress: ip, userAgent: "vitest" },
    );
    for (let attempt = 0; attempt < 10 && last.ok === false && last.reason !== "RATE_LIMITED"; attempt += 1) {
      last = await authenticate(
        { email: user.email, password: "Wr0ng#Password!" },
        { ipAddress: uniqueIp(), userAgent: "vitest" },
      );
    }

    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.reason).toBe("RATE_LIMITED");
  });
});
