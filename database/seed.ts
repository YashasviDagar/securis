/**
 * Securis - Database seed (Phase 2)
 *
 * Populates a fresh database with realistic, internally-consistent SIEM data:
 * users, detection rules, threat indicators, security events (normal traffic
 * plus seven scripted attack scenarios), alerts, incidents, notes, login
 * sessions and audit logs.
 *
 * Design goals:
 *   1. Every number in the platform is traceable to a row created here - the
 *      dashboard is never fed fabricated statistics.
 *   2. The seven attack scenarios produce events that the Phase 6/7 detection
 *      engine will genuinely re-detect, so the seed doubles as a fixture.
 *   3. Timestamps are relative to "now" so "events today" is meaningful.
 *
 * Run with:  npm run db:seed   (loads .env via the Prisma CLI)
 *
 * Connection: uses the Prisma client (database/client.ts config) against
 * PostgreSQL, and security/password.ts to hash seed passwords with Argon2id.
 */

import {
  AlertStatus,
  AuditAction,
  IncidentStatus,
  IndicatorType,
  Prisma,
  PrismaClient,
  Role,
  RuleType,
  Severity,
  SourceType,
} from "@prisma/client";
import { hashPassword } from "../security/password";
import { runDetection } from "@/server/detection";

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Deterministic helpers
// -----------------------------------------------------------------------------

/**
 * Tiny seeded PRNG (mulberry32) so re-seeding produces the same "random"
 * background traffic. Determinism makes tests and screenshots reproducible.
 */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260921);

/** Pick a random element from a non-empty array. */
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** Random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

const NOW = new Date();

/** A Date `minutes` minutes in the past. */
function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

