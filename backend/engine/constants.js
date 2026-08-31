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

/** ElevenLabs voice IDs — DRC broadcast roster */
export const VOICE_IDS = {
  KINSHASA_LINGALA: 'uTB2ynnsQgtJDou6IulW',
  SWAHILI_FEMALE: '2tSJpap7gXlgDV2bauu0',
  FRENCH_ADAM: '3IyGWZwOTNraZr1Tz0fI',
};

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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_ROOT = path.resolve(__dirname, '..', '..', 'storage');

// ── Storage folder paths (organized structure) ──────────────────────────────
// Background music: storage/background-music/  (instrumental beds, looped)
// Songs/tracks:     storage/songs/             (full songs, announced + played)
// Jingles:          storage/jingles/           (intros, transitions, station IDs)
// TTS cache:        storage/tts-cache/         (generated TTS audio)
const MUSIC_BUCKET_PUBLIC_BASE = '/api/content/storage?bucket=Music&file=';

// New organized folder names (backend scans these)
const BACKGROUND_MUSIC_DIR = 'background-music';
const SONGS_DIR = 'songs';
const JINGLE_INTROS_DIR = 'jingles/intros';
const JINGLE_TRANSITIONS_DIR = 'jingles/transitions';

// Legacy folder names (for backward compatibility)
const LEGACY_MUSIC_DIR = 'Music';
const LEGACY_BACKMUSIC_DIR = 'BackMusic';
const LEGACY_NEWSTRANSITION_DIR = 'NewsTrasition';

const DEFAULT_ENTERTAINMENT_TRACK = '/api/content/storage?bucket=Music&file=AfricaRise.mp3&dir=songs';
const DEFAULT_BACKGROUND_BED = '/api/content/storage?bucket=Music&file=Backmusic1.mp3&dir=background-music';

// News transition jingle
const NEWS_TRANSITION_URL = '/api/content/storage?bucket=Music&file=Globalnews.mp3&dir=jingles/transitions';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

let cachedMusicList = [];
let cachedBackgroundList = [];
let lastMusicScanTime = 0;

/**
 * Scan a local storage directory for audio files.
 * @param {string} dirName - Subdirectory name under storage/
 * @returns {string[]} Array of proxy URLs for found audio files
 */
function scanLocalDir(dirName) {
  const dir = path.join(STORAGE_ROOT, dirName);
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir);
    return entries
      .filter(e => {
        const ext = path.extname(e).toLowerCase();
        return AUDIO_EXTENSIONS.includes(ext) && !e.startsWith('.');
      })
      .map(f => `${MUSIC_BUCKET_PUBLIC_BASE}${encodeURIComponent(f)}&dir=${dirName}`);
  } catch (err) {
    console.warn(`[constants] Could not scan local ${dirName} dir:`, err.message);
    return [];
  }
}

/**
 * Scan for background music (instrumental beds that loop under TTS).
 * Checks new organized folder first, falls back to legacy folder.
 */
function scanBackgroundMusic() {
  // Try new organized folder first
  let tracks = scanLocalDir(BACKGROUND_MUSIC_DIR);
  if (tracks.length > 0) {
    console.log(`[constants] Found ${tracks.length} background tracks in ${BACKGROUND_MUSIC_DIR}/`);
    return tracks;
  }

  // Fall back to legacy BackMusic folder
  tracks = scanLocalDir(LEGACY_BACKMUSIC_DIR);
  if (tracks.length > 0) {
    console.log(`[constants] Found ${tracks.length} background tracks in legacy ${LEGACY_BACKMUSIC_DIR}/`);
    return tracks;
  }

  return [];
}

/**
 * Scan for songs/tracks (full songs that get announced and played in foreground).
 * Checks new organized folder first, falls back to legacy folder.
 */
function scanSongs() {
  // Try new organized folder first
  let tracks = scanLocalDir(SONGS_DIR);
  if (tracks.length > 0) {
    console.log(`[constants] Found ${tracks.length} songs in ${SONGS_DIR}/`);
    return tracks;
  }

  // Fall back to legacy Music folder
  tracks = scanLocalDir(LEGACY_MUSIC_DIR);
  if (tracks.length > 0) {
    console.log(`[constants] Found ${tracks.length} songs in legacy ${LEGACY_MUSIC_DIR}/`);
    return tracks;
  }

  return [];
}

/**
 * Scan for jingle/intro audio files.
 */
function scanJingles() {
  // Try new organized folder first
  let tracks = scanLocalDir(JINGLE_INTROS_DIR);
  if (tracks.length > 0) return tracks;

  // Fall back to legacy introaudio folder
  const introDir = path.join(STORAGE_ROOT, 'introaudio');
  try {
    if (!fs.existsSync(introDir)) return [];
    const entries = fs.readdirSync(introDir);
    return entries
      .filter(e => {
        const ext = path.extname(e).toLowerCase();
        return AUDIO_EXTENSIONS.includes(ext) && !e.startsWith('.');
      })
      .map(f => `/api/content/storage?bucket=introaudio&file=${encodeURIComponent(f)}`);
  } catch (err) {
    console.warn('[constants] Could not scan introaudio dir:', err.message);
    return [];
  }
}

