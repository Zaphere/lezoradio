// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
interface BroadcastProgress {
  lastPlayedId: string | null;
  playedIds: string[];
  lastIndex: number;
}

const MAX_STORED = 200;

function storageKey(stationId: string, category?: string): string {
  return `radiolezo:progress:${stationId}:${category ?? 'all'}`;
}

export function loadBroadcastProgress(stationId: string, category?: string): BroadcastProgress {
  try {
    const raw = localStorage.getItem(storageKey(stationId, category));
    if (!raw) return { lastPlayedId: null, playedIds: [], lastIndex: -1 };
    const parsed = JSON.parse(raw) as BroadcastProgress;
    return {
      lastPlayedId: parsed.lastPlayedId ?? null,
      playedIds: Array.isArray(parsed.playedIds) ? parsed.playedIds : [],
      lastIndex: typeof parsed.lastIndex === 'number' ? parsed.lastIndex : -1,
    };
  } catch {
    return { lastPlayedId: null, playedIds: [], lastIndex: -1 };
  }
}

export function saveBroadcastProgress(
  stationId: string,
  category: string | undefined,
  progress: BroadcastProgress,
): void {
  try {
    const playedIds = progress.playedIds.slice(-MAX_STORED);
    localStorage.setItem(
      storageKey(stationId, category),
      JSON.stringify({ lastPlayedId: progress.lastPlayedId, playedIds, lastIndex: progress.lastIndex }),
    );
  } catch {
    // ignore quota errors
  }
}

export function markItemPlayed(
  stationId: string,
  category: string | undefined,
  itemId: string,
  existing: Set<string>,
  index?: number,
): Set<string> {
  const next = new Set(existing);
  next.add(itemId);
  saveBroadcastProgress(stationId, category, {
    lastPlayedId: itemId,
    playedIds: [...next],
    lastIndex: index ?? -1,
  });
  return next;
}

export function clearBroadcastProgress(stationId: string, category?: string): void {
  saveBroadcastProgress(stationId, category, { lastPlayedId: null, playedIds: [], lastIndex: -1 });
}

export function savePlaybackIndex(
  stationId: string,
  category: string | undefined,
  index: number,
): void {
  const progress = loadBroadcastProgress(stationId, category);
  progress.lastIndex = index;
  saveBroadcastProgress(stationId, category, progress);
}

export function findFirstUnplayedIndex(items: { id: string }[], playedIds: Set<string>): number {
  return items.findIndex((item) => !playedIds.has(item.id));
}

export function findNextUnplayedIndex(
  items: { id: string }[],
  playedIds: Set<string>,
  afterIndex: number,
): number {
  for (let i = afterIndex + 1; i < items.length; i++) {
    if (!playedIds.has(items[i].id)) return i;
  }
  return -1;
}

export function hasUnplayedItems(items: { id: string }[], playedIds: Set<string>): boolean {
  return items.some((item) => !playedIds.has(item.id));
}
