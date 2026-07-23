-- =============================================================================
-- SUPABASE DATABASE RECREATION SCRIPT
-- =============================================================================
-- This script recreates the entire LezoRadio database from scratch.
-- Run this in the Supabase SQL Editor to restore a corrupted database.
--
-- IMPORTANT: This will DELETE ALL EXISTING DATA and recreate the schema.
-- Backup any important data before running this script.
--
-- Execution Order:
-- 1. Phase 1: Core tables (stations, content_sources, station_sources)
-- 2. Phase 1 Extensions: Station extensions and regional data
-- 3. V3 Migrations: New schema (001-013)
-- 4. Seed Data: DRC-specific configuration
-- =============================================================================

-- =============================================================================
-- STEP 0: CLEANUP (Drop existing tables to start fresh)
-- =============================================================================
-- Uncomment the following lines if you want to completely reset the database
-- WARNING: This will delete all data!

-- DROP TABLE IF EXISTS playback_history CASCADE;
-- DROP TABLE IF EXISTS entertainment_tracks CASCADE;
-- DROP TABLE IF EXISTS normalizer_config CASCADE;
-- DROP TABLE IF EXISTS provider_taxonomy CASCADE;
-- DROP TABLE IF EXISTS engine_config CASCADE;
-- DROP TABLE IF EXISTS audio_config CASCADE;
-- DROP TABLE IF EXISTS content_templates CASCADE;
-- DROP TABLE IF EXISTS tts_audio_cache CASCADE;
-- DROP TABLE IF EXISTS queue_played_items CASCADE;
-- DROP TABLE IF EXISTS station_channels CASCADE;
-- DROP TABLE IF EXISTS radio_station_state CASCADE;
-- DROP TABLE IF EXISTS station_sources CASCADE;
-- DROP TABLE IF EXISTS content_sources CASCADE;
-- DROP TABLE IF EXISTS stations CASCADE;
-- DROP TABLE IF EXISTS events CASCADE;
-- DROP TABLE IF EXISTS news_items CASCADE;
-- DROP TABLE IF EXISTS radio_scripts CASCADE;
-- DROP TABLE IF EXISTS broadcast_queue CASCADE;
-- DROP TABLE IF EXISTS alerts CASCADE;
-- DROP TABLE IF EXISTS feeds CASCADE;
-- DROP TABLE IF EXISTS music_tracks CASCADE;
-- DROP TABLE IF EXISTS music_play_history CASCADE;
-- DROP TABLE IF EXISTS station_voices CASCADE;
-- DROP TABLE IF EXISTS provider_configs CASCADE;

-- =============================================================================
-- PHASE 1: CORE TABLES
-- =============================================================================

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  country    TEXT NOT NULL,
  region     TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  voice      TEXT,
  enabled    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Content sources table
CREATE TABLE IF NOT EXISTS content_sources (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'rss',
  category      TEXT NOT NULL DEFAULT 'news',
  priority      INT NOT NULL DEFAULT 5,
  enabled       BOOLEAN DEFAULT true,
  health        TEXT DEFAULT 'unknown',
  last_checked  TIMESTAMPTZ,
  last_success  TIMESTAMPTZ,
  last_failure  TIMESTAMPTZ,
  article_count INT DEFAULT 0,
  response_time INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Station-Source join table (M:N relationship)
CREATE TABLE IF NOT EXISTS station_sources (
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  source_id  UUID REFERENCES content_sources(id) ON DELETE CASCADE,
  priority   INT NOT NULL DEFAULT 5,
  enabled    BOOLEAN DEFAULT true,
  PRIMARY KEY (station_id, source_id)
);

-- =============================================================================
-- PHASE 1 EXTENSIONS: Station Extensions
-- =============================================================================

-- Add new columns to stations table
ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS priority INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Rename enabled to is_active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'enabled') THEN
    ALTER TABLE stations RENAME COLUMN enabled TO is_active;
  END IF;
END $$;

-- =============================================================================
-- PHASE 1 EXTENSIONS: Additional Core Tables
-- =============================================================================

