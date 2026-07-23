// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
import type { NewsItem, NewsCategory, StationRecord } from './types';

const STATION_NEWS_REGION: Record<string, string> = {
  'DRC': 'congo',
  'DR Congo': 'congo',
  'Congo': 'congo',
};

// Secondary regions: DRC-related region values as they appear in the database
// (province names, country codes, continental tags).
const DRC_SECONDARY_REGIONS: Record<string, string[]> = {
  kinshasa: ['central-africa', 'congo', 'cd', 'nord-kivu', 'sud-kivu', 'haut-katanga', 'east-africa', 'southern-africa'],
  goma: ['central-africa', 'congo', 'cd', 'nord-kivu', 'sud-kivu', 'haut-katanga', 'east-africa', 'southern-africa'],
  lubumbashi: ['central-africa', 'congo', 'cd', 'nord-kivu', 'sud-kivu', 'haut-katanga', 'east-africa', 'southern-africa'],
};

function getStationNewsRegion(station: Pick<StationRecord, 'name' | 'country'>): string {
  if (STATION_NEWS_REGION[station.name]) return STATION_NEWS_REGION[station.name];
  if (STATION_NEWS_REGION[station.country]) return STATION_NEWS_REGION[station.country];
  return station.country.toLowerCase().replace(/\s+/g, '-');
}

function getSecondaryRegions(station: Pick<StationRecord, 'region'>): string[] {
  if (station.region && DRC_SECONDARY_REGIONS[station.region]) {
    return DRC_SECONDARY_REGIONS[station.region];
  }
  return ['central-africa'];
}

function matchesRegion(itemRegion: string | undefined, slug: string, secondary: string[]): boolean {
  if (!itemRegion) return false;
  const lower = itemRegion.toLowerCase();
  if (lower === slug.toLowerCase()) return true;
  return secondary.some(s => s.toLowerCase() === lower);
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
  const hasStationRegion = Boolean(station?.country || station?.region);
  if (!hasStationRegion) {
    return deduplicateByUrl(items);
  }

  const slug = getStationNewsRegion(station);
  const secondary = getSecondaryRegions(station);

  let filtered: NewsItem[];

  if (category === 'global') {
    filtered = items.filter((i) => i.category === 'global');
  } else if (category === 'regional') {
    filtered = items.filter(
      (i) => i.category === 'regional' && matchesRegion(i.region, slug, secondary),
    );
  } else if (category === 'local') {
    filtered = items.filter((i) => i.category === 'local' && matchesRegion(i.region, slug, secondary));
  } else if (category === 'traffic') {
    filtered = items.filter(
      (i) => i.category === 'traffic' && matchesRegion(i.region, slug, secondary),
    );
  } else if (category === 'alert') {
    filtered = items.filter((i) => matchesRegion(i.region, slug, secondary));
  } else {
    filtered = items.filter((i) => {
      if (i.category === 'global') return true;
      if (i.category === 'regional') return matchesRegion(i.region, slug, secondary);
      if (i.category === 'local') return matchesRegion(i.region, slug, secondary);
      if (i.category === 'traffic') return matchesRegion(i.region, slug, secondary);
      if (i.category === 'alert') return matchesRegion(i.region, slug, secondary);
      return true;
    });
  }

  return deduplicateByUrl(filtered);
}
