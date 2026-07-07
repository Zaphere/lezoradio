const STORAGE_KEY_PREFIX = 'radiolezo:seek:';

function storageKey(stationId: string): string {
  return `${STORAGE_KEY_PREFIX}${stationId}`;
}

interface SeekPositionMap {
  [storyId: string]: number;
}

export function saveSeekPosition(stationId: string, storyId: string, position: number): void {
  if (position < 1) return;
  try {
    const raw = localStorage.getItem(storageKey(stationId));
    const map: SeekPositionMap = raw ? JSON.parse(raw) : {};
    map[storyId] = position;
    const entries = Object.entries(map);
    if (entries.length > 100) {
      const sorted = entries.sort(([, a], [, b]) => b - a);
      const trimmed = Object.fromEntries(sorted.slice(0, 100));
      localStorage.setItem(storageKey(stationId), JSON.stringify(trimmed));
    } else {
      localStorage.setItem(storageKey(stationId), JSON.stringify(map));
    }
  } catch { /* storage full */ }
}

export function loadSeekPosition(stationId: string, storyId: string): number {
  try {
    const raw = localStorage.getItem(storageKey(stationId));
    if (!raw) return 0;
    const map: SeekPositionMap = JSON.parse(raw);
    return map[storyId] || 0;
  } catch {
    return 0;
  }
}

export function clearSeekPositions(stationId: string): void {
  try {
    localStorage.removeItem(storageKey(stationId));
  } catch { /* ignore */ }
}
