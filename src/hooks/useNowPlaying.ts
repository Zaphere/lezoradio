import { useState, useEffect, useCallback, useRef } from 'react';
import type { NowPlaying } from '../lib/types';
import { supabase } from '../lib/supabase';

function mapRow(row: Record<string, unknown>): NowPlaying {
  return {
    id: row.id as string,
    channelId: row.channel_id as string,
    stationId: row.station_id as string,
    segmentType: row.segment_type as NowPlaying['segmentType'],
    segmentId: (row.segment_id as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
    audioType: (row.audio_type as NowPlaying['audioType']) ?? null,
    title: (row.title as string) ?? null,
    artist: (row.artist as string) ?? null,
    album: (row.album as string) ?? null,
    durationSeconds: (row.duration_seconds as number) ?? 0,
    startedAt: row.started_at as string,
    transitionType: (row.transition_type as NowPlaying['transitionType']) ?? null,
    transitionDurationMs: (row.transition_duration_ms as number) ?? 1000,
    duckVolume: (row.duck_volume as number) ?? null,
    nextSegmentType: (row.next_segment_type as NowPlaying['nextSegmentType']) ?? null,
    nextAudioUrl: (row.next_audio_url as string) ?? null,
    nextTitle: (row.next_title as string) ?? null,
    nextArtist: (row.next_artist as string) ?? null,
    nextDurationSeconds: (row.next_duration_seconds as number) ?? null,
    language: row.language as string,
    voiceId: (row.voice_id as string) ?? null,
    version: row.version as number,
    generatedAt: row.generated_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    provider: (row.provider as string) ?? null,
    city: (row.city as string) ?? null,
    province: (row.province as string) ?? null,
    description: (row.description as string) ?? null,
  };
}

interface UseNowPlayingOptions {
  channelId: string;
  enabled?: boolean;
}

interface UseNowPlayingResult {
  nowPlaying: NowPlaying | null;
  isConnected: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNowPlaying({ channelId, enabled = true }: UseNowPlayingOptions): UseNowPlayingResult {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const fetchInitial = useCallback(async () => {
    if (!enabled || !channelId) return;
    try {
      let data: Record<string, unknown> | null = null;

      // Try backend proxy first (bypasses RLS via service-role key)
      try {
        const res = await fetch(`/api/content/now-playing?channel_id=${encodeURIComponent(channelId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json === 'object' && 'channel_id' in json) {
            data = json;
          }
        }
      } catch {
        // Proxy unavailable, fall back to direct Supabase
      }

      // Fallback: direct Supabase query
      if (!data) {
        const { data: directData, error: fetchErr } = await supabase
          .from('radio_station_state')
          .select('*')
          .eq('channel_id', channelId)
          .maybeSingle();

        if (fetchErr) {
          console.warn('[useNowPlaying] Initial fetch error:', fetchErr.message);
          setError(fetchErr.message);
          return;
        }
        data = directData;
      }

      if (!data) {
        return;
      }

      const mapped = mapRow(data);
      if (mapped.version > versionRef.current) {
        versionRef.current = mapped.version;
        setNowPlaying(mapped);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch initial state';
      console.warn('[useNowPlaying] Initial fetch exception:', msg);
      setError(msg);
    }
  }, [channelId, enabled]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setNowPlaying(null);
      setIsConnected(false);
      return;
    }

    fetchInitial();

    // Retry initial fetch every 10s if no data yet (handles case where table exists but has no rows)
    const retryInterval = setInterval(() => {
      if (versionRef.current === 0) {
        fetchInitial();
      }
    }, 10000);

    const channel = supabase
      .channel(`now-playing-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'radio_station_state',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setNowPlaying(null);
            versionRef.current = 0;
            return;
          }

          const row = payload.new as Record<string, unknown>;
          const mapped = mapRow(row);

          if (mapped.version >= versionRef.current) {
            versionRef.current = mapped.version;
            setNowPlaying(mapped);
            setError(null);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError('Realtime subscription failed');
        }
      });

    return () => {
      clearInterval(retryInterval);
      supabase.removeChannel(channel);
    };
  }, [channelId, enabled, fetchInitial]);

  return { nowPlaying, isConnected, error, refetch: fetchInitial };
}
