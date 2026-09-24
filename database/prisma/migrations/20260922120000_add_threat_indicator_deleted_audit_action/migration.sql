-- Securis - Add the THREAT_INDICATOR_DELETED audit action
--
-- Records removal of a local threat-intelligence indicator. Retiring an
-- indicator (active = false) is recorded as THREAT_INDICATOR_UPDATED instead.

ALTER TYPE "AuditAction" ADD VALUE 'THREAT_INDICATOR_DELETED';
