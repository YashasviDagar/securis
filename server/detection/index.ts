/**
 * Securis - Detection engine public API
 *
 * Everything outside the detection module imports from here so the internal
 * layout (evaluators, helpers) can change freely.
 *
 * Connection: server/ingestion/pipeline.ts, app/api/detection/scan/route.ts,
 * Phase 14 simulation lab.
 */
export { runDetection } from "./engine";
export type { RunDetectionOptions } from "./engine";
