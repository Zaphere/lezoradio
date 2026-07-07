import type { NewsItem, NewsCategory, StationRecord } from './types';

const STATION_NEWS_REGION: Record<string, string> = {
  'DRC': 'congo',
  'DR Congo': 'congo',
  'Congo': 'congo',
};

const DRC_SECONDARY_REGIONS: Record<string, string[]> = {
  kinshasa: ['central-africa'],
  goma: ['central-africa', 'east-africa'],
  lubumbashi: ['central-africa', 'southern-africa'],
};

function getStationNewsRegion(station: Pick<StationRecord, 'name' | 'country'>): string {
  if (STATION_NEWS_REGION[station.name]) return STATION_NEWS_REGION[station.name];
  return station.country.toLowerCase().replace(/\s+/g, '-');
}

function getSecondaryRegions(station: Pick<StationRecord, 'region'>): string[] {
  if (station.region && DRC_SECONDARY_REGIONS[station.region]) {
    return DRC_SECONDARY_REGIONS[station.region];
  }
  return ['central-africa'];
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
  const secondary = getSecondaryRegions(station);

  let filtered: NewsItem[];

  if (category === 'global') {
    filtered = items.filter((i) => i.category === 'global');
  } else if (category === 'regional') {
    filtered = items.filter(
      (i) => i.category === 'regional' && (i.region === slug || secondary.includes(i.region)),
    );
  } else if (category === 'local') {
    filtered = items.filter((i) => i.category === 'local' && i.region === slug);
  } else if (category === 'traffic') {
    filtered = items.filter(
      (i) => i.category === 'traffic' && (i.region === slug || secondary.includes(i.region)),
    );
  } else if (category === 'alert') {
    filtered = items.filter((i) => i.region === slug || secondary.includes(i.region));
  } else {
    filtered = items.filter((i) => {
      if (i.category === 'global') return true;
      if (i.category === 'regional') return i.region === slug || secondary.includes(i.region);
      if (i.category === 'local') return i.region === slug;
      if (i.category === 'traffic') return i.region === slug || secondary.includes(i.region);
      if (i.category === 'alert') return i.region === slug || secondary.includes(i.region);
      return true;
    });
  }

  return deduplicateByUrl(filtered);
}
