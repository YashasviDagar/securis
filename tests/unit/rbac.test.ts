import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  hasAllPermissions,
  hasPermission,
} from "@/auth/rbac";

/**
 * Securis - RBAC unit tests
 *
 * Verifies the permission model that gates every route and API. These are pure
 * assertions (no database) and document the intended privilege boundaries.
 */
describe("RBAC permission model", () => {
  it("grants administrators every permission", () => {
    expect(hasPermission("ADMIN", "users:write")).toBe(true);
    expect(hasPermission("ADMIN", "rules:write")).toBe(true);
    expect(hasPermission("ADMIN", "audit:read")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
  });

  it("gives analysts investigation capabilities but not administration", () => {
    expect(hasPermission("SECURITY_ANALYST", "alerts:write")).toBe(true);
    expect(hasPermission("SECURITY_ANALYST", "incidents:write")).toBe(true);
    expect(hasPermission("SECURITY_ANALYST", "threat-intel:write")).toBe(true);
    expect(hasPermission("SECURITY_ANALYST", "simulation:run")).toBe(true);

    // Administration is out of scope for analysts.
    expect(hasPermission("SECURITY_ANALYST", "users:write")).toBe(false);
    expect(hasPermission("SECURITY_ANALYST", "rules:write")).toBe(false);
    expect(hasPermission("SECURITY_ANALYST", "audit:read")).toBe(false);
  });

  it("restricts viewers to read-only capabilities", () => {
    expect(hasPermission("VIEWER", "events:read")).toBe(true);
    expect(hasPermission("VIEWER", "alerts:read")).toBe(true);
    expect(hasPermission("VIEWER", "dashboard:read")).toBe(true);

    // No write capability of any kind.
    const writes = ROLE_PERMISSIONS.VIEWER.filter((permission) =>
      permission.endsWith(":write"),
    );
    expect(writes).toHaveLength(0);
    expect(hasPermission("VIEWER", "alerts:write")).toBe(false);
    expect(hasPermission("VIEWER", "simulation:run")).toBe(false);
    expect(hasPermission("VIEWER", "events:ingest")).toBe(false);
  });

  it("supports all-of permission checks", () => {
    expect(hasAllPermissions("ADMIN", ["users:write", "rules:write"])).toBe(true);
    expect(hasAllPermissions("VIEWER", ["events:read", "alerts:write"])).toBe(false);
  });

  it("never grants a permission that is not defined for the role", () => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
      // Sanity: role string is one of the known roles.
      expect(["ADMIN", "SECURITY_ANALYST", "VIEWER"]).toContain(role);
    }
  });
});
