-- =============================================================================
-- Migration 010: playback_history
-- =============================================================================
-- Comprehensive log of every segment played. Used for analytics, debugging,
-- and compliance. Extends music_play_history with full context.
--
-- Module: PlaybackController, StationController
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS playback_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Channel context
  channel_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

  -- What was played
  segment_type TEXT NOT NULL CHECK (segment_type IN (
    'intro', 'track', 'tts', 'jingle', 'bulletin',
    'announcement', 'ambient', 'silence', 'transition'
  )),
  segment_id TEXT,                    -- Source item ID
  source_table TEXT,                  -- 'events', 'music_tracks', 'tts_audio_cache', etc.

  -- Audio details
  audio_url TEXT,
  title TEXT,
  artist TEXT,
  duration_seconds INT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  interrupted BOOLEAN DEFAULT false,
  interrupt_reason TEXT,              -- 'bulletin', 'alert', 'manual', 'silence_recovery'

  -- Context
  language TEXT,
  voice_id TEXT,
  priority_at_play INT,              -- Priority when selected

  -- Metadata
  metadata JSONB,                    -- Additional context

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_playback_history_channel ON playback_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_station ON playback_history(station_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_started ON playback_history(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_history_type ON playback_history(segment_type);
CREATE INDEX IF NOT EXISTS idx_playback_history_source ON playback_history(source_table, segment_id);

-- RLS
ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playback_history_service_role"
  ON playback_history FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE playback_history IS 'Detailed log of every segment played per channel. For analytics and debugging.';
COMMENT ON COLUMN playback_history.segment_type IS 'Type of segment played: intro, track, tts, jingle, bulletin, etc.';
COMMENT ON COLUMN playback_history.interrupt_reason IS 'If interrupted: bulletin, alert, manual, silence_recovery';
