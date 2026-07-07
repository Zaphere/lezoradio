import type { BroadcastStateValue, PersistedBroadcastState, SerializedNewsItem, NewsItem } from '../lib/types';

const STORAGE_PREFIX = 'radiolezo:broadcast:';
const MAX_AGE_MS = 30 * 60 * 1000;

function storageKey(stationId: string): string {
  return `${STORAGE_PREFIX}${stationId}`;
}

export function saveBroadcastState(
  stationId: string,
  state: BroadcastStateValue,
  opts: {
    stationName: string;
    stationRegion: string;
    currentIndex: number;
    playedIds: string[];
    playlist: NewsItem[];
    voiceRate: number;
    voiceVolume: number;
  },
): void {
  try {
    const serialized: PersistedBroadcastState = {
      stationId,
      stationName: opts.stationName,
      stationRegion: opts.stationRegion,
      state,
      currentIndex: opts.currentIndex,
      playedIds: opts.playedIds,
      playlist: opts.playlist.map(serializeNewsItem),
      timestamp: Date.now(),
      voiceRate: opts.voiceRate,
      voiceVolume: opts.voiceVolume,
    };
    localStorage.setItem(storageKey(stationId), JSON.stringify(serialized));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadBroadcastState(stationId: string): PersistedBroadcastState | null {
  try {
    const raw = localStorage.getItem(storageKey(stationId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedBroadcastState;

    if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(storageKey(stationId));
      return null;
    }

    if (parsed.stationId !== stationId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearBroadcastState(stationId: string): void {
  try {
    localStorage.removeItem(storageKey(stationId));
  } catch { /* ignore */ }
}

export function updateBroadcastTimestamp(stationId: string): void {
  try {
    const raw = localStorage.getItem(storageKey(stationId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedBroadcastState;
    parsed.timestamp = Date.now();
    localStorage.setItem(storageKey(stationId), JSON.stringify(parsed));
  } catch { /* ignore */ }
}

function serializeNewsItem(item: NewsItem): SerializedNewsItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    region: item.region,
    category: item.category,
    ingested_at: item.ingested_at,
  };
}

export function deserializeNewsItem(item: SerializedNewsItem): NewsItem {
  return {
    id: item.id,
    feed_id: '',
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    region: item.region,
    category: item.category,
    published_at: item.ingested_at,
    ingested_at: item.ingested_at,
    is_processed: false,
  };
}
