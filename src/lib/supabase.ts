import { createClient } from '@supabase/supabase-js';
import type { StationRecord, ContentSource } from './types';
import { getRegionBySlug } from './drcRegions';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const DATA_RETENTION_MS = 72 * 60 * 60 * 1000; // 72 hours — keep 3 days

function retentionCutoff(): string {
  return new Date(Date.now() - DATA_RETENTION_MS).toISOString();
}

let _dbReady: boolean | null = null;

export async function isDatabaseReady(): Promise<boolean> {
  if (_dbReady !== null) return _dbReady;
  try {
    const { error } = await supabase.from('stations').select('id', { count: 'exact', head: true }).limit(1);
    _dbReady = !error;
    return _dbReady;
  } catch {
    _dbReady = false;
    return false;
  }
}

const _silentFetch = async <T>(fn: () => any, label?: string): Promise<T[]> => {
  if (_dbReady === false) {
    console.warn(`[Supabase] Skipping query (${label ?? 'unknown'}): database not ready`);
    return [];
  }
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`Supabase query error${label ? ` (${label})` : ''}:`, error.message);
      return [];
    }
    return (data || []) as T[];
  } catch (err) {
    console.warn(`Supabase query exception${label ? ` (${label})` : ''}:`, err);
    return [];
  }
};

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
        console.log(`[fetchNewsItems] Proxy returned ${data.length} items (region=${region ?? 'all'}, category=${category ?? 'all'})`);
        return data;
      }
    }
    console.warn(`[fetchNewsItems] Proxy returned HTTP ${response.status}`);
  } catch (err) {
    console.warn('Content proxy unavailable:', err);
  }

  return [];
}

export async function fetchRadioScripts(region?: string, category?: string): Promise<any[]> {
  const rows = await _silentFetch(async () => {
    let q = supabase.from('radio_scripts').select('*').eq('is_read', false).gte('created_at', retentionCutoff()).order('created_at', { ascending: true }).limit(50);
    if (region) {
      const drcRegion = getRegionBySlug(region);
      if (drcRegion) {
        q = q.in('region', [region, 'congo']);
      } else {
        q = q.eq('region', region);
      }
    }
    if (category) q = q.eq('category', category);
    return q;
  });

  return rows.map((row: any) => ({
    ...row,
    script: row.script || row.script_text || '',
  }));
}

export async function fetchBroadcastQueue(region?: string): Promise<any[]> {
  return _silentFetch(async () => {
    let q = supabase.from('broadcast_queue').select('*').eq('is_played', false).order('priority', { ascending: true }).order('created_at', { ascending: true });
    if (region) q = q.eq('region', region);
    return q;
  });
}

export async function fetchAlerts(region?: string): Promise<any[]> {
  return _silentFetch(async () => {
    let q = supabase.from('alerts').select('*').eq('is_active', true).gte('created_at', retentionCutoff()).order('created_at', { ascending: false });
    if (region) q = q.eq('region', region);
    return q;
  });
}

export async function markNewsItemProcessed(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('events').update({ status: 'processed' }).eq('id', itemId);
    if (error) {
      console.warn('Failed to mark news item as processed:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function markScriptAsRead(scriptId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('radio_scripts').update({ is_read: true }).eq('id', scriptId);
    if (error) {
      console.warn('Failed to mark script as read:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchFeeds(): Promise<any[]> {
  return _silentFetch(async () => supabase.from('feeds').select('*').order('name', { ascending: true }));
}

export async function fetchStations(): Promise<StationRecord[]> {
  try {
    const response = await fetch('/api/content/stations');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        console.log(`[fetchStations] Proxy returned ${data.length} stations`);
        return data as StationRecord[];
      }
    } else {
      console.warn(`[fetchStations] Proxy returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn('Stations proxy unavailable, falling back to direct Supabase client:', err);
  }

  return _silentFetch<StationRecord>(async () =>
    supabase.from('stations').select('*').eq('is_active', true).order('priority').order('name')
  );
}

export async function fetchStationById(id: string): Promise<StationRecord | null> {
  try {
    const { data, error } = await supabase.from('stations').select('*').eq('id', id).single();
    if (error) return null;
    return data as StationRecord;
  } catch {
    return null;
  }
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
  const sources = await _silentFetch<ContentSource>(async () =>
    supabase.from('content_sources').select('*').eq('enabled', true).order('priority')
  );

  if (sources.length > 0) return sources;

  const feeds = await _silentFetch<Record<string, unknown>>(async () =>
    supabase.from('feeds').select('*').eq('is_active', true).order('name')
  );

  return feeds.map(mapFeedToContentSource);
}

export async function fetchStationSources(stationId: string): Promise<ContentSource[]> {
  if (_dbReady === false) return [];

  try {
    const { data, error } = await supabase
      .from('station_sources')
      .select('priority, content_sources(*)')
      .eq('station_id', stationId)
      .eq('enabled', true)
      .order('priority');

    if (error) {
      console.warn('Supabase query error:', error.message);
      return [];
    }

    const results: ContentSource[] = [];

    for (const row of data || []) {
      const joined = row.content_sources;
      const source = (Array.isArray(joined) ? joined[0] : joined) as ContentSource | null | undefined;
      if (!source) continue;

      results.push({
        ...source,
        priority: row.priority ?? source.priority,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function updateSourceHealth(id: string, data: Partial<ContentSource>): Promise<void> {
  try {
    await supabase.from('content_sources').update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  } catch (err) {
    console.warn('Failed to update source health:', err);
  }
}

export async function pruneOldData(): Promise<{ success: boolean; deleted: number }> {
  // Let the backend handle database cleanups to avoid browser clients pruning database tables
  return { success: true, deleted: 0 };
}
