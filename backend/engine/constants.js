// backend/engine/constants.js
// Minimal constants — most configuration lives in database tables.

export const ENGINE_VERSION = '3.0.0';

export const SEGMENT_TYPES = {
  INTRO: 'intro',
  TRACK: 'track',
  TTS: 'tts',
  JINGLE: 'jingle',
  BULLETIN: 'bulletin',
  ANNOUNCEMENT: 'announcement',
  AMBIENT: 'ambient',
  SILENCE: 'silence',
  TRANSITION: 'transition',
};

export const AUDIO_TYPES = {
  STREAM: 'stream',
  TTS: 'tts',
  JINGLE: 'jingle',
  AMBIENT: 'ambient',
};

export const TRANSITION_TYPES = {
  CROSSFADE: 'crossfade',
  DUCK: 'duck',
  CUT: 'cut',
  NEXT: 'next',
};

// ── Provider / category priority system ────────────────────────────────────
// Lower numeric value = higher broadcast priority.
// LezoTraffic traffic events always outrank normal RSS/news content.
//
// 0 = Emergency (always first)
// 1 = LezoTraffic traffic / incidents / security
// 2 = Congo local news
// 3 = Africa regional news
// 4 = International news
// 5 = Entertainment / weather / default

export const PROVIDER_PRIORITY = {
  lezotraffic: 1,
  rss: 3,
  manual: 5,
};

export const CATEGORY_PRIORITY = {
  emergency: 0,
  security: 1,
  traffic: 1,
  transport: 2,
  local: 2,
  regional: 3,
  news: 4,
  global: 4,
  weather: 4,
  entertainment: 5,
  sports: 5,
  geo: 10,
  default: 5,
};

/**
 * Compute the effective broadcast priority for an event.
 * Uses provider priority as base, category priority as modifier.
 * Returns a numeric value (lower = plays first).
 */
export function computeEffectivePriority(event) {
  const providerBase = PROVIDER_PRIORITY[event.provider] ?? 5;
  const categoryMod = CATEGORY_PRIORITY[event.category] ?? CATEGORY_PRIORITY.default;

  // Use the higher priority (lower number) of provider vs category
  // This ensures LezoTraffic events (provider=1) always outrank
  // generic news (category=4) regardless of their DB priority number.
  return Math.min(providerBase, categoryMod);
}

export const DEFAULT_STATE = {
  segment_type: SEGMENT_TYPES.SILENCE,
  segment_id: null,
  audio_url: null,
  audio_type: null,
  title: null,
  artist: null,
  album: null,
  duration_seconds: 0,
  transition_type: null,
  transition_duration_ms: 1000,
  duck_volume: null,
  next_segment_type: null,
  next_audio_url: null,
  next_title: null,
  next_artist: null,
  next_duration_seconds: null,
  language: 'fr',
  voice_id: null,
  // Source attribution fields
  provider: null,
  city: null,
  province: null,
  description: null,
};

import { supabase } from '../supabaseClient.js';

// ── Entertainment / Music bucket scanning ──────────────────────────────────
const MUSIC_BUCKET_PUBLIC_BASE = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/';
const DEFAULT_ENTERTAINMENT_TRACK = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/DJ%20Sparks%20Letto.mp3';

let cachedMusicList = [];
let lastMusicScanTime = 0;

/**
 * Scan the Supabase 'Music' storage bucket for uploaded music files.
 * Returns array of public URLs sorted by most recent first.
 */
export async function getLatestMusicFromBucket() {
  const now = Date.now();
  if (cachedMusicList.length > 0 && now - lastMusicScanTime < 2 * 60 * 1000) {
    return cachedMusicList;
  }

  try {
    const { data: files, error } = await supabase.storage
      .from('Music')
      .list('', {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (!error && files && files.length > 0) {
      const validFiles = files.filter(f => f.name && !f.name.startsWith('.'));
      if (validFiles.length > 0) {
        cachedMusicList = validFiles.map(f => `${MUSIC_BUCKET_PUBLIC_BASE}${encodeURIComponent(f.name)}`);
        lastMusicScanTime = now;
        console.log(`[constants] Scanned 'Music' bucket: found ${cachedMusicList.length} tracks. Latest: ${validFiles[0].name}`);
        return cachedMusicList;
      }
    }
  } catch (err) {
    console.warn('[constants] Could not list Music bucket:', err.message);
  }

  return [DEFAULT_ENTERTAINMENT_TRACK];
}

/**
 * Get current entertainment track URL (prefers latest music in Music bucket).
 */
export async function getCurrentEntertainmentMusicUrl() {
  const tracks = await getLatestMusicFromBucket();
  if (!tracks || tracks.length === 0) return DEFAULT_ENTERTAINMENT_TRACK;

  const hour = new Date().getHours();
  const index = hour % tracks.length;
  return tracks[index] || tracks[0];
}

/**
 * Legacy compatibility export for getCurrentBackgroundMusicUrl
 */
export function getCurrentBackgroundMusicUrl() {
  if (cachedMusicList.length > 0) return cachedMusicList[0];
  return DEFAULT_ENTERTAINMENT_TRACK;
}
