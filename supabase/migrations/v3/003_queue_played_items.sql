-- =============================================================================
-- Migration 003: queue_played_items
-- =============================================================================
-- Tracks what has been played per channel to prevent repeats and manage
-- rotation. Replaces the legacy broadcast_queue table.
--
-- Module: QueueManager
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS queue_played_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Channel identification
  channel_id TEXT NOT NULL,           -- e.g., 'kinshasa-main'
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

  -- Item reference
  item_type TEXT NOT NULL CHECK (item_type IN (
    'track', 'news', 'traffic', 'weather', 'bulletin',
    'tts', 'jingle', 'entertainment', 'emergency'
  )),
  item_id TEXT NOT NULL,              -- Source item identifier (event ID, track UUID, etc.)
  source_table TEXT,                  -- 'events', 'music_tracks', 'bulletin_schedule', etc.

  -- Playback tracking
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_played_ms INT,
  completed BOOLEAN DEFAULT false,
  interrupted BOOLEAN DEFAULT false,

  -- Rotation control
  expires_at TIMESTAMPTZ,            -- When this item can be played again (artist rotation)
  priority_at_play INT,              -- Priority when this item was selected

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_station ON queue_played_items(station_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_item ON queue_played_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_at ON queue_played_items(channel_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_played_expires ON queue_played_items(channel_id, expires_at);

-- Composite index for "find unplayed items" query pattern
CREATE INDEX IF NOT EXISTS idx_queue_played_lookup ON queue_played_items(channel_id, item_type, item_id, played_at DESC);

-- RLS
ALTER TABLE queue_played_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_played_items_service_role"
  ON queue_played_items FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE queue_played_items IS 'Tracks played items per channel for repeat prevention and rotation control.';
COMMENT ON COLUMN queue_played_items.item_type IS 'Type of content: track, news, traffic, weather, bulletin, tts, jingle, entertainment, emergency';
COMMENT ON COLUMN queue_played_items.expires_at IS 'When this item becomes eligible for replay (artist rotation window)';
