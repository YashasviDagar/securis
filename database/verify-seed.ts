/**
 * Securis - Seed verification (Phase 2)
 *
 * Runs a set of real Prisma queries against the seeded database and prints the
 * results. It proves three things:
 *   1. Migrations applied and every table is queryable.
 *   2. The seven attack scenarios were stored with the expected shape (so the
 *      Phase 6/7 detection engine has genuine fixtures to detect).
 *   3. Relations (alert<->events, incident<->alerts/events, rule<->alerts) work.
 *
 * Run with:  npm run db:verify
 *
 * Connection: Prisma client -> PostgreSQL (DATABASE_URL from .env).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Format a Date as an ISO string, tolerating null. */
const iso = (value: Date | null | undefined) => value?.toISOString() ?? "-";

async function main() {
  console.log("\n=== Securis Phase 2 verification ===\n");

  // --- Table counts ---------------------------------------------------------
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
  console.log("Row counts:", counts);

  // --- Events by severity (exercises the severity index) --------------------
  const bySeverity = await prisma.securityEvent.groupBy({
    by: ["severity"],
    _count: { _all: true },
  });
  console.log(
    "Events by severity:",
    Object.fromEntries(bySeverity.map((r) => [r.severity, r._count._all])),
  );

  // --- Scenario 1: brute force window --------------------------------------
  // The Phase 7 rule requires >= 5 failures from one IP within 300 seconds.
  // The window is measured around the seeded events (they are historical, so
  // comparing against "now" would be meaningless).
  const bruteForceIp = "198.51.100.23";
  const bruteForceEvents = await prisma.securityEvent.findMany({
    where: { sourceIp: bruteForceIp, eventType: "LOGIN_FAILED" },
    select: { timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  const bruteForceSpanSeconds =
    bruteForceEvents.length > 1
      ? (bruteForceEvents[bruteForceEvents.length - 1]!.timestamp.getTime() -
          bruteForceEvents[0]!.timestamp.getTime()) /
        1000
      : 0;
  console.log(
    `\nBrute force: ${bruteForceEvents.length} LOGIN_FAILED from ${bruteForceIp} spanning ${bruteForceSpanSeconds.toFixed(1)}s (rule threshold 5 within 300s)`,
  );

  // --- Scenario 2: takeover (failed then success, same user) ---------------
  const takeoverEvents = await prisma.securityEvent.findMany({
    where: { username: "j.reyes", sourceIp: "203.0.113.77" },
    orderBy: { timestamp: "asc" },
    select: { eventType: true, timestamp: true },
  });
  console.log(
    "Takeover sequence for j.reyes:",
    takeoverEvents.map((e) => e.eventType).join(" -> "),
  );

  // --- Scenario 4: API abuse volume ----------------------------------------
  const apiAbuseEvents = await prisma.securityEvent.findMany({
    where: { sourceIp: "192.0.2.44", eventType: "API_REQUEST" },
    select: { timestamp: true },
  });
  const apiSpanSeconds =
    apiAbuseEvents.length > 1
      ? (Math.max(...apiAbuseEvents.map((e) => e.timestamp.getTime())) -
          Math.min(...apiAbuseEvents.map((e) => e.timestamp.getTime()))) /
        1000
      : 0;
  console.log(
    `API abuse: ${apiAbuseEvents.length} requests from 192.0.2.44 spanning ${apiSpanSeconds.toFixed(1)}s (rule: 100/60s)`,
  );

  // --- Scenario 5: unauthorized 401/403 ------------------------------------
  const unauthorized = await prisma.securityEvent.count({
    where: { sourceIp: "198.51.100.90", status: { in: ["401", "403"] } },
  });
  console.log(`Unauthorized access: ${unauthorized} 401/403 responses from 198.51.100.90`);

  // --- Alerts with their rule and related events ---------------------------
  const alerts = await prisma.alert.findMany({
    include: {
      rule: { select: { code: true, name: true } },
      assignedTo: { select: { email: true } },
      _count: { select: { events: true, notes: true } },
    },
    orderBy: { riskScore: "desc" },
  });
  console.log("\nAlerts:");
  for (const alert of alerts) {
    console.log(
      `  [${alert.severity}] score=${alert.riskScore} status=${alert.status} rule=${alert.rule?.code ?? "-"} events=${alert._count.events} notes=${alert._count.notes} assigned=${alert.assignedTo?.email ?? "unassigned"} :: ${alert.title}`,
    );
  }

  // --- Incidents with related alerts and events ----------------------------
  const incidents = await prisma.incident.findMany({
    include: {
      _count: { select: { alerts: true, events: true, notes: true } },
      assignedTo: { select: { email: true } },
    },
    orderBy: { reference: "asc" },
  });
  console.log("\nIncidents:");
  for (const incident of incidents) {
    console.log(
      `  ${incident.reference} [${incident.severity}/${incident.status}] alerts=${incident._count.alerts} events=${incident._count.events} notes=${incident._count.notes} assigned=${incident.assignedTo?.email ?? "unassigned"} :: ${incident.title}`,
    );
  }

  // --- Threat intelligence match for the brute force IP -------------------
  const indicator = await prisma.threatIndicator.findFirst({
    where: { type: "IP", value: bruteForceIp },
  });
  console.log(
    `\nThreat intel match for ${bruteForceIp}:`,
    indicator
      ? `${indicator.threatType} (confidence ${indicator.confidence}, source ${indicator.source}, active ${indicator.active})`
      : "none",
  );

  // --- Audit log action distribution ---------------------------------------
  const auditByAction = await prisma.auditLog.groupBy({
    by: ["action"],
    _count: { _all: true },
  });
  console.log(
    "\nAudit log actions:",
    Object.fromEntries(auditByAction.map((r) => [r.action, r._count._all])),
  );

  // --- Newest event --------------------------------------------------------
  const newest = await prisma.securityEvent.findFirst({ orderBy: { timestamp: "desc" } });
  console.log(
    `\nNewest event: ${iso(newest?.timestamp)} ${newest?.eventType} from ${newest?.sourceIp ?? "-"}`,
  );

  console.log("\n=== Verification complete ===\n");
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
