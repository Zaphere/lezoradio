import type { NewsItem, NewsCategory, StationRecord } from './types';

/** Maps a station to the slug used in news_items.region */
const STATION_NEWS_REGION: Record<string, string> = {
  'South Africa': 'south-africa',
  'DR Congo': 'congo',
  'Congo': 'congo',
  'Tanzania': 'tanzania',
  'Eswatini': 'eswatini',
};

/** Macro broadcast area → news region slugs that belong to it */
const MACRO_NEWS_REGIONS: Record<string, string[]> = {
  'Southern Africa': ['south-africa', 'eswatini', 'zambia', 'malawi', 'botswana', 'namibia', 'mozambique'],
  'Central Africa': ['congo', 'cameroon', 'gabon', 'chad'],
  'East Africa': ['tanzania', 'kenya', 'uganda', 'rwanda', 'burundi', 'south-sudan'],
  'North Africa': ['egypt', 'algeria', 'morocco', 'tunisia'],
};

export function getStationNewsRegion(station: Pick<StationRecord, 'name' | 'country'>): string {
  if (STATION_NEWS_REGION[station.name]) return STATION_NEWS_REGION[station.name];
  return station.country.toLowerCase().replace(/\s+/g, '-');
}

function macroRegionsFor(station: Pick<StationRecord, 'region'>): string[] {
  return MACRO_NEWS_REGIONS[station.region] ?? [];
}

function isInStationArea(item: NewsItem, station: Pick<StationRecord, 'name' | 'country' | 'region'>): boolean {
  const slug = getStationNewsRegion(station);
  if (item.region === slug) return true;
  if (item.region === 'global') return true;
  return macroRegionsFor(station).includes(item.region);
}

function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterNewsForStation(
  items: NewsItem[],
  station: Pick<StationRecord, 'name' | 'country' | 'region'>,
  category?: NewsCategory,
): NewsItem[] {
  const slug = getStationNewsRegion(station);
  const macro = macroRegionsFor(station);
  const isGlobalChannel = !station.region;

  let filtered: NewsItem[];

  if (category === 'global') {
    filtered = items.filter((i) => i.category === 'global');
  } else if (category === 'regional') {
    filtered = isGlobalChannel
      ? items.filter((i) => i.category === 'regional')
      : items.filter(
          (i) => i.category === 'regional' && (i.region === slug || macro.includes(i.region)),
        );
  } else if (category === 'local') {
    filtered = items.filter((i) => i.category === 'local' && i.region === slug);
  } else if (category === 'traffic') {
    filtered = isGlobalChannel
      ? items.filter((i) => i.category === 'traffic')
      : items.filter(
          (i) => i.category === 'traffic' && (i.region === slug || macro.includes(i.region)),
        );
  } else if (category === 'alert') {
    filtered = isGlobalChannel
      ? items.filter((i) => i.category === 'alert')
      : items.filter(
          (i) => i.category === 'alert' && (i.region === slug || macro.includes(i.region)),
        );
  } else {
    filtered = items.filter((i) => {
      if (i.category === 'global') return true;
      if (i.category === 'regional') return isGlobalChannel || i.region === slug || macro.includes(i.region);
      if (i.category === 'local') return i.region === slug;
      if (i.category === 'traffic' || i.category === 'alert') return true;
      return isGlobalChannel || isInStationArea(i, station);
    });
  }

  return deduplicateByUrl(filtered);
}
