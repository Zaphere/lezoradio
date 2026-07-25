// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
export type DRCAnchoredLanguage = 'lingala' | 'swahili' | 'french';

export interface DCRegion {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  language: DRCAnchoredLanguage;
  voiceLang: string;
  description: string;
  timezone: string;
}

export const DRC_REGIONS: DCRegion[] = [
  {
    id: 'kinshasa',
    name: 'Kinshasa',
    slug: 'kinshasa',
    emoji: '\uD83C\uDFD9\uFE0F',
    language: 'lingala',
    voiceLang: 'ln-CD',
    description: 'Lingala — Capital Region',
    timezone: 'Africa/Kinshasa',
  },
  {
    id: 'goma',
    name: 'Goma',
    slug: 'goma',
    emoji: '\uD83C\uDF0B',
    language: 'swahili',
    voiceLang: 'sw-CD',
    description: 'Swahili — Eastern DRC',
    timezone: 'Africa/Maputo',
  },
  {
    id: 'lubumbashi',
    name: 'Lubumbashi',
    slug: 'lubumbashi',
    emoji: '\u26CF\uFE0F',
    language: 'swahili',
    voiceLang: 'sw-CD',
    description: 'Swahili — Southern DRC',
    timezone: 'Africa/Maputo',
  },
];

export const DRC_COUNTRY = {
  name: 'DR Congo',
  slug: 'drc',
  emoji: '\uD83C\uDDE8\uD83C\uDDE9',
  countryCode: 'CD',
};

export const PRIME_TIMES = [6, 9, 12, 15, 18, 21];

export function isPrimeTime(date: Date = new Date()): boolean {
  const drcHour = (date.getUTCHours() + 2) % 24;
  return PRIME_TIMES.includes(drcHour);
}

export function getDRCHour(date: Date = new Date()): number {
  return (date.getUTCHours() + 2) % 24;
}

export function getRegionBySlug(slug: string): DCRegion | undefined {
  return DRC_REGIONS.find((r) => r.slug === slug);
}

export function getRegionVoiceLang(region: DCRegion): string {
  if (isPrimeTime()) return 'fr-FR';
  return region.voiceLang;
}
