import { createClient } from '@supabase/supabase-js';
import type { StationRecord, ContentSource } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

const _silentFetch = async <T>(fn: () => any): Promise<T[]> => {
  if (_dbReady === false) return [];
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn('Supabase query error:', error.message);
      return [];
    }
    return (data || []) as T[];
  } catch {
    return [];
  }
};

export async function fetchNewsItems(region?: string, category?: string): Promise<any[]> {
  return _silentFetch(async () => {
    let q = supabase.from('news_items').select('*').order('ingested_at', { ascending: false }).limit(50);
    if (region) q = q.eq('region', region);
    if (category) q = q.eq('category', category);
    return q;
  });
}

export async function fetchRadioScripts(region?: string, category?: string): Promise<any[]> {
  const rows = await _silentFetch(async () => {
    let q = supabase.from('radio_scripts').select('*').eq('is_read', false).order('created_at', { ascending: true });
    if (region) q = q.eq('region', region);
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
    let q = supabase.from('alerts').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (region) q = q.eq('region', region);
    return q;
  });
}

export async function markNewsItemProcessed(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('news_items').update({ is_processed: true }).eq('id', itemId);
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
