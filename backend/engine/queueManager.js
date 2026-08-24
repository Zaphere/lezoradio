// backend/engine/queueManager.js
// Queue generation from events and music_tracks, with provider/category priority.

import { supabase } from '../supabaseClient.js';
import { computeEffectivePriority } from './constants.js';

/**
 * Get unplayed events for a channel, prioritized by provider + category.
 * LezoTraffic traffic events always outrank normal RSS/news content.
 */
export async function getUnplayedEvents(channelId, limit = 10) {
  // Fetch active events not yet played for this channel
  const { data: playedIds } = await supabase
    .from('queue_played_items')
    .select('item_id')
    .eq('channel_id', channelId)
    .eq('item_type', 'event');

  const playedSet = new Set((playedIds || []).map(r => r.item_id));

  const { data, error } = await supabase
    .from('events')
    .select('id, provider, category, subcategory, priority, title, summary, description, city, province, country, occurred_at, created_at, status')
    .eq('status', 'active')
    .neq('category', 'geo')
    .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
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

  // Random selection from pool
  const track = pool[Math.floor(Math.random() * pool.length)];
  track.duration_seconds = Math.round((track.duration_ms || 180000) / 1000);
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
    station_id: stationId || null,
  };

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

  // Update source row so UI shows "completed" state
  if (itemType === 'event') {
    // Try events table first
    const { count } = await supabase
      .from('events')
      .update({ status: 'played' })
      .eq('id', itemId)
      .select('id', { count: 'exact', head: true });

    // If no rows updated, try news_items (normalized events from news_items table)
    if (count === 0) {
      await supabase
        .from('news_items')
        .update({ is_processed: true })
        .eq('id', itemId);
    }
  }
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
 * Get unplayed events filtered by provider.
 * Optionally filters by language match (interim fix until translation pipeline).
 */
async function getUnplayedEventsByProvider(channelId, provider, limit = 3, language = null) {
  const playedSet = await getPlayedEventIds(channelId);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, priority, language, occurred_at, created_at')
    .eq('status', 'active')
    .eq('provider', provider)
    .neq('category', 'geo')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedEventsByProvider error:`, error.message);
    return [];
  }

  let unplayed = (data || []).filter(e => !playedSet.has(e.id));

  // Filter by language match (skip foreign-language items until translation exists)
  if (language) {
    unplayed = unplayed.filter(e => !e.language || e.language === language);
  }

  return unplayed.slice(0, limit);
}

/**
 * Get unplayed events filtered by category array.
 * Falls back to news_items table if events table is empty.
 * Optionally filters by language match (interim fix until translation pipeline).
 */
async function getUnplayedEventsByCategory(channelId, categories, limit = 3, language = null) {
  const playedSet = await getPlayedEventIds(channelId);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, priority, language, occurred_at, created_at')
    .eq('status', 'active')
    .in('category', categories)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedEventsByCategory error:`, error.message);
    return [];
  }

  let unplayed = (data || []).filter(e => !playedSet.has(e.id));

  // Filter by language match (skip foreign-language items until translation exists)
  if (language) {
    unplayed = unplayed.filter(e => !e.language || e.language === language);
  }

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
 * Note: news_items doesn't have a language column, so language filtering is
 * not applied here — items are returned as-is (language: null matches any).
 */
async function getUnplayedNewsItems(channelId, limit = 3, _language = null) {
  const playedSet = await getPlayedEventIds(channelId);

  const { data, error } = await supabase
    .from('news_items')
    .select('id, title, description, content, region, category, published_at, ingested_at')
    .gte('ingested_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
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
 * Get the next background music track from the Music bucket or music_tracks table.
 */
export async function getNextBackgroundTrack(channelId) {
  // Try music_tracks table first
  const track = await getUnplayedTrack(channelId);
  if (track) return track;

  // Fall back to Music bucket scanning (from constants)
  const { getCurrentEntertainmentMusicUrl } = await import('./constants.js');
  const url = await getCurrentEntertainmentMusicUrl();
  // Extract filename from URL, handling query parameters and proxy paths
  const urlPath = url.split('?')[0];
  const rawName = decodeURIComponent(urlPath.substring(urlPath.lastIndexOf('/') + 1));
  const name = rawName.replace(/\.[^/.]+$/, '');
  return { id: null, title: name, audio_url: url, duration_seconds: 180 };
}
