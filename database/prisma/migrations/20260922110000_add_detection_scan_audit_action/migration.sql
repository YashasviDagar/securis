-- Securis - Add the DETECTION_SCAN audit action
--
-- Records on-demand detection runs triggered via POST /api/detection/scan,
-- distinct from EVENT_INGESTED (pipeline-driven) and SIMULATION_RUN (Phase 14).

ALTER TYPE "AuditAction" ADD VALUE 'DETECTION_SCAN';
