import type { StationRecord, ContentSource } from './types';

let _dbReady: boolean | null = null;

export async function isDatabaseReady(): Promise<boolean> {
  if (_dbReady !== null) return _dbReady;
  try {
    const response = await fetch('/api/content/stations');
    _dbReady = response.ok;
    return _dbReady;
  } catch {
    _dbReady = false;
    return false;
  }
}

export async function fetchNewsItems(region?: string, category?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (category) params.set('category', category);

  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/api/content/news${qs}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        console.log(`[fetchNewsItems] API returned ${data.length} items (region=${region ?? 'all'}, category=${category ?? 'all'})`);
        return data;
      }
    }
    console.warn(`[fetchNewsItems] API returned HTTP ${response.status}`);
  } catch (err) {
    console.warn('Content API unavailable:', err);
  }

  return [];
}

export async function fetchRadioScripts(region?: string, category?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (category) params.set('category', category);
  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/api/content/radio-scripts${qs}`);
    if (response.ok) {
      const data = await response.json();
      return (data || []).map((row: any) => ({
        ...row,
        script: row.script || row.script_text || '',
      }));
    }
  } catch (err) {
    console.warn('Radio scripts API unavailable:', err);
  }
  return [];
}

export async function fetchBroadcastQueue(region?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/api/content/broadcast-queue${qs}`);
    if (response.ok) return await response.json();
  } catch (err) {
    console.warn('Broadcast queue API unavailable:', err);
  }
  return [];
}

export async function fetchAlerts(region?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/api/content/alerts${qs}`);
    if (response.ok) return await response.json();
  } catch (err) {
    console.warn('Alerts API unavailable:', err);
  }
  return [];
}

export async function markNewsItemProcessed(itemId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/content/mark-processed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function markScriptAsRead(scriptId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/content/mark-script-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scriptId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchFeeds(): Promise<any[]> {
  try {
    const response = await fetch('/api/content/feeds');
    if (response.ok) return await response.json();
  } catch (err) {
    console.warn('Feeds API unavailable:', err);
  }
  return [];
}

export async function fetchStations(): Promise<StationRecord[]> {
  try {
    const response = await fetch('/api/content/stations');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        console.log(`[fetchStations] API returned ${data.length} stations`);
        return data as StationRecord[];
      }
    }
  } catch (err) {
    console.warn('Stations API unavailable:', err);
  }
  return [];
}

export async function fetchStationById(id: string): Promise<StationRecord | null> {
  try {
    const response = await fetch(`/api/content/stations/${id}`);
    if (response.ok) return await response.json();
  } catch {
    // ignore
  }
  return null;
}

function mapFeedToContentSource(feed: Record<string, unknown>): ContentSource {
  return {
    id: feed.id as string,
    name: feed.name as string,
    url: feed.url as string,
    type: (feed.type as ContentSource['type']) || 'rss',
    category: (feed.category as string) || 'news',
    priority: 5,
    enabled: (feed.is_active as boolean) ?? true,
    health: 'unknown',
    last_checked: (feed.last_fetched_at as string) || null,
    last_success: (feed.last_fetched_at as string) || null,
    last_failure: null,
    article_count: 0,
    response_time: 0,
    created_at: (feed.created_at as string) || '',
    updated_at: (feed.updated_at as string) || '',
  };
}

export async function fetchContentSources(): Promise<ContentSource[]> {
  try {
    const response = await fetch('/api/content/sources');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data as ContentSource[];
    }
  } catch (err) {
    console.warn('Content sources API unavailable:', err);
  }

  // Fallback: try feeds
  const feeds = await fetchFeeds();
  return feeds.map(mapFeedToContentSource);
}

export async function fetchStationSources(stationId: string): Promise<ContentSource[]> {
  try {
    const response = await fetch(`/api/content/station-sources?station_id=${stationId}`);
    if (response.ok) return await response.json();
  } catch {
    // ignore
  }
  return [];
}

export async function updateSourceHealth(id: string, data: Partial<ContentSource>): Promise<void> {
  try {
    await fetch('/api/content/source-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
  } catch (err) {
    console.warn('Failed to update source health:', err);
  }
}

export async function pruneOldData(): Promise<{ success: boolean; deleted: number }> {
  return { success: true, deleted: 0 };
}
