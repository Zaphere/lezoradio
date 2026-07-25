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
 */
export async function getUnplayedTrack(channelId) {
  const { data: playedIds } = await supabase
    .from('queue_played_items')
    .select('item_id')
    .eq('channel_id', channelId)
    .eq('item_type', 'track');

  const playedSet = new Set((playedIds || []).map(r => r.item_id));

  let { data, error } = await supabase
    .from('music_tracks')
    .select('id, title, artist, audio_url, duration_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[${new Date().toISOString()}] [queueManager] Failed to get tracks:`, error.message);
    return null;
  }

  // Filter out unavailable tracks if the column exists in returned data
  if (data && data.length > 0 && 'is_available' in data[0]) {
    data = data.filter(t => t.is_available !== false);
  }

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
 */
export async function markPlayed(channelId, itemType, itemId, stationId = null, metadata = {}) {
  const { error } = await supabase
    .from('queue_played_items')
    .insert({
      channel_id: channelId,
      item_type: itemType,
      item_id: itemId,
      station_id: stationId,
    });

  if (error && error.code !== '23505') {
    console.error(`[${new Date().toISOString()}] [queueManager] Failed to mark played:`, error.message);
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
 * @returns {Promise<NextSegment>} Next segment info
 */
export async function getNextContent(channelId, language = 'fr', maxEvents = 3) {
  // Step 1 & 3: Check LezoTraffic events (highest priority)
  const lezoEvents = await getUnplayedEventsByProvider(channelId, 'lezotraffic', maxEvents);
  if (lezoEvents.length > 0) {
    return {
      type: 'traffic',
      events: lezoEvents,
      musicTrack: null,
      transitionText: null, // caller generates transition via scriptGenerator
    };
  }

  // Step 4: Check recent news events
  const newsEvents = await getUnplayedEventsByCategory(channelId, ['news', 'regional', 'local', 'global'], maxEvents);
  if (newsEvents.length > 0) {
    return {
      type: 'news',
      events: newsEvents,
      musicTrack: null,
      transitionText: null,
    };
  }

  // Step 5: Check weather events
  const weatherEvents = await getUnplayedEventsByCategory(channelId, ['weather'], maxEvents);
  if (weatherEvents.length > 0) {
    return {
      type: 'weather',
      events: weatherEvents,
      musicTrack: null,
      transitionText: null,
    };
  }

  // Step 6: Next music track from bucket (fallback)
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
 */
async function getUnplayedEventsByProvider(channelId, provider, limit = 3) {
  const playedSet = await getPlayedEventIds(channelId);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, priority, occurred_at, created_at')
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

  const unplayed = (data || []).filter(e => !playedSet.has(e.id));
  return unplayed.slice(0, limit);
}

/**
 * Get unplayed events filtered by category array.
 */
async function getUnplayedEventsByCategory(channelId, categories, limit = 3) {
  const playedSet = await getPlayedEventIds(channelId);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, summary, provider, category, subcategory, city, province, country, priority, occurred_at, created_at')
    .eq('status', 'active')
    .in('category', categories)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[queueManager] getUnplayedEventsByCategory error:`, error.message);
    return [];
  }

  const unplayed = (data || []).filter(e => !playedSet.has(e.id));
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
