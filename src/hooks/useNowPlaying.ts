import { useState, useEffect, useCallback, useRef } from 'react';
import type { NowPlaying } from '../lib/types';

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
    backgroundAudioUrl: (row.background_audio_url as string) ?? null,
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

  const fetchState = useCallback(async () => {
    if (!enabled || !channelId) return;
    try {
      const res = await fetch(`/api/content/now-playing?channel_id=${encodeURIComponent(channelId)}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data || typeof data !== 'object' || !('channel_id' in data)) return;

      const mapped = mapRow(data);
      // Always update if version changes
      if (mapped.version > versionRef.current) {
        versionRef.current = mapped.version;
        setNowPlaying(mapped);
        setError(null);
        setIsConnected(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch now-playing state';
      console.warn('[useNowPlaying] Fetch error:', msg);
      setError(msg);
    }
  }, [channelId, enabled]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setNowPlaying(null);
      setIsConnected(false);
      return;
    }

    fetchState();

    // Poll every 2 seconds for now-playing updates (replaces Supabase Realtime)
    const pollInterval = setInterval(fetchState, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [channelId, enabled, fetchState]);

  return { nowPlaying, isConnected, error, refetch: fetchState };
}
