import { createClient } from '@supabase/supabase-js';
import type { StationRecord, ContentSource, NewsCategory } from './types';
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

function getCategoryQueryValues(category?: string): string[] {
  const NEWS_CATEGORIES = ['news', 'global', 'regional', 'local', 'traffic', 'alert', 'weather', 'agriculture', 'business', 'sports', 'geo', 'security', 'emergency', 'transport', 'event', 'government', 'health', 'tourism'];

  if (!category) return NEWS_CATEGORIES;

  const normalized = category.toLowerCase();
  switch (normalized) {
    case 'regional':
      return ['regional', 'local', 'news'];
    case 'global':
      return ['global', 'news'];
    case 'traffic':
      return ['traffic'];
    case 'alert':
      return ['alert', 'emergency'];
    case 'local':
      return ['local', 'regional', 'news'];
    default:
      return NEWS_CATEGORIES;
  }
}

function normalizeNewsCategory(rawCategory: string | undefined, preferredCategory?: string): NewsCategory {
  const normalized = (rawCategory || '').toLowerCase();
  if (!normalized) return (preferredCategory as NewsCategory) || 'regional';

  if (preferredCategory) {
    switch (preferredCategory.toLowerCase()) {
      case 'regional':
        if (['regional', 'local', 'news'].includes(normalized)) return 'regional';
        break;
      case 'global':
        if (['global', 'news'].includes(normalized)) return 'global';
        break;
      case 'traffic':
        if (normalized === 'traffic') return 'traffic';
        break;
      case 'alert':
        if (['alert', 'emergency'].includes(normalized)) return 'alert';
        break;
      case 'local':
        if (['local', 'regional', 'news'].includes(normalized)) return 'local';
        break;
    }
  }

  if (['local', 'regional', 'global', 'traffic', 'alert'].includes(normalized)) {
    return normalized as NewsCategory;
  }
  if (normalized === 'emergency') return 'alert';
  return 'regional';
}

export async function fetchNewsItems(region?: string, category?: string): Promise<any[]> {
  const categoriesToQuery = getCategoryQueryValues(category);

  const events = await _silentFetch(async () => {
    let q = supabase.from('events').select('*').gte('created_at', retentionCutoff()).order('created_at', { ascending: false }).limit(50);
    if (region) q = q.eq('province', region);
    if (category) {
      q = q.in('category', categoriesToQuery);
    } else {
      q = q.in('category', categoriesToQuery);
    }
    return q;
  }, 'events');

  const mapped = events.map((event: any) => ({
    id: event.id,
    feed_id: event.provider,
    provider: event.provider,
    title: event.title,
    description: event.summary || '',
    content: event.description || '',
    url: event.metadata?.url || '',
    region: event.province || event.country || 'global',
    category: normalizeNewsCategory(event.category, category),
    priority: event.priority,
    city: event.city || event.metadata?.city,
    province: event.province,
    published_at: event.occurred_at || event.created_at,
    ingested_at: event.created_at,
    is_processed: event.status !== 'active',
  }));

  // Also fetch from legacy news_items table and merge
  const newsItems = await _silentFetch(async () => {
    let q = supabase.from('news_items').select('*').gte('ingested_at', retentionCutoff()).order('ingested_at', { ascending: false }).limit(50);
    if (region) {
      const drcRegion = getRegionBySlug(region);
      if (drcRegion) {
        q = q.in('region', [region, 'congo']);
      } else {
        q = q.eq('region', region);
      }
    }
    if (category) {
      q = q.in('category', categoriesToQuery);
    } else {
      q = q.in('category', categoriesToQuery);
    }
    return q;
  }, 'news_items');

  const mappedNews = newsItems.map((item: any) => ({
    id: item.id,
    feed_id: item.feed_id,
    title: item.title,
    description: item.description || '',
    content: item.content || '',
    url: item.url || '',
    region: item.region || 'global',
    category: normalizeNewsCategory(item.category, category),
    published_at: item.published_at || item.ingested_at,
    ingested_at: item.ingested_at,
    is_processed: item.is_processed || false,
  }));

  // Merge: prefer news_items over events (dedup by title)
  const seen = new Set<string>();
  const merged = [...mappedNews];
  for (const item of merged) seen.add(item.title?.substring(0, 100) || item.id);
  for (const item of mapped) {
    const key = item.title?.substring(0, 100) || item.id;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged.sort(
    (a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime(),
  );
}

export async function fetchRadioScripts(region?: string, category?: string): Promise<any[]> {
  const rows = await _silentFetch(async () => {
    let q = supabase.from('radio_scripts').select('*').eq('is_read', false).gte('created_at', retentionCutoff()).order('created_at', { ascending: true });
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
