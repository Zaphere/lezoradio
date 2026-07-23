-- =============================================================================
-- Migration 006: audio_config
-- =============================================================================
-- All audio timing, volume, and fade configuration. Replaces hardcoded
-- values in timing.ts, IntroAudio.ts, BackgroundAudio.ts, TrackAudio.ts,
-- AudioManager.ts.
--
-- Module: AudioManager, useAudioExecutor, PlaybackController
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS audio_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope (NULL = global default, non-NULL = channel/station override)
  channel_id TEXT,                    -- NULL = global default
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,  -- NULL = global

  -- Intro settings
  intro_url TEXT,                     -- Supabase Storage URL for intro jingle
  intro_cue_percent NUMERIC(4,2) DEFAULT 0.85,
  intro_duck_duration_ms INT DEFAULT 2000,
  intro_speech_overlap_seconds NUMERIC(3,1) DEFAULT 2.5,
  intro_min_before_speech NUMERIC(3,1) DEFAULT 2.0,
  intro_ducked_volume NUMERIC(3,2) DEFAULT 0.18,
  intro_fallback_cue_ms INT DEFAULT 3000,
  intro_stop_fade_steps INT DEFAULT 8,
  intro_stop_fade_step_ms INT DEFAULT 40,

  -- Background music settings
  background_url TEXT,                -- Supabase Storage URL for background music
  background_volume NUMERIC(3,2) DEFAULT 0.12,
  background_ducked_volume NUMERIC(3,2) DEFAULT 0.06,
  background_fade_in_ms INT DEFAULT 1500,
  background_fade_out_ms INT DEFAULT 1500,
  background_fade_ms INT DEFAULT 900,
  background_fade_step_ms INT DEFAULT 40,

  -- Track (entertainment) settings
  track_fade_ms INT DEFAULT 700,
  track_fade_step_ms INT DEFAULT 40,
  pre_track_gap_ms INT DEFAULT 500,
  speech_gap_min_ms INT DEFAULT 300,
  speech_gap_max_ms INT DEFAULT 800,

  -- Host/TTS settings
  host_fade_in_duration_ms INT DEFAULT 800,
  host_delay_after_duck_ms INT DEFAULT 400,

  -- Transition settings
  transition_gap_ms INT DEFAULT 800,
  crossfade_duration_ms INT DEFAULT 1000,
  outro_fade_duration_ms INT DEFAULT 2000,
  stop_fade_duration_ms INT DEFAULT 1500,

  -- Animation
  fade_step_ms INT DEFAULT 30,

  -- Volume levels
  full_volume NUMERIC(3,2) DEFAULT 1.0,

  -- Segment timing
  broadcast_segment_ms INT DEFAULT 270000,  -- 4.5 min
  entertainment_delay_ms INT DEFAULT 8000,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id, station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audio_config_channel ON audio_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_config_station ON audio_config(station_id);

-- RLS
ALTER TABLE audio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_config_select_active"
  ON audio_config FOR SELECT
  USING (is_active = true);

CREATE POLICY "audio_config_service_role"
  ON audio_config FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE audio_config IS 'Audio timing, volume, and fade configuration. Channel/station overrides or global defaults.';
COMMENT ON COLUMN audio_config.channel_id IS 'NULL = global default; set to override for specific channel';
COMMENT ON COLUMN audio_config.intro_url IS 'Supabase Storage URL for the station intro jingle';
COMMENT ON COLUMN audio_config.background_url IS 'Supabase Storage URL for background music';