/** Monotonic id generator so related rows can be linked without extra queries. */
let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36).padStart(6, "0")}`;
}

// -----------------------------------------------------------------------------
// Reference data
// -----------------------------------------------------------------------------

const SEED_PASSWORDS = {
  admin: "SecurisAdmin#2026",
  analyst: "SecurisAnalyst#2026",
  viewer: "SecurisViewer#2026",
} as const;

/** External / test IP ranges (RFC 5737 + RFC 1918) - never real attacker hosts. */
const IPS = {
  normal: ["192.168.1.10", "192.168.1.24", "192.168.1.51", "10.0.0.14", "10.0.0.31"],
  bruteForce: "198.51.100.23",
  takeover: "203.0.113.77",
  apiAbuse: "192.0.2.44",
  unauthorized: "198.51.100.90",
  sensitive: "203.0.113.201",
  suspicious: "203.0.113.150",
} as const;

const NORMAL_USERNAMES = ["a.khan", "j.reyes", "m.osei", "s.malik", "l.chen"];
const RESOURCES = ["/dashboard", "/events", "/alerts", "/reports", "/profile"];
const NORMAL_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Safari/17.1",
  "Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0",
];

// -----------------------------------------------------------------------------
// Seed steps
// -----------------------------------------------------------------------------

/** Remove all existing rows so the seed is idempotent. */
async function resetDatabase() {
  // Delete children before parents to respect foreign keys.
  await prisma.auditLog.deleteMany();
  await prisma.incidentNote.deleteMany();
  await prisma.alertNote.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.loginSession.deleteMany();
  await prisma.detectionRule.deleteMany();
  await prisma.threatIndicator.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const [adminHash, analystHash, viewerHash] = await Promise.all([
    hashPassword(SEED_PASSWORDS.admin),
    hashPassword(SEED_PASSWORDS.analyst),
    hashPassword(SEED_PASSWORDS.viewer),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: "admin@securis.local",
      name: "Yashasvi Dagar",
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
      lastLoginAt: minutesAgo(35),
    },
  });

  const analyst = await prisma.user.create({
    data: {
      email: "analyst@securis.local",
      name: "Priya Nair",
      passwordHash: analystHash,
      role: Role.SECURITY_ANALYST,
      isActive: true,
      lastLoginAt: minutesAgo(120),
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: "viewer@securis.local",
      name: "Sam Okafor",
      passwordHash: viewerHash,
      role: Role.VIEWER,
      isActive: true,
      lastLoginAt: minutesAgo(600),
    },
  });

  // A second analyst and a disabled account exercise the RBAC + user screens.
  const analyst2 = await prisma.user.create({
    data: {
      email: "analyst2@securis.local",
      name: "Lena Fischer",
      passwordHash: analystHash,
      role: Role.SECURITY_ANALYST,
      isActive: true,
      lastLoginAt: minutesAgo(1440),
    },
  });

  const disabled = await prisma.user.create({
    data: {
      email: "disabled@securis.local",
      name: "Former Contractor",
      passwordHash: viewerHash,
      role: Role.VIEWER,
      isActive: false,
      lastLoginAt: minutesAgo(43200),
    },
  });

  return { admin, analyst, viewer, analyst2, disabled };
}

async function seedDetectionRules(adminId: string) {
  const rules = [
    {
      code: "BRUTE_FORCE_001",
      name: "Brute Force Detection",
      description:
        "Fires when 5 or more failed authentication attempts originate from the same source IP within a 5 minute window.",
      ruleType: RuleType.THRESHOLD,
      severity: Severity.HIGH,
      condition: { eventType: "LOGIN_FAILED", groupBy: "sourceIp", count: 5 },
      threshold: 5,
      timeWindowSeconds: 300,
      enabled: true,
    },
    {
      code: "ACCOUNT_TAKEOVER_001",
      name: "Possible Account Takeover",
      description:
        "Multiple failed logins followed by a successful login for the same account from a new source IP.",
      ruleType: RuleType.CORRELATION,
      severity: Severity.CRITICAL,
      condition: {
        failedEventType: "LOGIN_FAILED",
        successEventType: "LOGIN_SUCCESS",
        groupBy: "username",
        requireNewIp: true,
      },
      threshold: 3,
      timeWindowSeconds: 600,
      enabled: true,
    },
    {
      code: "PRIVILEGE_ESCALATION_001",
      name: "Suspicious Privilege Escalation",
      description:
        "Detects administrative privilege grants and role changes that may indicate escalation.",
      ruleType: RuleType.EVENT_MATCH,
      severity: Severity.HIGH,
      condition: {
        eventType: ["ADMIN_PRIVILEGE_GRANTED", "USER_ROLE_CHANGED"],
      },
      threshold: null,
      timeWindowSeconds: null,
      enabled: true,
    },
    {
      code: "API_ABUSE_001",
      name: "Abnormal API Activity",
      description:
        "Fires when a single source IP exceeds 100 API requests within one minute.",
      ruleType: RuleType.TIME_WINDOW,
      severity: Severity.MEDIUM,
      condition: { sourceType: "API", groupBy: "sourceIp", count: 100 },
      threshold: 100,
      timeWindowSeconds: 60,
      enabled: true,
    },
    {
      code: "UNAUTHORIZED_ACCESS_001",
      name: "Possible Unauthorized Access Attempt",
      description:
        "Repeated 401/403 responses from the same source IP indicate access probing.",
      ruleType: RuleType.THRESHOLD,
      severity: Severity.MEDIUM,
      condition: { status: ["401", "403"], groupBy: "sourceIp", count: 10 },
      threshold: 10,
      timeWindowSeconds: 300,
      enabled: true,
    },
    {
      code: "SENSITIVE_RESOURCE_ACCESS_001",
      name: "Sensitive Resource Access",
      description:
        "Access to sensitive administrative or configuration resources such as /admin, /config or .env from a web or API request.",
      ruleType: RuleType.EVENT_MATCH,
      severity: Severity.HIGH,
      condition: {
        // Restrict to actual resource-access events. Without the sourceType
        // filter the rule would also match administrative actions whose
        // `resource` happens to be "/users" (e.g. a role change), which is a
        // different kind of event and is already covered by the privilege
        // escalation rule.
        sourceType: ["WEB", "API"],
        resource: ["/admin", "/users", "/config", "/database", ".env"],
      },
      threshold: null,
      timeWindowSeconds: null,
      enabled: true,
    },
    {
      code: "SUSPICIOUS_LOGIN_PATTERN_001",
      name: "Suspicious Login Pattern",
      description:
        "A successful authentication combining a new IP, a new device, an unusual login time and prior failures. Fires when at least three of the four signals are present.",
      ruleType: RuleType.USER_BASED,
      severity: Severity.MEDIUM,
      condition: {
        newIp: true,
        newDevice: true,
        offHours: true,
        failedBeforeSuccess: true,
        // Require 3 of the 4 signals. Requiring all four makes the rule brittle:
        // off-hours is time-zone dependent and a real attacker can log in during
        // business hours. Three signals (new IP + new device + prior failures) is
        // still a high-confidence pattern.
        minSignals: 3,
      },
      threshold: 3,
      timeWindowSeconds: 900,
      enabled: true,
    },
  ];

  return prisma.detectionRule.createManyAndReturn({
    data: rules.map((rule) => ({ ...rule, createdById: adminId })),
  });
}

async function seedThreatIndicators() {
  const indicators: Prisma.ThreatIndicatorCreateManyInput[] = [
    {
      type: IndicatorType.IP,
      value: IPS.bruteForce,
      threatType: "Credential Attack",
      confidence: 85,
      source: "internal-honeypot",
      description: "Source of sustained SSH/HTTP credential brute forcing.",
      firstSeen: minutesAgo(60 * 24 * 6),
      lastSeen: minutesAgo(120),
      active: true,
    },
    {
      type: IndicatorType.IP,
      value: IPS.takeover,
      threatType: "Account Takeover",
      confidence: 78,
      source: "simulated-feed",
      description: "IP associated with credential-stuffing and ATO activity.",
      firstSeen: minutesAgo(60 * 24 * 3),
      lastSeen: minutesAgo(300),
      active: true,
    },
    {
      type: IndicatorType.IP,
      value: IPS.apiAbuse,
      threatType: "Scanner",
      confidence: 64,
      source: "internal-honeypot",
      description: "High-volume API enumeration from a single host.",
      firstSeen: minutesAgo(60 * 24 * 2),
      lastSeen: minutesAgo(30),
      active: true,
    },
    {
      type: IndicatorType.DOMAIN,
      value: "malicious-update.example.com",
      threatType: "Malware C2",
      confidence: 91,
      source: "simulated-feed",
      description: "Domain used as a command-and-control callback.",
      firstSeen: minutesAgo(60 * 24 * 20),
      lastSeen: minutesAgo(60 * 24 * 2),
      active: true,
    },
    {
      type: IndicatorType.DOMAIN,
      value: "secure-login-verify.example.net",
      threatType: "Phishing",
      confidence: 88,
      source: "simulated-feed",
      description: "Credential harvesting page impersonating the SSO portal.",
      firstSeen: minutesAgo(60 * 24 * 10),
      lastSeen: minutesAgo(60 * 24),
      active: true,
    },
    {
      type: IndicatorType.HASH,
      value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      threatType: "Ransomware",
      confidence: 95,
      source: "simulated-feed",
      description: "SHA-256 of a known ransomware dropper.",
      firstSeen: minutesAgo(60 * 24 * 30),
      lastSeen: minutesAgo(60 * 24 * 5),
      active: true,
    },
    {
      type: IndicatorType.URL,
      value: "http://malicious-update.example.com/payload.bin",
      threatType: "Malware Distribution",
      confidence: 82,
      source: "simulated-feed",
      description: "Payload delivery URL referenced by phishing emails.",
      firstSeen: minutesAgo(60 * 24 * 12),
      lastSeen: minutesAgo(60 * 24 * 3),
      active: true,
    },
    {
      type: IndicatorType.IP,
      value: "203.0.113.9",
      threatType: "Historical",
      confidence: 30,
      source: "simulated-feed",
      description: "Previously flagged host; confidence decayed, retained for history.",
      firstSeen: minutesAgo(60 * 24 * 90),
      lastSeen: minutesAgo(60 * 24 * 60),
      active: false,
    },
  ];

  await prisma.threatIndicator.createMany({ data: indicators });
}

/**
 * Build the full set of security events. Returns a map of scenario name to the
 * ids of the events it produced, so alerts can be linked precisely.
 */
async function seedSecurityEvents() {
  const events: Prisma.SecurityEventCreateManyInput[] = [];
  const scenario: Record<string, string[]> = {};

  const track = (name: string, id: string) => {
    (scenario[name] ??= []).push(id);
  };

  const add = (name: string | null, event: Omit<Prisma.SecurityEventCreateManyInput, "id">) => {
    const id = nextId("evt");
    events.push({ id, ...event });
    if (name) track(name, id);
    return id;
  };

  // --- 1. Background / normal traffic over the last 7 days -------------------
  // Roughly 600 events give the dashboard realistic time-series and severity
  // distributions without loading thousands of rows into the browser.
  for (let i = 0; i < 600; i += 1) {
    const minutes = randInt(0, 60 * 24 * 7);
    const roll = random();
    const username = pick(NORMAL_USERNAMES);
    const sourceIp = pick(IPS.normal);

    if (roll < 0.35) {
      // Successful authentication.
      add(null, {
        timestamp: minutesAgo(minutes),
        source: "authentication-service",
        sourceType: SourceType.AUTH,
        eventType: "LOGIN_SUCCESS",
        severity: Severity.INFO,
        username,
        sourceIp,
        userAgent: pick(NORMAL_AGENTS),
        resource: "/login",
        action: "LOGIN",
        status: "SUCCESS",
        message: "User authenticated successfully",
      });
    } else if (roll < 0.5) {
      // Occasional legitimate failed login (typo, expired password).
      add(null, {
        timestamp: minutesAgo(minutes),
        source: "authentication-service",
        sourceType: SourceType.AUTH,
        eventType: "LOGIN_FAILED",
        severity: Severity.LOW,
        username,
        sourceIp,
        userAgent: pick(NORMAL_AGENTS),
        resource: "/login",
        action: "LOGIN",
        status: "FAILURE",
        message: "Invalid credentials supplied",
      });
    } else if (roll < 0.7) {
      // Normal web application request.
      add(null, {
        timestamp: minutesAgo(minutes),
        source: "web-application",
        sourceType: SourceType.WEB,
        eventType: "HTTP_REQUEST",
        severity: Severity.INFO,
        username,
        sourceIp,
        userAgent: pick(NORMAL_AGENTS),
        resource: pick(RESOURCES),
        action: "READ",
        status: "200",
        message: "Page served",
      });
    } else if (roll < 0.88) {
      // Normal API call.
      add(null, {
        timestamp: minutesAgo(minutes),
        source: "api-gateway",
        sourceType: SourceType.API,
        eventType: "API_REQUEST",
        severity: Severity.INFO,
        username,
        sourceIp,
        resource: "/api/v1/" + pick(["events", "alerts", "users", "reports"]),
        action: "READ",
        status: "200",
        message: "API request completed",
        metadata: { latencyMs: randInt(20, 240) },
      });
    } else {
      // Infrastructure heartbeat.
      add(null, {
        timestamp: minutesAgo(minutes),
        source: "server-agent",
        sourceType: SourceType.SERVER,
        eventType: "HEALTH_CHECK",
        severity: Severity.INFO,
        sourceIp,
        resource: pick(["cpu", "memory", "disk", "network"]),
        action: "MONITOR",
        status: "OK",
        message: "Resource utilisation within thresholds",
        metadata: { utilisation: randInt(5, 70) },
      });
    }
  }

  // --- 2. Brute force: 6 failures from one IP inside ~4 minutes -------------
  // Scenarios are timestamped within the last few minutes on purpose, so that a
  // real-time detection run at seed time genuinely re-detects them.
  for (let i = 0; i < 6; i += 1) {
    add("bruteForce", {
      timestamp: minutesAgo(4 - i * 0.6),
      source: "authentication-service",
      sourceType: SourceType.AUTH,
      eventType: "LOGIN_FAILED",
      severity: Severity.MEDIUM,
      username: "admin",
      sourceIp: IPS.bruteForce,
      userAgent: "python-requests/2.31",
      resource: "/login",
      action: "LOGIN",
      status: "FAILURE",
      message: "Failed authentication attempt",
      metadata: { attempt: i + 1, reason: "invalid_password" },
    });
  }

  // --- 3. Account takeover: failures then success from a new IP -------------
  for (let i = 0; i < 4; i += 1) {
    add("takeover", {
      timestamp: minutesAgo(8 - i * 0.5),
      source: "authentication-service",
      sourceType: SourceType.AUTH,
      eventType: "LOGIN_FAILED",
      severity: Severity.MEDIUM,
      username: "j.reyes",
      sourceIp: IPS.takeover,
      userAgent: "curl/8.4.0",
      resource: "/login",
      action: "LOGIN",
      status: "FAILURE",
      message: "Failed authentication attempt",
      metadata: { attempt: i + 1 },
    });
  }
  add("takeover", {
    timestamp: minutesAgo(5),
    source: "authentication-service",
    sourceType: SourceType.AUTH,
    eventType: "LOGIN_SUCCESS",
    severity: Severity.HIGH,
    username: "j.reyes",
    sourceIp: IPS.takeover,
    userAgent: "curl/8.4.0",
    resource: "/login",
    action: "LOGIN",
    status: "SUCCESS",
    message: "Authentication succeeded from a new source IP",
    metadata: { newIp: true, newDevice: true },
  });

  // --- 4. Privilege escalation ---------------------------------------------
  add("privilege", {
    timestamp: minutesAgo(3),
    source: "admin-console",
    sourceType: SourceType.APPLICATION,
    eventType: "USER_ROLE_CHANGED",
    severity: Severity.HIGH,
    username: "s.malik",
    sourceIp: IPS.normal[2],
    userAgent: pick(NORMAL_AGENTS),
    resource: "/users",
    action: "UPDATE",
    status: "SUCCESS",
    message: "Role changed from VIEWER to SECURITY_ANALYST",
    metadata: { previousRole: "VIEWER", newRole: "SECURITY_ANALYST", changedBy: "admin" },
  });
  add("privilege", {
    timestamp: minutesAgo(2.6),
    source: "admin-console",
    sourceType: SourceType.APPLICATION,
    eventType: "ADMIN_PRIVILEGE_GRANTED",
    severity: Severity.HIGH,
    username: "s.malik",
    sourceIp: IPS.normal[2],
    userAgent: pick(NORMAL_AGENTS),
    resource: "/users",
    action: "GRANT",
    status: "SUCCESS",
    message: "Administrative privilege granted to account",
    metadata: { grantedBy: "admin", scope: "platform" },
  });
  add("privilege", {
    timestamp: minutesAgo(2.2),
    source: "database",
    sourceType: SourceType.DATABASE,
    eventType: "ROLE_TABLE_UPDATE",
    severity: Severity.MEDIUM,
    username: "s.malik",
    sourceIp: IPS.normal[2],
    resource: "users-table",
    action: "WRITE",
    status: "SUCCESS",
    message: "User role column updated directly in the database",
  });

  // --- 5. API abuse: 120 requests from one IP within ~50 seconds ------------
  for (let i = 0; i < 120; i += 1) {
    add("apiAbuse", {
      timestamp: minutesAgo(0.9 - i * (50 / 120 / 60)),
      source: "api-gateway",
      sourceType: SourceType.API,
      eventType: "API_REQUEST",
      severity: i > 100 ? Severity.MEDIUM : Severity.LOW,
      username: null,
      sourceIp: IPS.apiAbuse,
      userAgent: "go-http-client/2.0",
      resource: "/api/v1/events",
      action: "READ",
      status: "200",
      message: "High-frequency API request",
      metadata: { sequence: i + 1 },
    });
  }

  // --- 6. Unauthorized access: repeated 401/403 ----------------------------
  for (let i = 0; i < 14; i += 1) {
    const status = i % 3 === 0 ? "403" : "401";
    add("unauthorized", {
      timestamp: minutesAgo(4 - i * 0.25),
      source: "api-gateway",
      sourceType: SourceType.API,
      eventType: "API_REQUEST",
      severity: Severity.MEDIUM,
      username: null,
      sourceIp: IPS.unauthorized,
      userAgent: "curl/8.4.0",
      resource: "/api/v1/users",
      action: "READ",
      status,
      message: status === "401" ? "Unauthenticated request rejected" : "Forbidden by policy",
    });
  }

  // --- 7. Sensitive resource access ----------------------------------------
  const sensitiveResources = ["/admin", "/users", "/config", "/database", ".env"];
  sensitiveResources.forEach((resource, index) => {
    add("sensitive", {
      timestamp: minutesAgo(4 - index * 0.3),
      source: "web-application",
      sourceType: SourceType.WEB,
      eventType: "HTTP_REQUEST",
      severity: Severity.HIGH,
      username: null,
      sourceIp: IPS.sensitive,
      userAgent: "Mozilla/5.0 (compatible; Scanner/1.0)",
      resource,
      action: "READ",
      status: resource === ".env" ? "403" : "200",
      message: `Access to sensitive resource ${resource}`,
    });
  });

  // --- 8. Suspicious login pattern (new IP + new device + prior failures) ---
  for (let i = 0; i < 3; i += 1) {
    add("suspicious", {
      timestamp: minutesAgo(4 - i * 0.3),
      source: "authentication-service",
      sourceType: SourceType.AUTH,
      eventType: "LOGIN_FAILED",
      severity: Severity.LOW,
      username: "a.khan",
      sourceIp: IPS.suspicious,
      userAgent: "Mozilla/5.0 (Unknown device)",
      resource: "/login",
      action: "LOGIN",
      status: "FAILURE",
      message: "Failed authentication attempt from unfamiliar device",
    });
  }
  add("suspicious", {
    timestamp: minutesAgo(3),
    source: "authentication-service",
    sourceType: SourceType.AUTH,
    eventType: "LOGIN_SUCCESS",
    severity: Severity.HIGH,
    username: "a.khan",
    sourceIp: IPS.suspicious,
    userAgent: "Mozilla/5.0 (Unknown device)",
    resource: "/login",
    action: "LOGIN",
    status: "SUCCESS",
    message: "Successful login from a new IP and new device outside normal hours",
    metadata: { newIp: true, newDevice: true, offHours: true },
  });

  await prisma.securityEvent.createMany({ data: events, skipDuplicates: true });
  return scenario;
}
/**
 * Run the detection engine over the freshly seeded events and apply analyst
 * triage (status, assignment, resolution) to the resulting alerts.
 *
 * Alerts are NOT hard-coded: they are produced by the real detection engine
 * evaluating the real seeded rules against the real seeded events. The seed
 * only layers on the human workflow state (who is investigating, what was
 * resolved) so the alert and incident screens have realistic data.
 *
 * Connection: server/detection (runDetection) -> database/client.ts (Alert).
 */
async function seedDetectedAlerts(users: Awaited<ReturnType<typeof seedUsers>>) {
  const run = await runDetection({ to: new Date() });
  if (run.errors.length > 0) {
    console.warn("Securis seed: detection reported errors:", run.errors);
  }

  // Load the engine-created alerts together with the rule that produced them.
  const alerts = await prisma.alert.findMany({
    where: { dedupeKey: { not: null } },
    include: { rule: { select: { code: true } } },
  });

  /** Triage applied per rule so the UI shows a realistic mix of statuses. */
  const triage: Record<
    string,
    { status: AlertStatus; assignTo?: string; resolve?: boolean }
  > = {
    BRUTE_FORCE_001: { status: AlertStatus.INVESTIGATING, assignTo: users.analyst.id },
    ACCOUNT_TAKEOVER_001: { status: AlertStatus.NEW },
    PRIVILEGE_ESCALATION_001: {
      status: AlertStatus.INVESTIGATING,
      assignTo: users.analyst2.id,
    },
    API_ABUSE_001: {
      status: AlertStatus.RESOLVED,
      assignTo: users.analyst.id,
      resolve: true,
    },
    UNAUTHORIZED_ACCESS_001: { status: AlertStatus.NEW },
    SENSITIVE_RESOURCE_ACCESS_001: {
      status: AlertStatus.FALSE_POSITIVE,
      assignTo: users.analyst2.id,
      resolve: true,
    },
    SUSPICIOUS_LOGIN_PATTERN_001: { status: AlertStatus.NEW },
  };

  const updated = [];
  for (const alert of alerts) {
    const plan = alert.rule ? triage[alert.rule.code] : undefined;
    const record = await prisma.alert.update({
      where: { id: alert.id },
      data: {
        status: plan?.status ?? AlertStatus.NEW,
        assignedToId: plan?.assignTo ?? null,
        resolvedAt: plan?.resolve ? new Date() : null,
      },
      include: { rule: { select: { code: true } } },
    });
    updated.push(record);
  }

  return updated;
}

async function seedIncidents(
  alerts: Awaited<ReturnType<typeof seedDetectedAlerts>>,
  users: Awaited<ReturnType<typeof seedUsers>>,
  scenario: Record<string, string[]>,
) {
  const byRule = (code: string) => alerts.find((alert) => alert.rule?.code === code);
  const link = (name: string) => (scenario[name] ?? []).map((id) => ({ id }));

  const bruteForce = byRule("BRUTE_FORCE_001");
  const takeover = byRule("ACCOUNT_TAKEOVER_001");
  const apiAbuse = byRule("API_ABUSE_001");
  const sensitive = byRule("SENSITIVE_RESOURCE_ACCESS_001");

  const incidents = [
    {
      reference: "INC-2026-001",
      title: "Coordinated credential attack against admin accounts",
      description:
        "A brute force campaign against the 'admin' account was followed by a successful authentication for 'j.reyes' from a different external IP. Treated as a single coordinated credential attack.",
      severity: Severity.CRITICAL,
      status: IncidentStatus.INVESTIGATING,
      assignedToId: users.analyst.id,
      alerts: [bruteForce, takeover].filter(Boolean).map((a) => ({ id: a!.id })),
      // The incident's timeline is the union of both attack scenarios' events.
      events: [...link("bruteForce"), ...link("takeover")],
    },
    {
      reference: "INC-2026-002",
      title: "High-volume API enumeration from a single host",
      description:
        "An external host issued over 100 requests per minute against the events API. Rate limiting contained the activity.",
      severity: Severity.MEDIUM,
      status: IncidentStatus.CONTAINED,
      assignedToId: users.analyst2.id,
      alerts: [apiAbuse].filter(Boolean).map((a) => ({ id: a!.id })),
      events: link("apiAbuse"),
    },
    {
      reference: "INC-2026-003",
      title: "Sensitive resource reconnaissance",
      description:
        "Sequential probing of administrative and configuration paths. Determined to be an authorised internal penetration test; closed as a false positive.",
      severity: Severity.HIGH,
      status: IncidentStatus.CLOSED,
      assignedToId: users.analyst.id,
      resolution:
        "Confirmed as an authorised internal penetration test. No action required; detection tuned to exclude the tester's source IP.",
      resolvedAt: minutesAgo(280),
      alerts: [sensitive].filter(Boolean).map((a) => ({ id: a!.id })),
      events: link("sensitive"),
    },
  ];

  const created = [];
  for (const incident of incidents) {
    const { alerts: incidentAlerts, events: incidentEvents, ...data } = incident;
    const record = await prisma.incident.create({
      data: {
        ...data,
        alerts: incidentAlerts.length ? { connect: incidentAlerts } : undefined,
        events: incidentEvents.length ? { connect: incidentEvents } : undefined,
      },
    });
    created.push(record);
  }
  return created;
}

async function seedNotes(
  alerts: Awaited<ReturnType<typeof seedDetectedAlerts>>,
  incidents: Awaited<ReturnType<typeof seedIncidents>>,
  users: Awaited<ReturnType<typeof seedUsers>>,
) {
  const bruteForce = alerts.find((alert) => alert.rule?.code === "BRUTE_FORCE_001");
  const takeover = alerts.find((alert) => alert.rule?.code === "ACCOUNT_TAKEOVER_001");
  const incident1 = incidents.find((i) => i.reference === "INC-2026-001");

  const alertNotes: Prisma.AlertNoteCreateManyInput[] = [];
  if (bruteForce) {
    alertNotes.push({
      alertId: bruteForce.id,
      authorId: users.analyst.id,
      body: "Confirmed the source IP is listed in local threat intelligence. Blocked at the edge firewall pending further review.",
      createdAt: minutesAgo(110),
    });
  }
  if (takeover) {
    alertNotes.push({
      alertId: takeover.id,
      authorId: users.admin.id,
      body: "Account credentials reset and all active sessions revoked. Escalating to an incident.",
      createdAt: minutesAgo(290),
    });
  }
  if (alertNotes.length) {
    await prisma.alertNote.createMany({ data: alertNotes });
  }

  if (incident1) {
    await prisma.incidentNote.createMany({
      data: [
        {
          incidentId: incident1.id,
          authorId: users.analyst.id,
          body: "Correlated the two alerts: the brute force and the takeover share a similar user-agent family. Investigating whether the same actor is responsible.",
          createdAt: minutesAgo(115),
        },
        {
          incidentId: incident1.id,
          authorId: users.admin.id,
          body: "Containment step applied: forced password reset for all accounts in the admin group.",
          createdAt: minutesAgo(100),
        },
      ],
    });
  }
}

async function seedSessions(users: Awaited<ReturnType<typeof seedUsers>>) {
  // Session tokens are opaque; only their hash is stored. These are fabricated
  // hashes because seed sessions are illustrative, not usable credentials.
  await prisma.loginSession.createMany({
    data: [
      {
        userId: users.admin.id,
        tokenHash: "seed-session-hash-admin-active",
        ipAddress: IPS.normal[0],
        userAgent: NORMAL_AGENTS[0],
        createdAt: minutesAgo(35),
        lastSeenAt: minutesAgo(2),
        expiresAt: minutesAgo(-445),
      },
      {
        userId: users.analyst.id,
        tokenHash: "seed-session-hash-analyst-active",
        ipAddress: IPS.normal[1],
        userAgent: NORMAL_AGENTS[1],
        createdAt: minutesAgo(120),
        lastSeenAt: minutesAgo(10),
        expiresAt: minutesAgo(-360),
      },
      {
        userId: users.viewer.id,
        tokenHash: "seed-session-hash-viewer-expired",
        ipAddress: IPS.normal[2],
        userAgent: NORMAL_AGENTS[2],
        createdAt: minutesAgo(700),
        lastSeenAt: minutesAgo(620),
        expiresAt: minutesAgo(200),
      },
      {
        userId: users.analyst2.id,
        tokenHash: "seed-session-hash-analyst2-revoked",
        ipAddress: IPS.normal[3],
        userAgent: NORMAL_AGENTS[0],
        createdAt: minutesAgo(1500),
        lastSeenAt: minutesAgo(1400),
        expiresAt: minutesAgo(-60),
        revokedAt: minutesAgo(1300),
      },
    ],
  });
}

async function seedAuditLogs(
  users: Awaited<ReturnType<typeof seedUsers>>,
  rules: { id: string; code: string }[],
  alerts: Awaited<ReturnType<typeof seedDetectedAlerts>>,
  incidents: Awaited<ReturnType<typeof seedIncidents>>,
) {
  const logs: Prisma.AuditLogCreateManyInput[] = [];
  const push = (log: Omit<Prisma.AuditLogCreateManyInput, "id">) => {
    logs.push({ id: nextId("aud"), ...log });
  };

  // Authentication events.
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.LOGIN_SUCCESS,
    ipAddress: IPS.normal[0],
    userAgent: NORMAL_AGENTS[0],
    createdAt: minutesAgo(35),
  });
  push({
    actorId: users.analyst.id,
    actorEmail: users.analyst.email,
    action: AuditAction.LOGIN_SUCCESS,
    ipAddress: IPS.normal[1],
    userAgent: NORMAL_AGENTS[1],
    createdAt: minutesAgo(120),
  });
  push({
    actorEmail: "unknown@external.example",
    action: AuditAction.LOGIN_FAILED,
    ipAddress: IPS.bruteForce,
    userAgent: "python-requests/2.31",
    metadata: { targetEmail: "admin@securis.local", reason: "invalid_password" },
    createdAt: minutesAgo(124),
  });
  push({
    actorId: users.viewer.id,
    actorEmail: users.viewer.email,
    action: AuditAction.LOGOUT,
    ipAddress: IPS.normal[2],
    createdAt: minutesAgo(620),
  });
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.SESSION_CREATED,
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(35),
  });
  push({
    actorId: users.viewer.id,
    actorEmail: users.viewer.email,
    action: AuditAction.SESSION_EXPIRED,
    ipAddress: IPS.normal[2],
    metadata: { reason: "ttl_elapsed" },
    createdAt: minutesAgo(200),
  });
  push({
    actorId: users.analyst2.id,
    actorEmail: users.analyst2.email,
    action: AuditAction.SESSION_REVOKED,
    ipAddress: IPS.normal[3],
    metadata: { revokedBy: "admin" },
    createdAt: minutesAgo(1300),
  });

  // User administration.
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.USER_CREATED,
    targetType: "User",
    targetId: users.analyst2.id,
    targetLabel: users.analyst2.email,
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 48),
  });
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.ROLE_CHANGED,
    targetType: "User",
    targetId: users.analyst2.id,
    targetLabel: users.analyst2.email,
    metadata: { from: "VIEWER", to: "SECURITY_ANALYST" },
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 24),
  });
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.USER_DISABLED,
    targetType: "User",
    targetId: users.disabled.id,
    targetLabel: users.disabled.email,
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 24 * 5),
  });

  // Detection rule lifecycle.
  for (const rule of rules) {
    push({
      actorId: users.admin.id,
      actorEmail: users.admin.email,
      action: AuditAction.RULE_CREATED,
      targetType: "DetectionRule",
      targetId: rule.id,
      targetLabel: rule.code,
      ipAddress: IPS.normal[0],
      createdAt: minutesAgo(60 * 24 * 7),
    });
  }
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.RULE_ENABLED,
    targetType: "DetectionRule",
    targetId: rules[0]?.id,
    targetLabel: rules[0]?.code,
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 24 * 6),
  });

  // Detection + response lifecycle.
  for (const alert of alerts) {
    push({
      actorId: users.admin.id,
      actorEmail: users.admin.email,
      action: AuditAction.ALERT_CREATED,
      targetType: "Alert",
      targetId: alert.id,
      targetLabel: alert.title,
      ipAddress: "127.0.0.1",
      metadata: { ruleCode: alert.ruleId, riskScore: alert.riskScore },
      createdAt: alert.firstSeen,
    });
  }
  for (const incident of incidents) {
    push({
      actorId: incident.assignedToId ?? users.admin.id,
      actorEmail: users.admin.email,
      action: AuditAction.INCIDENT_CREATED,
      targetType: "Incident",
      targetId: incident.id,
      targetLabel: incident.reference,
      ipAddress: IPS.normal[0],
      createdAt: incident.createdAt,
    });
  }
  const closedIncident = incidents.find((i) => i.status === IncidentStatus.CLOSED);
  if (closedIncident) {
    push({
      actorId: users.analyst.id,
      actorEmail: users.analyst.email,
      action: AuditAction.INCIDENT_RESOLVED,
      targetType: "Incident",
      targetId: closedIncident.id,
      targetLabel: closedIncident.reference,
      metadata: { resolution: "authorised penetration test" },
      ipAddress: IPS.normal[1],
      createdAt: minutesAgo(280),
    });
  }

  // Threat intelligence.
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.THREAT_INDICATOR_ADDED,
    targetType: "ThreatIndicator",
    targetLabel: IPS.bruteForce,
    metadata: { type: "IP", confidence: 85 },
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 24 * 6),
  });
  push({
    actorId: users.admin.id,
    actorEmail: users.admin.email,
    action: AuditAction.THREAT_INDICATOR_ADDED,
    targetType: "ThreatIndicator",
    targetLabel: "malicious-update.example.com",
    metadata: { type: "DOMAIN", confidence: 91 },
    ipAddress: IPS.normal[0],
    createdAt: minutesAgo(60 * 24 * 6),
  });

  await prisma.auditLog.createMany({ data: logs });
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

async function main() {
  console.log("Securis seed: resetting database...");
  await resetDatabase();

  console.log("Securis seed: users...");
  const users = await seedUsers();

  console.log("Securis seed: detection rules...");
  const rules = await seedDetectionRules(users.admin.id);

  console.log("Securis seed: threat intelligence...");
  await seedThreatIndicators();

  console.log("Securis seed: security events...");
  const scenario = await seedSecurityEvents();

  console.log("Securis seed: alerts (running detection engine)...");
  const alerts = await seedDetectedAlerts(users);

  console.log("Securis seed: incidents...");
  const incidents = await seedIncidents(alerts, users, scenario);

  console.log("Securis seed: notes...");
  await seedNotes(alerts, incidents, users);

  console.log("Securis seed: login sessions...");
  await seedSessions(users);

  console.log("Securis seed: audit logs...");
  await seedAuditLogs(users, rules, alerts, incidents);

  const counts = {
    users: await prisma.user.count(),
    rules: await prisma.detectionRule.count(),
    indicators: await prisma.threatIndicator.count(),
    events: await prisma.securityEvent.count(),
    alerts: await prisma.alert.count(),
    incidents: await prisma.incident.count(),
    sessions: await prisma.loginSession.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("Securis seed complete:", counts);
  console.log(
    "Login credentials (development only):\n" +
      `  ADMIN            admin@securis.local / ${SEED_PASSWORDS.admin}\n` +
      `  SECURITY_ANALYST analyst@securis.local / ${SEED_PASSWORDS.analyst}\n` +
      `  VIEWER           viewer@securis.local / ${SEED_PASSWORDS.viewer}`,
  );
}

main()
  .catch((error) => {
    console.error("Securis seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });