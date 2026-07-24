// backend/engine/playbackController.js
// State machine + segment timing for each channel.

import { supabase } from '../supabaseClient.js';
import { SEGMENT_TYPES, DEFAULT_STATE } from './constants.js';
import { computeMixParams } from './audioManager.js';
import { getCurrentTimeInTimezone } from './utils/timezone.js';

/**
 * Create a new playback state for a channel.
 */
export function createChannelState(channelId, stationId, language) {
  return {
    channelId,
    stationId,
    language,
    currentSegment: { ...DEFAULT_STATE },
    nextSegment: null,
    version: 1,
    startedAt: null,
    segmentDuration: 0,
  };
}

/**
 * Determine what segment should play next based on time-of-day + schedule.
 */
export function determineNextSegment(channelState, channelConfig, engineConfig) {
  const timezone = channelConfig?.timezone || 'Africa/Kinshasa';
  const now = getCurrentTimeInTimezone(timezone);
  const hour = now.getHours();
  const minute = now.getMinutes();

  const isBulletinTime = minute < 5 && hour % 3 === 0;

  const lastSegmentType = channelState.currentSegment.segment_type;
  const elapsed = channelState.startedAt ? Date.now() - new Date(channelState.startedAt).getTime() : 0;
  const stationIdInterval = (engineConfig?.station_id_interval_min_ms || 1200000) +
    Math.random() * ((engineConfig?.station_id_interval_max_ms || 1800000) - (engineConfig?.station_id_interval_min_ms || 1200000));
  const isStationIdTime = elapsed > stationIdInterval && lastSegmentType !== SEGMENT_TYPES.JINGLE;

  const isTimeAnnouncement = minute < 2 && (minute === 0 || minute === 30);

  if (isBulletinTime) return { type: SEGMENT_TYPES.BULLETIN, reason: 'scheduled_bulletin' };
  if (isStationIdTime) return { type: SEGMENT_TYPES.JINGLE, reason: 'station_id_interval' };
  if (isTimeAnnouncement) return { type: SEGMENT_TYPES.ANNOUNCEMENT, reason: 'time_announcement' };

  return { type: null, reason: 'no_change' };
}

/**
 * Update the NowPlaying state for a channel and write to DB.
 * Includes source attribution fields (provider, city, province, description).
 */
export async function updateState(channelId, newState) {
  const seg = newState.currentSegment || {};
  const next = newState.nextSegment || {};

  const { error } = await supabase
    .from('radio_station_state')
    .upsert({
      channel_id: channelId,
      station_id: newState.stationId,
      segment_type: seg.segment_type || DEFAULT_STATE.segment_type,
      segment_id: seg.segment_id || null,
      audio_url: seg.audio_url || null,
      audio_type: seg.audio_type || null,
      title: seg.title || null,
      artist: seg.artist || null,
      album: seg.album || null,
      duration_seconds: seg.duration_seconds || 0,
      started_at: newState.startedAt || new Date().toISOString(),
      transition_type: seg.transition_type || null,
      transition_duration_ms: seg.transition_duration_ms || 1000,
      duck_volume: seg.duck_volume || null,
      next_segment_type: next.segment_type || null,
      next_audio_url: next.audio_url || null,
      next_title: next.title || null,
      next_artist: next.artist || null,
      next_duration_seconds: next.duration_seconds || null,
      language: newState.language,
      voice_id: seg.voice_id || null,
      version: newState.version,
      generated_at: new Date().toISOString(),
      // Source attribution
      provider: seg.provider || null,
      city: seg.city || null,
      province: seg.province || null,
      description: seg.description || null,
    }, { onConflict: 'channel_id' });

  if (error) {
    console.error(`[${new Date().toISOString()}] [playbackController] Failed to update state for ${channelId}:`, error.message);
  }
}

/**
 * Log a playback event to playback_history — includes source attribution.
 */
export async function logPlayback(channelId, segment, stationId) {
  const { error } = await supabase
    .from('playback_history')
    .insert({
      channel_id: channelId,
      station_id: stationId || null,
      segment_type: segment.segment_type,
      segment_id: segment.segment_id || null,
      audio_url: segment.audio_url || null,
      title: segment.title || null,
      artist: segment.artist || null,
      duration_seconds: segment.duration_seconds || 0,
      started_at: segment.started_at || new Date().toISOString(),
      // Source attribution
      provider: segment.provider || null,
      city: segment.city || null,
      province: segment.province || null,
    });

  if (error && error.code !== '23505') {
    console.error(`[${new Date().toISOString()}] [playbackController] Failed to log playback:`, error.message);
  }
}
