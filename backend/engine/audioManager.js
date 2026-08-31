// backend/engine/audioManager.js
// Mix computation — reads audio_config table for timing/volume settings.
// The audio_config table uses a wide-table design with named columns per setting.

import { supabase } from '../supabaseClient.js';

let audioConfig = null;

// Map from DB column names (snake_case) to config keys (UPPER_CASE)
const COLUMN_TO_KEY = {
  intro_cue_percent: 'INTRO_CUE_PERCENT',
  intro_duck_duration_ms: 'INTRO_DUCK_DURATION',
  intro_speech_overlap_seconds: 'INTRO_SPEECH_OVERLAP',
  intro_min_before_speech: 'INTRO_MIN_BEFORE_SPEECH',
  intro_ducked_volume: 'INTRO_DUCKED_VOLUME',
  intro_fallback_cue_ms: 'INTRO_FALLBACK_CUE',
  intro_stop_fade_steps: 'INTRO_STOP_FADE_STEPS',
  intro_stop_fade_step_ms: 'INTRO_STOP_FADE_STEP',
  background_volume: 'BACKGROUND_VOLUME',
  background_ducked_volume: 'DUCKED_BACKGROUND_VOLUME',
  background_fade_in_ms: 'BACKGROUND_FADE_IN',
  background_fade_out_ms: 'BACKGROUND_FADE_OUT',
  background_fade_ms: 'BACKGROUND_FADE',
  background_fade_step_ms: 'BACKGROUND_FADE_STEP',
  track_fade_ms: 'TRACK_FADE',
  track_fade_step_ms: 'TRACK_FADE_STEP',
  pre_track_gap_ms: 'PRE_TRACK_GAP_MS',
  speech_gap_min_ms: 'SPEECH_GAP_MIN',
  speech_gap_max_ms: 'SPEECH_GAP_MAX',
  host_fade_in_duration_ms: 'HOST_FADE_IN_DURATION',
  host_delay_after_duck_ms: 'HOST_DELAY_AFTER_DUCK',
  transition_gap_ms: 'TRANSITION_GAP_MS',
  crossfade_duration_ms: 'CROSSFADE_DURATION',
  outro_fade_duration_ms: 'OUTRO_FADE_DURATION',
  stop_fade_duration_ms: 'STOP_FADE_DURATION',
  fade_step_ms: 'FADE_STEP_MS',
  full_volume: 'FULL_VOLUME',
  broadcast_segment_ms: 'BROADCAST_SEGMENT_MS',
  entertainment_delay_ms: 'ENTERTAINMENT_DELAY_MS',
};

/**
 * Load audio config from DB — reads the first active row and maps columns to UPPER_CASE keys.
 */
export async function loadAudioConfig() {
  const { data, error } = await supabase
    .from('audio_config')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[${new Date().toISOString()}] [audioManager] Failed to load audio config:`, error.message);
    return {};
  }

  if (!data) {
    console.warn(`[${new Date().toISOString()}] [audioManager] No active audio_config row found — using defaults`);
    audioConfig = {};
    return audioConfig;
  }

  audioConfig = {};
  for (const [col, key] of Object.entries(COLUMN_TO_KEY)) {
    const val = data[col];
    if (val !== null && val !== undefined) {
      const num = parseFloat(val);
      audioConfig[key] = isNaN(num) ? val : num;
    }
  }
  return audioConfig;
}

/**
 * Get a specific audio config value.
 */
export function getConfig(key, defaultValue = null) {
  if (!audioConfig) return defaultValue;
  return audioConfig[key] ?? defaultValue;
}

/**
 * Get all audio config as an object.
 */
export function getAllConfig() {
  return audioConfig || {};
}

/**
 * Compute mix parameters for a given segment.
 * Returns the audio parameters the frontend needs to render the segment.
 */
export function computeMixParams(segmentType, options = {}) {
  const cfg = audioConfig || {};

  const params = {
    introCuePercent: cfg.INTRO_CUE_PERCENT || 0.85,
    introDuckDuration: cfg.INTRO_DUCK_DURATION || 300,        // Faster ducking
    hostFadeInDuration: cfg.HOST_FADE_IN_DURATION || 400,     // Faster host fade in
    hostDelayAfterDuck: cfg.HOST_DELAY_AFTER_DUCK || 200,     // Minimal delay
    backgroundFadeIn: cfg.BACKGROUND_FADE_IN || 500,         // Much faster fade in
    backgroundFadeOut: cfg.BACKGROUND_FADE_OUT || 500,         // Much faster fade out
    outroFadeDuration: cfg.OUTRO_FADE_DURATION || 800,        // Faster outro
    stopFadeDuration: cfg.STOP_FADE_DURATION || 500,         // Faster stop
    transitionGapMs: cfg.TRANSITION_GAP_MS || 200,            // Minimal gap
    crossfadeDuration: cfg.CROSSFADE_DURATION || 500,        // Faster crossfade
    fadeStepMs: cfg.FADE_STEP_MS || 20,                      // Smoother, faster steps
    fullVolume: cfg.FULL_VOLUME || 1.0,
    backgroundVolume: cfg.BACKGROUND_VOLUME || 0.12,
    duckedBackgroundVolume: cfg.DUCKED_BACKGROUND_VOLUME || 0.06,
    entertainmentDelayMs: cfg.ENTERTAINMENT_DELAY_MS || 3000, // Much shorter delay
    broadcastSegmentMs: cfg.BROADCAST_SEGMENT_MS || 270000,
    preTrackGapMs: cfg.PRE_TRACK_GAP_MS || 0,                 // No gap - immediate transitions
  };

  // Override with channel-specific config if provided
  if (options.backgroundVolume !== undefined) params.backgroundVolume = options.backgroundVolume;
  if (options.crossfadeDuration !== undefined) params.crossfadeDuration = options.crossfadeDuration;

  return params;
}
