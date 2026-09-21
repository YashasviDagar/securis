-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECURITY_ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('AUTH', 'WEB', 'API', 'SERVER', 'DATABASE', 'NETWORK', 'INFRASTRUCTURE', 'APPLICATION');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IndicatorType" AS ENUM ('IP', 'DOMAIN', 'HASH', 'URL');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('EVENT_MATCH', 'THRESHOLD', 'TIME_WINDOW', 'CORRELATION', 'USER_BASED', 'IP_BASED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'SESSION_CREATED', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_ENABLED', 'USER_DISABLED', 'ROLE_CHANGED', 'ALERT_CREATED', 'ALERT_UPDATED', 'ALERT_ASSIGNED', 'ALERT_STATUS_CHANGED', 'ALERT_NOTE_ADDED', 'INCIDENT_CREATED', 'INCIDENT_UPDATED', 'INCIDENT_RESOLVED', 'INCIDENT_CLOSED', 'INCIDENT_NOTE_ADDED', 'RULE_CREATED', 'RULE_UPDATED', 'RULE_ENABLED', 'RULE_DISABLED', 'RULE_DELETED', 'THREAT_INDICATOR_ADDED', 'THREAT_INDICATOR_UPDATED', 'EVENT_INGESTED', 'SIMULATION_RUN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "username" TEXT,
    "sourceIp" TEXT,
    "destinationIp" TEXT,
    "userAgent" TEXT,
    "resource" TEXT,
    "action" TEXT,
    "status" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectionRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "condition" JSONB NOT NULL,
    "threshold" INTEGER,
    "timeWindowSeconds" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFactors" JSONB,
    "sourceIp" TEXT,
    "targetUser" TEXT,
    "ruleId" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertNote" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentNote" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatIndicator" (
    "id" TEXT NOT NULL,
    "type" "IndicatorType" NOT NULL,
    "value" TEXT NOT NULL,
    "threatType" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AlertToSecurityEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlertToSecurityEvent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AlertToIncident" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlertToIncident_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_IncidentToSecurityEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IncidentToSecurityEvent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginSession_tokenHash_key" ON "LoginSession"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginSession_userId_idx" ON "LoginSession"("userId");

-- CreateIndex
CREATE INDEX "LoginSession_expiresAt_idx" ON "LoginSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginSession_createdAt_idx" ON "LoginSession"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_timestamp_idx" ON "SecurityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_sourceIp_idx" ON "SecurityEvent"("sourceIp");

-- CreateIndex
CREATE INDEX "SecurityEvent_username_idx" ON "SecurityEvent"("username");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_idx" ON "SecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_source_idx" ON "SecurityEvent"("source");

-- CreateIndex
CREATE INDEX "SecurityEvent_sourceType_idx" ON "SecurityEvent"("sourceType");

-- CreateIndex
CREATE INDEX "SecurityEvent_sourceIp_timestamp_idx" ON "SecurityEvent"("sourceIp", "timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_username_timestamp_idx" ON "SecurityEvent"("username", "timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_timestamp_idx" ON "SecurityEvent"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_timestamp_idx" ON "SecurityEvent"("severity", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DetectionRule_code_key" ON "DetectionRule"("code");

-- CreateIndex
CREATE INDEX "DetectionRule_enabled_idx" ON "DetectionRule"("enabled");

-- CreateIndex
CREATE INDEX "DetectionRule_ruleType_idx" ON "DetectionRule"("ruleType");

-- CreateIndex
CREATE INDEX "DetectionRule_severity_idx" ON "DetectionRule"("severity");

-- CreateIndex
CREATE INDEX "DetectionRule_createdAt_idx" ON "DetectionRule"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_sourceIp_idx" ON "Alert"("sourceIp");

-- CreateIndex
CREATE INDEX "Alert_targetUser_idx" ON "Alert"("targetUser");

-- CreateIndex
CREATE INDEX "Alert_ruleId_idx" ON "Alert"("ruleId");

-- CreateIndex
CREATE INDEX "Alert_assignedToId_idx" ON "Alert"("assignedToId");

-- CreateIndex
CREATE INDEX "Alert_firstSeen_idx" ON "Alert"("firstSeen");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_status_severity_idx" ON "Alert"("status", "severity");

-- CreateIndex
CREATE INDEX "AlertNote_alertId_createdAt_idx" ON "AlertNote"("alertId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertNote_authorId_idx" ON "AlertNote"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_reference_key" ON "Incident"("reference");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_assignedToId_idx" ON "Incident"("assignedToId");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "Incident_status_severity_idx" ON "Incident"("status", "severity");

-- CreateIndex
CREATE INDEX "IncidentNote_incidentId_createdAt_idx" ON "IncidentNote"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentNote_authorId_idx" ON "IncidentNote"("authorId");

-- CreateIndex
CREATE INDEX "ThreatIndicator_value_idx" ON "ThreatIndicator"("value");

-- CreateIndex
CREATE INDEX "ThreatIndicator_type_idx" ON "ThreatIndicator"("type");

-- CreateIndex
CREATE INDEX "ThreatIndicator_confidence_idx" ON "ThreatIndicator"("confidence");

-- CreateIndex
CREATE INDEX "ThreatIndicator_active_idx" ON "ThreatIndicator"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ThreatIndicator_type_value_key" ON "ThreatIndicator"("type", "value");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_ipAddress_idx" ON "AuditLog"("ipAddress");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "_AlertToSecurityEvent_B_index" ON "_AlertToSecurityEvent"("B");

-- CreateIndex
CREATE INDEX "_AlertToIncident_B_index" ON "_AlertToIncident"("B");

-- CreateIndex
CREATE INDEX "_IncidentToSecurityEvent_B_index" ON "_IncidentToSecurityEvent"("B");

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionRule" ADD CONSTRAINT "DetectionRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DetectionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNote" ADD CONSTRAINT "AlertNote_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNote" ADD CONSTRAINT "AlertNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentNote" ADD CONSTRAINT "IncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentNote" ADD CONSTRAINT "IncidentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertToSecurityEvent" ADD CONSTRAINT "_AlertToSecurityEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertToSecurityEvent" ADD CONSTRAINT "_AlertToSecurityEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "SecurityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertToIncident" ADD CONSTRAINT "_AlertToIncident_A_fkey" FOREIGN KEY ("A") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertToIncident" ADD CONSTRAINT "_AlertToIncident_B_fkey" FOREIGN KEY ("B") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentToSecurityEvent" ADD CONSTRAINT "_IncidentToSecurityEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentToSecurityEvent" ADD CONSTRAINT "_IncidentToSecurityEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "SecurityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