-- Events table (for news content)
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  category TEXT,
  priority INT DEFAULT 5,
  status TEXT DEFAULT 'active',
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  city TEXT,
  province TEXT,
  country TEXT
);

-- News items table (legacy)
CREATE TABLE IF NOT EXISTS news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT,
  region TEXT,
  category TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now(),
  is_processed BOOLEAN DEFAULT false
);

-- Radio scripts table
CREATE TABLE IF NOT EXISTS radio_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  news_item_id UUID,
  script TEXT,
  script_text TEXT,
  region TEXT,
  category TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Broadcast queue table
CREATE TABLE IF NOT EXISTS broadcast_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_type TEXT NOT NULL,
  content TEXT,
  priority INT DEFAULT 5,
  is_played BOOLEAN DEFAULT false,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  region TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Feeds table
CREATE TABLE IF NOT EXISTS feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'rss',
  category TEXT DEFAULT 'news',
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Music tracks table
CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  audio_url TEXT,
  duration_ms INT,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Music play history table
CREATE TABLE IF NOT EXISTS music_play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES music_tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- Station voices table
CREATE TABLE IF NOT EXISTS station_voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  language TEXT NOT NULL,
  gender TEXT,
  style TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Provider configs table
CREATE TABLE IF NOT EXISTS provider_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- V3 MIGRATION 001: radio_station_state
-- =============================================================================

CREATE TABLE IF NOT EXISTS radio_station_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL CHECK (segment_type IN (
    'intro', 'track', 'tts', 'jingle', 'bulletin',
    'announcement', 'ambient', 'silence', 'transition'
  )),
  segment_id TEXT,
  audio_url TEXT,
  audio_type TEXT CHECK (audio_type IN ('stream', 'tts', 'jingle', 'ambient')),
  title TEXT,
  artist TEXT,
  album TEXT,
  duration_seconds INT,
  started_at TIMESTAMPTZ NOT NULL,
  transition_type TEXT CHECK (transition_type IN ('crossfade', 'duck', 'cut', 'next')),
  transition_duration_ms INT DEFAULT 1000,
  duck_volume NUMERIC(3,2),
  next_segment_type TEXT,
  next_audio_url TEXT,
  next_title TEXT,
  next_artist TEXT,
  next_duration_seconds INT,
  language TEXT NOT NULL,
  voice_id TEXT,
  version INT NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  provider TEXT,
  city TEXT,
  province TEXT,
  description TEXT,
  UNIQUE(channel_id)
);

CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_station ON radio_station_state(station_id);

ALTER TABLE radio_station_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radio_station_state_select_anon" ON radio_station_state;
CREATE POLICY "radio_station_state_select_anon"
  ON radio_station_state FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "radio_station_state_service_role" ON radio_station_state;
CREATE POLICY "radio_station_state_service_role"
  ON radio_station_state FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 002: station_channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS station_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  frequency NUMERIC(4,1),
  emoji TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  genre_weights JSONB DEFAULT '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}',
  primary_voice_id TEXT,
  voice_config JSONB DEFAULT '{"gender": "female", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}',
  broadcast_segment_ms INT DEFAULT 270000,
  entertainment_delay_ms INT DEFAULT 8000,
  station_id_interval_min_ms INT DEFAULT 600000,
  station_id_interval_max_ms INT DEFAULT 900000,
  time_announcement_interval_min_ms INT DEFAULT 1200000,
  time_announcement_interval_max_ms INT DEFAULT 1800000,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_station_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_station_channels_active ON station_channels(is_active) WHERE is_active = true;

ALTER TABLE station_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "station_channels_select_active" ON station_channels;
CREATE POLICY "station_channels_select_active"
  ON station_channels FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "station_channels_service_role" ON station_channels;
CREATE POLICY "station_channels_service_role"
  ON station_channels FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 003: queue_played_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS queue_played_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'track', 'news', 'traffic', 'weather', 'bulletin',
    'tts', 'jingle', 'entertainment', 'emergency'
  )),
  item_id TEXT NOT NULL,
  source_table TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_played_ms INT,
  completed BOOLEAN DEFAULT false,
  interrupted BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  priority_at_play INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_station ON queue_played_items(station_id);

