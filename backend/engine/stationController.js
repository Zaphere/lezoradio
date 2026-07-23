// backend/engine/stationController.js
// Reads station configuration from database tables.

import { supabase } from '../supabaseClient.js';

const stationCache = new Map();
const channelCache = new Map();

/**
 * Load all active stations from DB.
 */
export async function loadStations() {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error(`[${new Date().toISOString()}] [stationController] Failed to load stations:`, error.message);
    return [];
  }

  stationCache.clear();
  for (const station of data) {
    stationCache.set(station.id, station);
  }
  return data;
}

/**
 * Load all active channels from DB.
 */
export async function loadChannels() {
  const { data, error } = await supabase
    .from('station_channels')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error(`[${new Date().toISOString()}] [stationController] Failed to load channels:`, error.message);
    return [];
  }

  channelCache.clear();
  for (const ch of data) {
    channelCache.set(ch.channel_id, ch);
  }
  return data;
}

/**
 * Get a cached station by ID.
 */
export function getStation(stationId) {
  return stationCache.get(stationId) || null;
}

/**
 * Get a cached channel by channel_id.
 */
export function getChannel(channelId) {
  return channelCache.get(channelId) || null;
}

/**
 * Get all cached channels.
 */
export function getAllChannels() {
  return Array.from(channelCache.values());
}

/**
 * Reload caches (called periodically).
 */
export async function refreshCache() {
  await Promise.all([loadStations(), loadChannels()]);
  console.log(`[${new Date().toISOString()}] [stationController] Cache refreshed: ${stationCache.size} stations, ${channelCache.size} channels`);
}
