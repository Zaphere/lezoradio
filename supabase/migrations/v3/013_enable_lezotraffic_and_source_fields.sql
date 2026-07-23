-- 013_enable_lezotraffic_and_source_fields.sql
-- Enable LezoTraffic provider and add source attribution columns.

-- ── 1. Enable LezoTraffic in provider_configs ──────────────────────────────
UPDATE provider_configs
SET enabled = true,
    updated_at = now()
WHERE provider = 'lezotraffic';

-- ── 2. Add source attribution columns to radio_station_state ──────────────
-- These columns let the NowPlaying state carry provider/city/province
-- so the frontend can display source attribution.

ALTER TABLE radio_station_state
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN radio_station_state.provider IS 'Content provider name (lezotraffic, rss, etc.)';
COMMENT ON COLUMN radio_station_state.city IS 'City of the current content item';
COMMENT ON COLUMN radio_station_state.province IS 'Province of the current content item';
COMMENT ON COLUMN radio_station_state.description IS 'Description/summary of the current content item';

-- ── 3. Add source attribution columns to playback_history ─────────────────
ALTER TABLE playback_history
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

COMMENT ON COLUMN playback_history.provider IS 'Content provider name';
COMMENT ON COLUMN playback_history.city IS 'City of the played item';
COMMENT ON COLUMN playback_history.province IS 'Province of the played item';