ALTER TABLE queue_played_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queue_played_items_service_role" ON queue_played_items;
CREATE POLICY "queue_played_items_service_role"
  ON queue_played_items FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 004: tts_audio_cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS tts_audio_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  text_content TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  language TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  audio_duration_ms INT,
  audio_file_size INT,
  provider TEXT DEFAULT 'elevenlabs',
  model_id TEXT,
  stability NUMERIC(3,2),
  similarity_boost NUMERIC(3,2),
  hit_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(text_hash, voice_id, language)
);

CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_audio_cache(text_hash);

ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tts_audio_cache_service_role" ON tts_audio_cache;
CREATE POLICY "tts_audio_cache_service_role"
  ON tts_audio_cache FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 005: content_templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'transition', 'coming_up_teaser', 'station_id', 'bridge_intro',
    'bridge_outro', 'commentary', 'intro_before_track',
    'entertainment_open', 'entertainment_close',
    'french_bulletin_intro', 'french_bulletin_outro',
    'time_announcement', 'fallback_message', 'alert_banner', 'bfs_transition'
  )),
  language TEXT NOT NULL DEFAULT 'fr',
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  channel_id TEXT,
  text_content TEXT NOT NULL,
  category TEXT,
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_language ON content_templates(language);

ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_templates_select_active" ON content_templates;
CREATE POLICY "content_templates_select_active"
  ON content_templates FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "content_templates_service_role" ON content_templates;
CREATE POLICY "content_templates_service_role"
  ON content_templates FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 006: audio_config
-- =============================================================================

CREATE TABLE IF NOT EXISTS audio_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  intro_url TEXT,
  intro_cue_percent NUMERIC(4,2) DEFAULT 0.85,
  intro_duck_duration_ms INT DEFAULT 2000,
  intro_speech_overlap_seconds NUMERIC(3,1) DEFAULT 2.5,
  intro_min_before_speech NUMERIC(3,1) DEFAULT 2.0,
  intro_ducked_volume NUMERIC(3,2) DEFAULT 0.18,
  intro_fallback_cue_ms INT DEFAULT 3000,
  intro_stop_fade_steps INT DEFAULT 8,
  intro_stop_fade_step_ms INT DEFAULT 40,
  background_url TEXT,
  background_volume NUMERIC(3,2) DEFAULT 0.12,
  background_ducked_volume NUMERIC(3,2) DEFAULT 0.06,
  background_fade_in_ms INT DEFAULT 1500,
  background_fade_out_ms INT DEFAULT 1500,
  background_fade_ms INT DEFAULT 900,
  background_fade_step_ms INT DEFAULT 40,
  track_fade_ms INT DEFAULT 700,
  track_fade_step_ms INT DEFAULT 40,
  pre_track_gap_ms INT DEFAULT 500,
  speech_gap_min_ms INT DEFAULT 300,
  speech_gap_max_ms INT DEFAULT 800,
  host_fade_in_duration_ms INT DEFAULT 800,
  host_delay_after_duck_ms INT DEFAULT 400,
  transition_gap_ms INT DEFAULT 800,
  crossfade_duration_ms INT DEFAULT 1000,
  outro_fade_duration_ms INT DEFAULT 2000,
  stop_fade_duration_ms INT DEFAULT 1500,
  fade_step_ms INT DEFAULT 30,
  full_volume NUMERIC(3,2) DEFAULT 1.0,
  broadcast_segment_ms INT DEFAULT 270000,
  entertainment_delay_ms INT DEFAULT 8000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_audio_config_channel ON audio_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_config_station ON audio_config(station_id);

ALTER TABLE audio_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_config_select_active" ON audio_config;
CREATE POLICY "audio_config_select_active"
  ON audio_config FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "audio_config_service_role" ON audio_config;
CREATE POLICY "audio_config_service_role"
  ON audio_config FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 007: engine_config
-- =============================================================================

