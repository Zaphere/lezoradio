-- =============================================================================
-- Migration 001: radio_station_state
-- =============================================================================
-- The core synchronization table. The engine writes the current NowPlaying
-- state; the frontend reads it via Supabase Realtime subscription.
--
-- Module: PlaybackController (write), useNowPlaying hook (read)
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS radio_station_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Channel identification
  channel_id TEXT NOT NULL,           -- e.g., 'kinshasa-main', 'goma-news'
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

  -- Current segment
  segment_type TEXT NOT NULL CHECK (segment_type IN (
    'intro', 'track', 'tts', 'jingle', 'bulletin',
    'announcement', 'ambient', 'silence', 'transition'
  )),
  segment_id TEXT,                    -- Reference to content item

  -- Audio source
  audio_url TEXT,                     -- CDN/Storage URL
  audio_type TEXT CHECK (audio_type IN ('stream', 'tts', 'jingle', 'ambient')),

  -- Track metadata (when segment_type = 'track')
  title TEXT,
  artist TEXT,
  album TEXT,
  duration_seconds INT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,    -- Server timestamp
  duration_seconds INT NOT NULL,      -- Segment duration

  -- Transition hint
  transition_type TEXT CHECK (transition_type IN ('crossfade', 'duck', 'cut', 'next')),
  transition_duration_ms INT DEFAULT 1000,
  duck_volume NUMERIC(3,2),           -- 0.00-1.00

  -- Next item preview
  next_segment_type TEXT,
  next_audio_url TEXT,
  next_title TEXT,
  next_artist TEXT,
  next_duration_seconds INT,

  -- Station context
  language TEXT NOT NULL,
  voice_id TEXT,

  -- Metadata
  version INT NOT NULL DEFAULT 1,     -- Incremented on every state change
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_station ON radio_station_state(station_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_version ON radio_station_state(channel_id, version DESC);

-- RLS
ALTER TABLE radio_station_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radio_station_state_select_anon"
  ON radio_station_state FOR SELECT
  USING (true);

CREATE POLICY "radio_station_state_service_role"
  ON radio_station_state FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE radio_station_state IS 'Current NowPlaying state per broadcast channel. Engine writes, frontend reads via Realtime.';
COMMENT ON COLUMN radio_station_state.channel_id IS 'Unique channel identifier (e.g., kinshasa-main)';
COMMENT ON COLUMN radio_station_state.version IS 'Incremented on every state change for optimistic concurrency';
COMMENT ON COLUMN radio_station_state.segment_type IS 'Current segment type: intro, track, tts, jingle, bulletin, announcement, ambient, silence, transition';
