// Adapter — re-exports from legacy until regions are read from `station_channels` table.
export {
  DRC_REGIONS,
  DRC_COUNTRY,
  PRIME_TIMES,
  isPrimeTime,
  getDRCHour,
  getRegionBySlug,
  getRegionVoiceLang,
} from '../_legacy/lib/drcRegions';
export type { DCRegion, DRCAnchoredLanguage } from '../_legacy/lib/drcRegions';