CREATE TABLE IF NOT EXISTS engine_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  poll_interval_ms INT DEFAULT 15000,
  alert_display_duration_ms INT DEFAULT 5000,
  teaser_interval INT DEFAULT 4,
  entertainment_delay_all_played_ms INT DEFAULT 5000,
  entertainment_delay_many_stories_ms INT DEFAULT 12000,
  entertainment_delay_moderate_stories_ms INT DEFAULT 8000,
  entertainment_delay_few_stories_ms INT DEFAULT 5000,
  silence_threshold_ms INT DEFAULT 3500,
  bfs_check_interval_ms INT DEFAULT 2000,
  bridge_check_interval_ms INT DEFAULT 30000,
  min_bridge_duration_ms INT DEFAULT 20000,
  max_transition_length INT DEFAULT 200,
  recovery_order JSONB DEFAULT '["check_alerts", "check_breaking_news", "check_scheduled_bulletins", "check_pending_rss", "check_cached_scripts", "activate_bridge"]',
  fallback_message TEXT DEFAULT 'No recent news feeds detected. Please stand by for the next update.',
  default_timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_engine_config_channel ON engine_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_station ON engine_config(station_id);

ALTER TABLE engine_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engine_config_service_role" ON engine_config;
CREATE POLICY "engine_config_service_role"
  ON engine_config FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 008: provider_taxonomy
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_taxonomy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN (
    'incident_type', 'severity_map', 'category_map', 'subcategory_map',
    'region_country_map', 'city_keywords', 'priority_rules',
    'rss_category_map', 'rss_subcategory_map'
  )),
  provider TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  source_key TEXT NOT NULL,
  target_value JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(taxonomy_type, provider, source_key)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON provider_taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_provider ON provider_taxonomy(provider);

ALTER TABLE provider_taxonomy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_taxonomy_service_role" ON provider_taxonomy;
CREATE POLICY "provider_taxonomy_service_role"
  ON provider_taxonomy FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 009: normalizer_config
-- =============================================================================

CREATE TABLE IF NOT EXISTS normalizer_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, config_key)
);

CREATE INDEX IF NOT EXISTS idx_normalizer_config_provider ON normalizer_config(provider);

ALTER TABLE normalizer_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "normalizer_config_service_role" ON normalizer_config;
CREATE POLICY "normalizer_config_service_role"
  ON normalizer_config FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 010: playback_history
-- =============================================================================

CREATE TABLE IF NOT EXISTS playback_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL CHECK (segment_type IN (
    'intro', 'track', 'tts', 'jingle', 'bulletin',
    'announcement', 'ambient', 'silence', 'transition'
  )),
  segment_id TEXT,
  source_table TEXT,
  audio_url TEXT,
  title TEXT,
  artist TEXT,
  duration_seconds INT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  interrupted BOOLEAN DEFAULT false,
  interrupt_reason TEXT,
  language TEXT,
  voice_id TEXT,
  priority_at_play INT,
  metadata JSONB,
  provider TEXT,
  city TEXT,
  province TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playback_history_channel ON playback_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_station ON playback_history(station_id);

ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playback_history_service_role" ON playback_history;
CREATE POLICY "playback_history_service_role"
  ON playback_history FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 011: entertainment_tracks
-- =============================================================================

CREATE TABLE IF NOT EXISTS entertainment_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  music_track_id UUID REFERENCES music_tracks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  mood TEXT,
  audio_url TEXT NOT NULL,
  duration_ms INT NOT NULL,
  commentary_templates JSONB DEFAULT '[]',
  intro_before_track JSONB DEFAULT '[]',
  segment_open TEXT,
  segment_close TEXT,
  is_active BOOLEAN DEFAULT true,
  play_count INT DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  cooldown_minutes INT DEFAULT 60,
  channel_id TEXT,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_active ON entertainment_tracks(is_active) WHERE is_active = true;

ALTER TABLE entertainment_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entertainment_tracks_select_active" ON entertainment_tracks;
CREATE POLICY "entertainment_tracks_select_active"
  ON entertainment_tracks FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "entertainment_tracks_service_role" ON entertainment_tracks;
