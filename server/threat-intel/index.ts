/**
 * Securis - Threat intelligence public API
 *
 * The single entry point for the threat-intelligence module. The detection
 * engine imports `matchIndicator`; the API routes import the CRUD service.
 * External feed integrations belong behind this boundary too, so no feed
 * credentials or provider-specific code leaks into detection or UI code.
 */
export { matchIndicator } from "./matcher";
export type { IndicatorMatch, IndicatorQuery as IndicatorLookupQuery } from "./matcher";
export {
  listIndicators,
  getIndicatorById,
  getIndicatorFacets,
  createIndicator,
  updateIndicator,
  deleteIndicator,
} from "./service";
export type { WriteResult } from "./service";
