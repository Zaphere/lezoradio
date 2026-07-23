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
    .select('*')
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

  const { data, error } = await supabase
    .from('music_tracks')
    .select('*')
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[${new Date().toISOString()}] [queueManager] Failed to get tracks:`, error.message);
    return null;
  }

  // Prefer unplayed tracks
  const unplayed = (data || []).filter(t => !playedSet.has(t.id));
  const pool = unplayed.length > 0 ? unplayed : data || [];

  if (pool.length === 0) return null;

  // Random selection from pool
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Mark an item as played in a channel.
 */
export async function markPlayed(channelId, itemType, itemId, metadata = {}) {
  const { error } = await supabase
    .from('queue_played_items')
    .insert({
      channel_id: channelId,
      item_type: itemType,
      item_id: itemId,
      metadata,
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
