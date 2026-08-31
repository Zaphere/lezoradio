import { useState, useEffect, useCallback } from 'react';
import * as db from '../lib/supabase';
import type { NewsItem, RadioScript, BroadcastQueueItem, Alert, NewsCategory } from '../lib/types';

function mapRows<T>(data: any[]): T[] {
  return (data || []) as T[];
}

export function useNewsItems(region?: string, category?: NewsCategory) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.fetchNewsItems(region, category);
      const items = mapRows<NewsItem>(data);
      console.log(`[useNewsItems] Fetched ${items.length} items (region=${region ?? 'all'}, category=${category ?? 'all'})`);
      setItems(items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [region, category]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, refetch };
}

export function useRadioScripts(region?: string, category?: NewsCategory) {
  const [scripts, setScripts] = useState<RadioScript[]>([]);

  const refetch = useCallback(async () => {
    const data = await db.fetchRadioScripts(region, category);
    setScripts(mapRows<RadioScript>(data));
  }, [region, category]);

  return { scripts, refetch };
}

export function useBroadcastQueue(region?: string) {
  const [queue, setQueue] = useState<BroadcastQueueItem[]>([]);

  const refetch = useCallback(async () => {
    const data = await db.fetchBroadcastQueue(region);
    setQueue(mapRows<BroadcastQueueItem>(data));
  }, [region]);

  return { queue, refetch };
}

export function useAlerts(region?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const refetch = useCallback(async () => {
    const data = await db.fetchAlerts(region);
    setAlerts(mapRows<Alert>(data));
  }, [region]);

  return { alerts, refetch };
}

export function useFeeds() {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.fetchFeeds()
      .then((data) => setFeeds(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { feeds, loading };
}

export function useRealtimeSubscription(table: string, onInsert: (payload: any) => void) {
  useEffect(() => {
    // Poll for new inserts every 10 seconds (replaces Supabase Realtime)
    let lastCheck = new Date().toISOString();

    const poll = async () => {
      try {
        const now = new Date().toISOString();
        // Use the generic news endpoint as a fallback — filters by created_at > lastCheck
        // For production, each table should have its own polling endpoint
        const res = await fetch(`/api/content/news?since=${encodeURIComponent(lastCheck)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((row: any) => onInsert(row));
          }
        }
        lastCheck = now;
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [table, onInsert]);
}