/**
 * Scan for news transition jingles.
 */
function scanTransitionJingles() {
  // Try new organized folder first
  let tracks = scanLocalDir(JINGLE_TRANSITIONS_DIR);
  if (tracks.length > 0) return tracks;

  // Fall back to legacy NewsTrasition folder
  tracks = scanLocalDir(LEGACY_NEWSTRANSITION_DIR);
  return tracks;
}

/**
 * Scan for music files in local storage directory.
 * Returns array of file paths sorted by most recent first.
 * Combines background music, songs, and jingles.
 */
export async function getLatestMusicFromBucket() {
  const now = Date.now();
  if (cachedMusicList.length > 0 && now - lastMusicScanTime < 2 * 60 * 1000) {
    return cachedMusicList;
  }

  // Scan all local directories and combine
  const localTracks = [
    ...scanSongs(),
    ...scanBackgroundMusic(),
  ];

  if (localTracks.length > 0) {
    cachedMusicList = localTracks;
    lastMusicScanTime = now;
    console.log(`[constants] Found ${cachedMusicList.length} local tracks (songs + background)`);
    return cachedMusicList;
  }

  // Try Supabase Music bucket
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
        console.log(`[constants] Scanned 'Music' bucket: found ${cachedMusicList.length} tracks.`);
        return cachedMusicList;
      }
    }
  } catch (err) {
    console.warn('[constants] Could not list Music bucket:', err.message);
  }

  return [DEFAULT_ENTERTAINMENT_TRACK];
}

/**
 * Resolve a /api/content/storage URL to a file under storage/.
 */
export function localPathFromStorageUrl(url) {
  try {
    const u = new URL(url, 'http://localhost');
    const file = decodeURIComponent(u.searchParams.get('file') || '');
    const dir = u.searchParams.get('dir') || '';
    if (!file) return null;
    return path.join(STORAGE_ROOT, dir, file);
  } catch {
    return null;
  }
}

/**
 * Length of a local MP3/WAV from file size (CBR ~128kbps) plus a tail.
 * Used so songs and beds are not hard-capped at 180s.
 */
export function durationSecondsForStorageUrl(url, fallback = 240) {
  const localPath = localPathFromStorageUrl(url);
  if (!localPath || !fs.existsSync(localPath)) return fallback;
  try {
    const size = fs.statSync(localPath).size;
    return Math.max(30, Math.ceil(size / 16000) + 3);
  } catch {
    return fallback;
  }
}

export function getDefaultBackgroundBedUrl() {
  const tracks = scanBackgroundMusic();
  return tracks[0] || DEFAULT_BACKGROUND_BED;
}

/**
 * Get background music tracks (instrumental beds that loop under TTS).
 * These are ducked when voice content plays.
 */
export async function getBackgroundMusicTracks() {
  const now = Date.now();
  if (cachedBackgroundList.length > 0 && now - lastMusicScanTime < 2 * 60 * 1000) {
    return cachedBackgroundList;
  }

  const tracks = scanBackgroundMusic();
  if (tracks.length > 0) {
    cachedBackgroundList = tracks;
    return cachedBackgroundList;
  }

  cachedBackgroundList = [DEFAULT_BACKGROUND_BED];
  return cachedBackgroundList;
}

/**
 * Songs from storage/songs — announced and played as full foreground tracks.
 */
export async function getEntertainmentSongUrls() {
  return scanSongs();
}

/**
 * Get current entertainment track URL (prefers latest music in songs folder).
 */
export async function getCurrentEntertainmentMusicUrl() {
  const tracks = await getLatestMusicFromBucket();
  if (!tracks || tracks.length === 0) return DEFAULT_ENTERTAINMENT_TRACK;

  const hour = new Date().getHours();
  const index = hour % tracks.length;
  return tracks[index] || tracks[0];
}

/**
 * Get news transition jingle URL (if available).
 */
export function getNewsTransitionUrl() {
  // Check new organized folder first
  const newFile = path.join(STORAGE_ROOT, JINGLE_TRANSITIONS_DIR, 'Globalnews.mp3');
  if (fs.existsSync(newFile)) {
    return NEWS_TRANSITION_URL;
  }

  // Fall back to legacy folder
  const legacyFile = path.join(STORAGE_ROOT, LEGACY_NEWSTRANSITION_DIR, 'Globalnews.mp3');
  if (fs.existsSync(legacyFile)) {
    return NEWS_TRANSITION_URL;
  }

  return null;
}

/**
 * Legacy compatibility export for getCurrentBackgroundMusicUrl
 */
export function getCurrentBackgroundMusicUrl() {
  if (cachedMusicList.length > 0) return cachedMusicList[0];
  return DEFAULT_ENTERTAINMENT_TRACK;
}
