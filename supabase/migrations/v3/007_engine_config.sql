-- =============================================================================
-- Migration 007: engine_config
-- =============================================================================
-- Engine scheduling, recovery, and behavior configuration. Replaces hardcoded
-- values in useRadioEngine.ts, broadcastFlowSupervisor.ts, frenchBulletin.ts.
--
-- Module: PlaybackController, EventScheduler, radioEngine
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS engine_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope (NULL = global default)
  channel_id TEXT,                    -- NULL = global default
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,

  -- Scheduling
  poll_interval_ms INT DEFAULT 15000,  -- Legacy polling interval (kept for backward compat)
  alert_display_duration_ms INT DEFAULT 5000,
  teaser_interval INT DEFAULT 4,      -- Insert teaser every N stories

  -- Entertainment delays (by story count)
  entertainment_delay_all_played_ms INT DEFAULT 5000,
  entertainment_delay_many_stories_ms INT DEFAULT 12000,  -- 10+ stories
  entertainment_delay_moderate_stories_ms INT DEFAULT 8000, -- 5-9 stories
  entertainment_delay_few_stories_ms INT DEFAULT 5000,     -- <5 stories

  -- Silence recovery
  silence_threshold_ms INT DEFAULT 3500,
  bfs_check_interval_ms INT DEFAULT 2000,
  bridge_check_interval_ms INT DEFAULT 30000,
  min_bridge_duration_ms INT DEFAULT 20000,
  max_transition_length INT DEFAULT 200,

  -- Recovery order (JSON array of recovery steps)
  recovery_order JSONB DEFAULT '[
    "check_alerts",
    "check_breaking_news",
    "check_scheduled_bulletins",
    "check_pending_rss",
    "check_cached_scripts",
    "activate_bridge"
  ]',

  -- Fallback
  fallback_message TEXT DEFAULT 'No recent news feeds detected. Please stand by for the next update.',

  -- Timezone
  default_timezone TEXT DEFAULT 'UTC',

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id, station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engine_config_channel ON engine_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_station ON engine_config(station_id);

-- RLS
ALTER TABLE engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engine_config_service_role"
  ON engine_config FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE engine_config IS 'Engine behavior configuration: scheduling, recovery, delays, fallback messages.';
COMMENT ON COLUMN engine_config.recovery_order IS 'JSON array defining priority order for content recovery steps';
COMMENT ON COLUMN engine_config.silence_threshold_ms IS 'Silence duration before recovery kicks in';
COMMENT ON COLUMN engine_config.fallback_message IS 'Message spoken when no content is available';
