import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/database/client";
import {
  createSession,
  revokeAllUserSessions,
  revokeSessionById,
  validateSessionToken,
} from "@/auth/session";
import { generateSessionToken, hashSessionToken, safeCompareHex } from "@/auth/token";
import { hashPassword } from "@/security/password";

/**
 * Securis - Session and token security tests
 *
 * Verifies the properties that make database-backed sessions safe: opaque
 * tokens, hash-only storage, expiry, revocation and immediate invalidation of a
 * disabled account's sessions.
 */

const createdUserIds: string[] = [];

async function makeUser(isActive = true) {
  const email = `session.${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: "Session Test User",
      email,
      passwordHash: await hashPassword("Str0ng#Password!"),
      role: "VIEWER",
      isActive,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.loginSession.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: createdUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("session tokens", () => {
  it("generates unique, high-entropy tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes tokens deterministically", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toHaveLength(64); // sha-256 hex
  });

  it("compares hashes in constant time", () => {
    const hash = hashSessionToken(generateSessionToken());
    expect(safeCompareHex(hash, hash)).toBe(true);
    expect(safeCompareHex(hash, hashSessionToken(generateSessionToken()))).toBe(false);
  });
});

describe("session lifecycle", () => {
  it("stores only the token hash, never the raw token", async () => {
    const user = await makeUser();
    const { token, session } = await createSession(user.id, { ipAddress: "198.51.100.5" });

    const row = await prisma.loginSession.findUnique({
      where: { id: session.id },
      select: { tokenHash: true },
    });

    expect(row?.tokenHash).toBe(hashSessionToken(token));
    expect(row?.tokenHash).not.toBe(token);
  });

  it("validates a live session and returns the user", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    const validated = await validateSessionToken(token);
    expect(validated?.user.id).toBe(user.id);
  });

  it("rejects an unknown token", async () => {
    expect(await validateSessionToken(generateSessionToken())).toBeNull();
  });

  it("rejects a revoked session", async () => {
    const user = await makeUser();
    const { token, session } = await createSession(user.id);
    await revokeSessionById(session.id);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const user = await makeUser();
    const { token, session } = await createSession(user.id);

    await prisma.loginSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects a session belonging to a disabled account", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await validateSessionToken(token)).toBeNull();
  });

  it("revokes every session for a user at once", async () => {
    const user = await makeUser();
    const first = await createSession(user.id);
    const second = await createSession(user.id);

    const revoked = await revokeAllUserSessions(user.id);
    expect(revoked).toBeGreaterThanOrEqual(2);

    expect(await validateSessionToken(first.token)).toBeNull();
    expect(await validateSessionToken(second.token)).toBeNull();
  });
});