CREATE POLICY "entertainment_tracks_service_role"
  ON entertainment_tracks FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- V3 MIGRATION 012: events trigger for pg_notify
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_engine_new_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_event', json_build_object(
    'id', NEW.id,
    'provider', NEW.provider,
    'category', NEW.category,
    'priority', NEW.priority,
    'channel_id', NEW.metadata->>'channel_id'
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_notify_engine ON events;
CREATE TRIGGER trg_events_notify_engine
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_engine_new_event();

-- =============================================================================
-- V3 MIGRATION 013: Enable LezoTraffic and source fields
-- =============================================================================

-- Add source attribution columns to radio_station_state
ALTER TABLE radio_station_state
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add source attribution columns to playback_history
ALTER TABLE playback_history
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

-- =============================================================================
-- SEED DATA: Insert Stations
-- =============================================================================

INSERT INTO stations (name, country, country_code, region, language, priority, is_active, timezone)
VALUES
  ('South Africa', 'South Africa', 'ZA', 'Southern Africa', 'en', 1, true, 'Africa/Johannesburg'),
  ('Zambia', 'Zambia', 'ZM', 'Southern Africa', 'en', 2, true, 'Africa/Lusaka'),
  ('Malawi', 'Malawi', 'MW', 'Southern Africa', 'en', 2, true, 'Africa/Blantyre'),
  ('Botswana', 'Botswana', 'BW', 'Southern Africa', 'en', 2, true, 'Africa/Gaborone'),
  ('Namibia', 'Namibia', 'NA', 'Southern Africa', 'en', 2, true, 'Africa/Windhoek'),
  ('Mozambique', 'Mozambique', 'MZ', 'Southern Africa', 'en', 2, true, 'Africa/Maputo'),
  ('DR Congo', 'Democratic Republic of Congo', 'CD', 'Central Africa', 'en', 1, true, 'Africa/Kinshasa'),
  ('Congo', 'Republic of Congo', 'CG', 'Central Africa', 'en', 2, true, 'Africa/Brazzaville'),
  ('Cameroon', 'Cameroon', 'CM', 'Central Africa', 'en', 1, true, 'Africa/Douala'),
  ('Gabon', 'Gabon', 'GA', 'Central Africa', 'en', 2, true, 'Africa/Libreville'),
  ('Central African Republic', 'Central African Republic', 'CF', 'Central Africa', 'en', 2, true, 'Africa/Bangui'),
  ('Chad', 'Chad', 'TD', 'Central Africa', 'en', 2, true, 'Africa/Ndjamena'),
  ('Tanzania', 'Tanzania', 'TZ', 'East Africa', 'en', 1, true, 'Africa/Dar_es_Salaam'),
  ('Kenya', 'Kenya', 'KE', 'East Africa', 'en', 1, true, 'Africa/Nairobi'),
  ('Uganda', 'Uganda', 'UG', 'East Africa', 'en', 1, true, 'Africa/Kampala'),
  ('Rwanda', 'Rwanda', 'RW', 'East Africa', 'en', 2, true, 'Africa/Kigali'),
  ('Burundi', 'Burundi', 'BI', 'East Africa', 'en', 2, true, 'Africa/Bujumbura'),
  ('South Sudan', 'South Sudan', 'SS', 'East Africa', 'en', 2, true, 'Africa/Juba'),
  ('Egypt', 'Egypt', 'EG', 'North Africa', 'en', 3, true, 'Africa/Cairo'),
  ('Algeria', 'Algeria', 'DZ', 'North Africa', 'en', 3, true, 'Africa/Algiers'),
  ('Morocco', 'Morocco', 'MA', 'North Africa', 'en', 3, true, 'Africa/Casablanca'),
  ('Tunisia', 'Tunisia', 'TN', 'North Africa', 'en', 3, true, 'Africa/Tunis')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Insert Content Sources
-- =============================================================================

