-- =============================================================================
-- Migration 011: entertainment_tracks
-- =============================================================================
-- Entertainment segment configuration. Extends music_tracks with broadcast-
-- specific settings (commentary, intro/outro scripts, cooldown).
--
-- Module: QueueManager, PlaybackController
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS entertainment_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Reference to music track (nullable for standalone entertainment)
  music_track_id UUID REFERENCES music_tracks(id) ON DELETE SET NULL,

  -- Display
  title TEXT NOT NULL,
  artist TEXT,
  mood TEXT,                          -- 'upbeat', 'chill', 'dramatic'

  -- Audio
  audio_url TEXT NOT NULL,
  duration_ms INT NOT NULL,

  -- Commentary templates (inline, per-track)
  commentary_templates JSONB DEFAULT '[]',  -- ["That was {title} by {artist}.", ...]
  intro_before_track JSONB DEFAULT '[]',    -- ["Here's something to brighten your day.", ...]

  -- Scheduling
  segment_open TEXT,                  -- "Time for some entertainment!"
  segment_close TEXT,                 -- "That's all for this entertainment break."

  -- Rotation control
  is_active BOOLEAN DEFAULT true,
  play_count INT DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  cooldown_minutes INT DEFAULT 60,   -- Minimum minutes between plays

  -- Scoping
  channel_id TEXT,                    -- NULL = available to all channels
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_active ON entertainment_tracks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_channel ON entertainment_tracks(channel_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_mood ON entertainment_tracks(mood);

-- RLS
ALTER TABLE entertainment_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entertainment_tracks_select_active"
  ON entertainment_tracks FOR SELECT
  USING (is_active = true);

CREATE POLICY "entertainment_tracks_service_role"
  ON entertainment_tracks FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE entertainment_tracks IS 'Entertainment segment tracks with commentary and rotation control.';
COMMENT ON COLUMN entertainment_tracks.cooldown_minutes IS 'Minimum minutes between plays of this track';
COMMENT ON COLUMN entertainment_tracks.commentary_templates IS 'JSON array of post-track commentary templates';
COMMENT ON COLUMN entertainment_tracks.channel_id IS 'NULL = available to all channels; set to restrict';
