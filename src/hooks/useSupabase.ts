import { useState, useEffect, useCallback } from 'react';
import * as db from '../lib/supabase';
import type { NewsItem, RadioScript, BroadcastQueueItem, Alert, NewsCategory } from '../lib/types';
import { supabase } from '../lib/supabase';

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
      setItems(mapRows<NewsItem>(data));
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
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
        onInsert(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, onInsert]);
}