INSERT INTO content_sources (name, url, type, category, priority)
VALUES
  ('BBC Africa', 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'rss', 'news', 1),
  ('Africanews', 'https://www.africanews.com/feed/rss', 'rss', 'news', 2),
  ('Guardian Africa', 'https://www.theguardian.com/world/africa/rss', 'rss', 'news', 3),
  ('Africa.com', 'https://africa.com/feed', 'rss', 'news', 4),
  ('How We Made It', 'https://www.howwemadeitinafrica.com/feed/', 'rss', 'agriculture', 5),
  ('Eswatini Headlines', 'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf', 'rss', 'local', 1),
  ('IOL South Africa', 'https://www.iol.co.za/rss', 'rss', 'regional', 2),
  ('Radio Okapi', 'https://www.radiookapi.net/rss.xml', 'rss', 'regional', 3),
  ('Africa Traffic News', 'https://news.google.com/rss/search?q=traffic+Africa&hl=en-US&gl=US&ceid=US:en', 'rss', 'traffic', 4),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'rss', 'tech', 5)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Link Sources to Stations
-- =============================================================================

INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE cs.name IN ('BBC Africa', 'Africanews', 'Guardian Africa', 'Africa.com', 'How We Made It')
ON CONFLICT (station_id, source_id) DO NOTHING;

-- =============================================================================
-- SEED DATA: Provider Configs
-- =============================================================================

INSERT INTO provider_configs (provider, config, enabled)
VALUES
  ('lezotraffic', '{"enabled": false, "api_endpoint": "", "api_key": ""}'::jsonb, false),
  ('rss', '{"enabled": true, "fetch_interval_ms": 300000}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Default Audio Config
-- =============================================================================

INSERT INTO audio_config (
  channel_id, station_id,
  intro_url, background_url,
  background_volume, background_fade_ms,
  track_fade_ms, speech_gap_min_ms, speech_gap_max_ms,
  broadcast_segment_ms, entertainment_delay_ms
)
VALUES (
  NULL, NULL,
  NULL, NULL,
  0.12, 900,
  700, 300, 800,
  270000, 8000
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Default Engine Config
-- =============================================================================

INSERT INTO engine_config (
  channel_id, station_id,
  silence_threshold_ms, teaser_interval,
  entertainment_delay_all_played_ms, entertainment_delay_many_stories_ms,
  entertainment_delay_moderate_stories_ms, entertainment_delay_few_stories_ms,
  fallback_message, default_timezone
)
VALUES (
  NULL, NULL,
  3500, 4,
  5000, 12000, 8000, 5000,
  'No recent news feeds detected. Please stand by for the next update.',
  'UTC'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Content Templates (Transitions)
-- =============================================================================

INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'en', 'Next update coming your way…', true),
  ('transition', 'en', 'In regional news today…', true),
  ('transition', 'en', 'Moving to traffic updates…', true),
  ('transition', 'en', 'Here''s what''s happening now…', true),
  ('transition', 'en', 'Now for the latest reports…', true),
  ('transition', 'en', 'Continuing with today''s stories…', true),
  ('transition', 'en', 'And now from our news desk…', true),
  ('transition', 'en', 'Let''s look at what else is making headlines…', true),
  ('station_id', 'en', 'You''re listening to {station}. Stay tuned.', true),
  ('station_id', 'en', 'This is {station}. We''ll be right back with more.', true),
  ('station_id', 'en', 'You''re with {station}. More news coming up.', true),
  ('station_id', 'en', 'Live from {station}. We continue in a moment.', true),
  ('coming_up_teaser', 'en', 'Coming up, more stories from our news desk.', true),
  ('coming_up_teaser', 'en', 'Still to come, the latest developments.', true),
  ('coming_up_teaser', 'en', 'Up next, more updates for you.', true),
  ('time_announcement', 'en', 'It''s {time}. You''re listening to {station}.', true),
  ('fallback_message', 'en', 'No recent news feeds detected. Please stand by for the next update.', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DONE!
-- =============================================================================
-- Database recreation complete. Verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT COUNT(*) FROM stations;
-- SELECT COUNT(*) FROM content_sources;
-- =============================================================================
