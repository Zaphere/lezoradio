-- =============================================================================
-- Migration 011: Region-aware content routing
-- Adds region to events, populates channel regions, updates TTS cache key.
-- =============================================================================

-- 1. Add region column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS region TEXT;

-- Backfill region from province for existing LezoTraffic events
-- LezoTraffic events use province = 'Kinshasa', 'Nord-Kivu', 'Haut-Katanga', etc.
UPDATE events SET region = LOWER(province) WHERE province IS NOT NULL AND region IS NULL;

-- Backfill region from news_items.region for RSS events
UPDATE events e SET region = LOWER(ni.region)
FROM news_items ni
WHERE e.provider = 'rss'
  AND e.provider_record_id = ni.id::text
  AND ni.region IS NOT NULL
  AND e.region IS NULL;

-- 2. Populate station_channels.region for DRC channels
UPDATE station_channels SET region = 'kinshasa' WHERE channel_id = 'kinshasa-main';
UPDATE station_channels SET region = 'goma' WHERE channel_id = 'goma-main';
UPDATE station_channels SET region = 'lubumbashi' WHERE channel_id = 'lubumbashi-main';
UPDATE station_channels SET region = 'global' WHERE channel_id = 'global-main';

-- 3. Update tts_audio_cache: add region column, update UNIQUE constraint
-- First, add the region column with a default for existing rows
ALTER TABLE tts_audio_cache ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';

-- Drop the old UNIQUE constraint and create a new one that includes region
ALTER TABLE tts_audio_cache DROP CONSTRAINT IF EXISTS tts_audio_cache_text_hash_voice_id_language_key;
ALTER TABLE tts_audio_cache ADD CONSTRAINT tts_audio_cache_region_voice_hash_key
  UNIQUE (region, text_hash, voice_id, language);

-- Create index for regional queries
CREATE INDEX IF NOT EXISTS idx_tts_cache_region ON tts_audio_cache(region);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
CREATE INDEX IF NOT EXISTS idx_channels_region ON station_channels(region);
