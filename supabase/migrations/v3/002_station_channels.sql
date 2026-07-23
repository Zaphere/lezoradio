-- =============================================================================
-- Migration 002: station_channels
-- =============================================================================
-- Defines broadcast channels per station. Each channel has its own language,
-- genre weights, voice config, and timing parameters.
--
-- Adding a new country = database inserts only (no code changes).
--
-- Module: StationController, QueueManager
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS station_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Relationships
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,    -- e.g., 'kinshasa-main', 'goma-news'

  -- Display
  name TEXT NOT NULL,                 -- "Kinshasa Main"
  description TEXT,
  frequency NUMERIC(4,1),             -- FM frequency (88.1, 92.5, etc.)
  emoji TEXT,                         -- Channel icon

  -- Content mix
  language TEXT NOT NULL DEFAULT 'fr',
  genre_weights JSONB DEFAULT '{
    "news": 40,
    "traffic": 20,
    "music": 25,
    "entertainment": 15
  }',

  -- Voice configuration
  primary_voice_id TEXT,              -- ElevenLabs voice ID for this channel
  voice_config JSONB DEFAULT '{
    "gender": "female",
    "style": "formal",
    "stability": 0.5,
    "similarity_boost": 0.75
  }',

  -- Behavior
  broadcast_segment_ms INT DEFAULT 270000,  -- News segment duration (4.5 min)
  entertainment_delay_ms INT DEFAULT 8000,  -- Delay before entertainment
  station_id_interval_min_ms INT DEFAULT 600000,   -- 10 min
  station_id_interval_max_ms INT DEFAULT 900000,   -- 15 min
  time_announcement_interval_min_ms INT DEFAULT 1200000, -- 20 min
  time_announcement_interval_max_ms INT DEFAULT 1800000, -- 30 min

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_station_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_station_channels_active ON station_channels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_station_channels_language ON station_channels(language);

-- RLS
ALTER TABLE station_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_channels_select_active"
  ON station_channels FOR SELECT
  USING (is_active = true);

CREATE POLICY "station_channels_service_role"
  ON station_channels FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE station_channels IS 'Broadcast channels per station. Each channel has independent language, voice, genre weights, and timing.';
COMMENT ON COLUMN station_channels.channel_id IS 'Unique channel identifier (e.g., kinshasa-main)';
COMMENT ON COLUMN station_channels.genre_weights IS 'JSON object with genre name → percentage weight';
COMMENT ON COLUMN station_channels.voice_config IS 'JSON object with ElevenLabs voice parameters';
