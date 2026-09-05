// backend/engine/queueManager.js
// Queue generation from events and music_tracks, with provider/category priority.
// REGION-AWARE: Events are filtered by channel region before serving.

import { supabase } from '../supabaseClient.js';
import { computeEffectivePriority, durationSecondsForStorageUrl } from './constants.js';
import * as stationController from './stationController.js';

// ── Sequential track playback ──────────────────────────────────────────────
// Per-channel round-robin index trackers. Each channel plays through ALL tracks
// in a folder before repeating. Index wraps to 0 when it reaches the end.
const entertainmentTrackIndex = new Map(); // channelId -> number
const backgroundTrackIndex = new Map();    // channelId -> number

/**
 * Build the region filter for a channel's content queries.
 * A regional channel plays content from its own region PLUS global content.
 * The global channel plays everything.
 * @param {string|null} channelRegion
 * @returns {object|null} { op: 'eq'|'in', region: string|string[] } or null for no filter
 */
function regionFilter(channelRegion) {
  if (!channelRegion || channelRegion === 'global') return null;
  return { op: 'in', region: [channelRegion, 'global'] };
}

/**
 * Get unplayed events for a channel, filtered by region.
 * LezoTraffic traffic events always outrank normal RSS/news content.
 */
export async function getUnplayedEvents(channelId, limit = 10) {
  // Get channel region for filtering
  const channel = stationController.getChannel(channelId);
  const channelRegion = channel?.region || null;

  // Fetch active events not yet played for this channel
  const { data: playedIds } = await supabase
    .from('queue_played_items')
    .select('item_id')
    .eq('channel_id', channelId)
    .eq('item_type', 'event');

  const playedSet = new Set((playedIds || []).map(r => r.item_id));

  let query = supabase
    .from('events')
    .select('id, provider, category, subcategory, priority, title, summary, description, city, province, country, region, language, occurred_at, created_at, status')
    .eq('status', 'active')
    .neq('category', 'geo')
    .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

  // Filter by region if channel has one (global channel gets all)
  const rf = regionFilter(channelRegion);
  if (rf) {
    query = query.in('region', rf.region);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error(`[${new Date().toISOString()}] [queueManager] Failed to get events:`, error.message);
    return [];
  }

  // Filter out already played
  const unplayed = (data || []).filter(e => !playedSet.has(e.id));

  // Sort by provider/category priority (lower = plays first), then recency
  const sorted = unplayed.sort((a, b) => {
    const prioA = computeEffectivePriority(a);
    const prioB = computeEffectivePriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sorted.slice(0, limit);
}

/**
 * Get an unplayed music track for a channel.
 * Tries music_tracks first, then entertainment_tracks as fallback.
 */
export async function getUnplayedTrack(channelId) {
  const { data: playedIds } = await supabase
    .from('queue_played_items')
    .select('item_id')
    .eq('channel_id', channelId)
    .eq('item_type', 'track');

  const playedSet = new Set((playedIds || []).map(r => r.item_id));

  // Try music_tracks table first
  let { data, error } = await supabase
    .from('music_tracks')
    .select('id, title, artist, audio_url, duration_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[${new Date().toISOString()}] [queueManager] Failed to get tracks from music_tracks:`, error.message);
    data = [];
  }

  // Filter out unavailable tracks if the column exists in returned data
  if (data && data.length > 0 && 'is_available' in data[0]) {
    data = data.filter(t => t.is_available !== false);
  }

  // If no music_tracks, try entertainment_tracks table
  if (!data || data.length === 0) {
    console.log(`[queueManager] music_tracks empty, trying entertainment_tracks...`);
    const { data: entData, error: entError } = await supabase
      .from('entertainment_tracks')
      .select('id, title, artist, audio_url, duration_ms, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!entError && entData && entData.length > 0) {
      // Filter out placeholder URLs
      const realTracks = entData.filter(t => t.audio_url && !t.audio_url.includes('your-project.supabase.co'));
      if (realTracks.length > 0) {
        data = realTracks;
      }
    }
  }

  if (!data || data.length === 0) return null;

  // Prefer unplayed tracks
  const unplayed = (data || []).filter(t => !playedSet.has(t.id));
  const pool = unplayed.length > 0 ? unplayed : data || [];

  if (pool.length === 0) return null;

  // Sequential round-robin: play through ALL tracks before repeating
  const dbTrackIndexKey = `db:${channelId}`;
  const lastIndex = entertainmentTrackIndex.get(dbTrackIndexKey) ?? -1;
  const nextIndex = (lastIndex + 1) % pool.length;
  entertainmentTrackIndex.set(dbTrackIndexKey, nextIndex);
  
  const track = pool[nextIndex];
  track.duration_seconds = Math.round((track.duration_ms || 180000) / 1000);
  // DB tracks are real songs (music/entertainment_tracks) — play in full as foreground
  track.isBackground = false;
  return track;
}

/**
 * Mark an item as played in a channel.
 * Also updates the source row so the UI shows "completed" state.
 */
export async function markPlayed(channelId, itemType, itemId, stationId = null, metadata = {}) {
  const insertData = {
    channel_id: channelId,
    item_type: itemType,
    item_id: itemId,
  };

  // Only include station_id if it's a valid UUID
  if (stationId) {
    insertData.station_id = stationId;
  }

  const { error } = await supabase
    .from('queue_played_items')
    .insert(insertData);

  if (error) {
    if (error.code === '23505') {
      // Already marked — not an error
      return;
    }
    console.error(`[${new Date().toISOString()}] [queueManager] markPlayed FAILED:`, {
      code: error.code,
      message: error.message,
      channelId,
      itemType,
      itemId,
      stationId,
      hint: error.hint || null,
    });
  }

  // Per-channel dedup is handled by queue_played_items above.
  // No need to update source tables — the events/news_items status columns
  // are not used for playback decisions.
}

/**
 * Get the genre weights for a channel from station_channels config.
 */
export function getGenreWeights(channelConfig) {
  return channelConfig?.genre_weights || {
    news: 0.4,
    traffic: 0.2,
    entertainment: 0.2,
    music: 0.2,
  };
}

/**
 * Content priority chain result.
 * @typedef {Object} NextSegment
 * @property {string|null} type - Segment type: 'traffic', 'news', 'weather', 'music', null
 * @property {Array} events - Events to include (for non-music types)
 * @property {Object|null} musicTrack - Music track (for 'music' type)
 * @property {string|null} transitionText - Transition text to speak before the content
 */

/**
 * Determine the next content to play for a channel using the priority chain.
 *
 * Priority order:
 *   1. Unplayed LezoTraffic events
 *   2. Current background music track continues
 *   3. Re-check LezoTraffic events
 *   4. Recent news events
 *   5. Weather events
 *   6. Next music track from bucket (fallback)
 *
 * @param {string} channelId - Channel ID
 * @param {string} language - Channel language
 * @param {number} maxEvents - Max events to include
 * @param {Set<string>} [excludeIds] - Event IDs to exclude (in-memory dedup safety net)
 * @returns {Promise<NextSegment>} Next segment info
 */
export async function getNextContent(channelId, language = 'fr', maxEvents = 3, excludeIds = new Set(), forceMusic = false) {
  // If forced music rotation, skip content entirely
  if (forceMusic) {
    console.log(`[queueManager] ${channelId}: forced music rotation`);
    const song = await getNextEntertainmentTrack(channelId);
    if (song) {
      return {
        type: 'music',
        events: [],
        musicTrack: song,
        transitionText: null,
      };
    }
    const nextTrack = await getNextBackgroundTrack(channelId);
    return {
      type: 'music',
      events: [],
      musicTrack: nextTrack,
      transitionText: null,
    };
  }

  // Step 1 & 3: Check LezoTraffic events (highest priority)
  const lezoEvents = (await getUnplayedEventsByProvider(channelId, 'lezotraffic', maxEvents, language))
    .filter(e => !excludeIds.has(e.id));
  if (lezoEvents.length > 0) {
    console.log(`[queueManager] ${channelId}: found ${lezoEvents.length} LezoTraffic events`);
    return {
      type: 'traffic',
      events: lezoEvents,
      musicTrack: null,
      transitionText: null,
    };
  }

  // Step 4: Check recent news events (events table, then news_items fallback)
  const newsEvents = (await getUnplayedEventsByCategory(channelId, ['news', 'regional', 'local', 'global'], maxEvents, language))
    .filter(e => !excludeIds.has(e.id));
  if (newsEvents.length > 0) {
    console.log(`[queueManager] ${channelId}: found ${newsEvents.length} news events (provider=${newsEvents[0]?.provider})`);
    return {
      type: 'news',
      events: newsEvents,
      musicTrack: null,
      transitionText: null,
    };
  }

  // Step 5: Check weather events
  const weatherEvents = (await getUnplayedEventsByCategory(channelId, ['weather'], maxEvents, language))
    .filter(e => !excludeIds.has(e.id));
  if (weatherEvents.length > 0) {
    console.log(`[queueManager] ${channelId}: found ${weatherEvents.length} weather events`);
    return {
      type: 'weather',
      events: weatherEvents,
      musicTrack: null,
      transitionText: null,
    };
  }

  // Step 6: Next music track from bucket (fallback)
  console.log(`[queueManager] ${channelId}: no priority content, falling back to music`);
  const nextTrack = await getNextBackgroundTrack(channelId);
  return {
    type: 'music',
    events: [],
    musicTrack: nextTrack,
    transitionText: null,
  };
}

/**
 * Get unplayed events filtered by provider and region.
 */
export async function getUnplayedEventsByProvider(channelId, provider, limit = 3, language = null) {
  const channel = stationController.getChannel(channelId);
  const channelRegion = channel?.region || null;
  const playedSet = await getPlayedEventIds(channelId);

  let query = supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, region, priority, language, occurred_at, created_at')
    .eq('status', 'active')
    .eq('provider', provider)
    .neq('category', 'geo')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Filter by region if channel has one (global channel gets all)
  const rf = regionFilter(channelRegion);
  if (rf) {
    query = query.in('region', rf.region);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedEventsByProvider error:`, error.message);
    return [];
  }

  let unplayed = (data || []).filter(e => !playedSet.has(e.id));
  return unplayed.slice(0, limit);
}

/**
 * Get unplayed events filtered by category array and region.
 * Falls back to news_items table if events table is empty.
 */
async function getUnplayedEventsByCategory(channelId, categories, limit = 3, language = null) {
  const channel = stationController.getChannel(channelId);
  const channelRegion = channel?.region || null;
  const playedSet = await getPlayedEventIds(channelId);

  let query = supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, region, priority, language, occurred_at, created_at')
    .eq('status', 'active')
    .in('category', categories)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Filter by region if channel has one (global channel gets all)
  const rf = regionFilter(channelRegion);
  if (rf) {
    query = query.in('region', rf.region);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedEventsByCategory error:`, error.message);
    return [];
  }

  let unplayed = (data || []).filter(e => !playedSet.has(e.id));

  if (unplayed.length > 0) return unplayed.slice(0, limit);

  // Fallback: query news_items table directly (RSS content lives here)
  if (categories.includes('news')) {
    return getUnplayedNewsItems(channelId, limit, language);
  }
  return [];
}

/**
 * Get unplayed news from the news_items table (fallback when events table is empty).
 * Normalizes news_items rows to match the events format the engine expects.
 * Filters by channel region when available.
 */
async function getUnplayedNewsItems(channelId, limit = 3, _language = null) {
  const channel = stationController.getChannel(channelId);
  const channelRegion = channel?.region || null;
  const playedSet = await getPlayedEventIds(channelId);

  let query = supabase
    .from('news_items')
    .select('id, title, description, content, region, category, published_at, ingested_at')
    .gte('ingested_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

  // Filter by region if channel has one (global channel gets all)
  const rf = regionFilter(channelRegion);
  if (rf) {
    query = query.in('region', rf.region);
  }

  const { data, error } = await query
    .order('ingested_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedNewsItems error:`, error.message);
    return [];
  }

  // Normalize to events format
  const normalized = (data || []).map(item => ({
    id: item.id,
    title: item.title,
    summary: item.description || item.content || '',
    provider: 'rss',
    category: 'news',
    subcategory: item.category || 'general',
    city: null,
    province: item.region || null,
    country: 'CD',
    priority: 4,
    language: null, // news_items doesn't track language — matches any channel
    occurred_at: item.published_at || item.ingested_at,
    created_at: item.ingested_at,
  }));

  const unplayed = normalized.filter(e => !playedSet.has(e.id));
  return unplayed.slice(0, limit);
}

/**
 * Get the set of played event IDs for a channel.
 */
async function getPlayedEventIds(channelId) {
  const { data } = await supabase
    .from('queue_played_items')
    .select('item_id')
    .eq('channel_id', channelId)
    .eq('item_type', 'event');
  return new Set((data || []).map(r => r.item_id));
}

/**
 * Get the next background music track from local storage or music_tracks table.
 * Background tracks are instrumental beds that loop under TTS voiceovers.
 * They are ducked (volume reduced) when foreground content plays.
 *
 * PRIORITY: Local background-music/ files first (ambient beds).
 * DB tracks from music_tracks/entertainment_tracks are entertainment songs
 * and should only be used for entertainment segments (with intros).
 */
export async function getNextBackgroundTrack(channelId) {
  // PRIORITY 1: Local background music files (ambient beds — no announcements)
  const { getBackgroundMusicTracks, getCurrentEntertainmentMusicUrl } = await import('./constants.js');
  const bgTracks = await getBackgroundMusicTracks();
  
  if (bgTracks && bgTracks.length > 0) {
    // Sequential round-robin: play through ALL tracks before repeating
    const lastIndex = backgroundTrackIndex.get(channelId) ?? -1;
    const nextIndex = (lastIndex + 1) % bgTracks.length;
    backgroundTrackIndex.set(channelId, nextIndex);
    
    const url = bgTracks[nextIndex];
    
    const urlParams = new URL(url, 'http://localhost').searchParams;
    const fileParam = urlParams.get('file');
    const dirParam = urlParams.get('dir') || '';
    const name = fileParam ? decodeURIComponent(fileParam).replace(/\.[^/.]+$/, '') : 'Background Music';
    
    console.log(`[queueManager] Background bed: ${name} (dir=${dirParam}) [${nextIndex + 1}/${bgTracks.length}]`);
    return {
      id: null,
      title: name,
      audio_url: url,
      duration_seconds: durationSecondsForStorageUrl(url, 120),
      isBackground: true,
    };
  }

  // PRIORITY 2: DB tracks (entertainment songs — will get intro announcements)
  const track = await getUnplayedTrack(channelId);
  if (track) return track;

  // Final fallback to default entertainment track
  const url = await getCurrentEntertainmentMusicUrl();
  const urlParams = new URL(url, 'http://localhost').searchParams;
  const fileParam = urlParams.get('file');
  const name = fileParam ? decodeURIComponent(fileParam).replace(/\.[^/.]+$/, '') : 'Background Music';
  return {
    id: null,
    title: name,
    audio_url: url,
    duration_seconds: durationSecondsForStorageUrl(url, 120),
    isBackground: true,
  };
}

/**
 * Next announced song (storage/songs or music_tracks) — not the looping bed.
 */
export async function getNextEntertainmentTrack(channelId) {
  const { getEntertainmentSongUrls } = await import('./constants.js');
  const songs = await getEntertainmentSongUrls();

  if (songs && songs.length > 0) {
    // Sequential round-robin: play through ALL songs before repeating
    const lastIndex = entertainmentTrackIndex.get(channelId) ?? -1;
    const nextIndex = (lastIndex + 1) % songs.length;
    entertainmentTrackIndex.set(channelId, nextIndex);
    
    const url = songs[nextIndex];
    const urlParams = new URL(url, 'http://localhost').searchParams;
    const fileParam = urlParams.get('file');
    const name = fileParam ? decodeURIComponent(fileParam).replace(/\.[^/.]+$/, '') : 'Music';
    console.log(`[queueManager] Entertainment song: ${name} [${nextIndex + 1}/${songs.length}]`);
    return {
      id: null,
      title: name,
      audio_url: url,
      duration_seconds: durationSecondsForStorageUrl(url, 240),
      isBackground: false,
    };
  }

  const dbTrack = await getUnplayedTrack(channelId);
  if (dbTrack) {
    dbTrack.isBackground = false;
    return dbTrack;
  }

  return null;
}
