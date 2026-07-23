-- =============================================================================
-- AARN FULL SCHEMA — Consolidated SQL for Supabase
-- =============================================================================
-- Run this single file in the Supabase SQL Editor to create the complete
-- AARN database schema with all DRC seed data.
--
-- Execution order:
--   1. DROP old tables (optional — uncomment if you want a fresh start)
--   2. Core tables (stations, content_sources, station_sources)
--   3. Phase 1 extensions (columns + regional data)
--   4. Additional core tables (events, news_items, radio_scripts, etc.)
--   5. V3 engine tables (radio_station_state, station_channels, etc.)
--   6. Triggers and functions
--   7. Seed data — all 22 African countries
--   8. Seed data — DRC channels, voices, templates, config
-- =============================================================================


-- =============================================================================
-- STEP 0: CLEANUP (Uncomment if you want to completely reset)
-- =============================================================================
-- WARNING: This deletes all data! Back up first.
/*
DROP TABLE IF EXISTS playback_history CASCADE;
DROP TABLE IF EXISTS entertainment_tracks CASCADE;
DROP TABLE IF EXISTS normalizer_config CASCADE;
DROP TABLE IF EXISTS provider_taxonomy CASCADE;
DROP TABLE IF EXISTS engine_config CASCADE;
DROP TABLE IF EXISTS audio_config CASCADE;
DROP TABLE IF EXISTS content_templates CASCADE;
DROP TABLE IF EXISTS tts_audio_cache CASCADE;
DROP TABLE IF EXISTS queue_played_items CASCADE;
DROP TABLE IF EXISTS station_channels CASCADE;
DROP TABLE IF EXISTS radio_station_state CASCADE;
DROP TABLE IF EXISTS station_sources CASCADE;
DROP TABLE IF EXISTS content_sources CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS news_items CASCADE;
DROP TABLE IF EXISTS radio_scripts CASCADE;
DROP TABLE IF EXISTS broadcast_queue CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS feeds CASCADE;
DROP TABLE IF EXISTS music_tracks CASCADE;
DROP TABLE IF EXISTS music_play_history CASCADE;
DROP TABLE IF EXISTS station_voices CASCADE;
DROP TABLE IF EXISTS provider_configs CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS feature_flag_overrides CASCADE;
DROP TABLE IF EXISTS feature_flag_log CASCADE;
DROP TABLE IF EXISTS music_playlists CASCADE;
DROP TABLE IF EXISTS playlist_tracks CASCADE;
DROP TABLE IF EXISTS translation_cache CASCADE;
DROP TABLE IF EXISTS language_detection_cache CASCADE;
DROP TABLE IF EXISTS prompt_templates CASCADE;
DROP TABLE IF EXISTS prompt_template_history CASCADE;
DROP TABLE IF EXISTS station_schedules CASCADE;
DROP TABLE IF EXISTS station_analytics CASCADE;
DROP TABLE IF EXISTS provider_sync_logs CASCADE;
DROP TABLE IF EXISTS ingestion_logs CASCADE;
DROP TABLE IF EXISTS bulletin_schedule CASCADE;
DROP TRIGGER IF EXISTS trg_events_notify_engine ON events;
DROP FUNCTION IF EXISTS notify_engine_new_event() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;
DROP FUNCTION IF EXISTS get_random_background_music() CASCADE;
*/


-- =============================================================================
-- 1. CORE TABLES
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
  country_code TEXT,
  image_url  TEXT,
  priority   INT DEFAULT 1,
  timezone   TEXT,
  v2_config  JSONB DEFAULT '{}',
  v2_status  TEXT DEFAULT 'inactive',
  v2_last_migration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'enabled' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'is_active')) THEN
    ALTER TABLE stations RENAME COLUMN enabled TO is_active;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

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
  translation_required BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Station-Source join table
CREATE TABLE IF NOT EXISTS station_sources (
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  source_id  UUID REFERENCES content_sources(id) ON DELETE CASCADE,
  priority   INT NOT NULL DEFAULT 5,
  enabled    BOOLEAN DEFAULT true,
  PRIMARY KEY (station_id, source_id)
);

-- Events table (unified provider framework)
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_record_id TEXT,
  provider_type TEXT,
  provider_hash TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  priority INT NOT NULL DEFAULT 5,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  country TEXT DEFAULT 'CD',
  province TEXT,
  city TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  status TEXT DEFAULT 'active',
  verified BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'fr',
  occurred_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  raw_payload JSONB,
  raw_payload_version INT DEFAULT 1,
  api_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_record_id)
);

-- Add missing columns to events (handles upgrades from older schemas)
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_hash TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_payload_version INT DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS api_version TEXT;

-- Add missing columns to stations (handles upgrades from older schemas)
ALTER TABLE stations ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to content_sources (handles upgrades from older schemas)
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS translation_required BOOLEAN DEFAULT false;

-- Add missing columns to news_items (handles upgrades from older schemas)
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS is_translated BOOLEAN DEFAULT false;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS source_language TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS translation_required BOOLEAN DEFAULT false;

-- Add missing columns to radio_scripts (handles upgrades from older schemas)
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS script_text TEXT;
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'news';

-- Add missing columns to alerts (handles upgrades from older schemas)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing columns to feeds (handles upgrades from older schemas)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add missing columns to station_voices (handles upgrades from older schemas)
ALTER TABLE station_voices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to translation_cache (handles upgrades from older schemas)
ALTER TABLE translation_cache ADD COLUMN IF NOT EXISTS source_text TEXT;

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
  language TEXT DEFAULT 'fr',
  is_translated BOOLEAN DEFAULT false,
  source_language TEXT,
  translation_required BOOLEAN DEFAULT false,
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
  type TEXT DEFAULT 'news',
  region TEXT,
  category TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Broadcast queue table (legacy)
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
  region TEXT,
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Music tracks table
CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT NOT NULL DEFAULT 'default',
  language TEXT DEFAULT 'fr',
  duration_ms INT NOT NULL,
  bpm INT,
  mood TEXT,
  tags JSONB DEFAULT '[]',
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  is_explicit BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Music play history table
CREATE TABLE IF NOT EXISTS music_play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  track_id UUID REFERENCES music_tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT now(),
  duration_played_ms INT,
  completed BOOLEAN DEFAULT false
);

-- Music playlists
CREATE TABLE IF NOT EXISTS music_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  shuffle BOOLEAN DEFAULT false,
  loop BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Playlist tracks junction
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  position INT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Station voices table
CREATE TABLE IF NOT EXISTS station_voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  language TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'neutral')) DEFAULT 'neutral',
  style TEXT CHECK (style IN ('formal', 'casual', 'dramatic')) DEFAULT 'formal',
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, language, voice_id)
);

-- Station schedules
CREATE TABLE IF NOT EXISTS station_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('news', 'music', 'entertainment', 'weather', 'traffic', 'emergency')),
  start_time TIME NOT NULL,
  end_time TIME,
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'custom')) DEFAULT 'daily',
  recurrence_pattern TEXT,
  priority INT NOT NULL DEFAULT 5,
  language TEXT NOT NULL DEFAULT 'fr',
  content_config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Station analytics
CREATE TABLE IF NOT EXISTS station_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Provider configs
CREATE TABLE IF NOT EXISTS provider_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  priority INT DEFAULT 5,
  sync_schedule TEXT,
  capabilities JSONB,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Provider sync logs
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT,
  status TEXT NOT NULL,
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  items_updated INT DEFAULT 0,
  items_skipped INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  errors TEXT,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingestion logs
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_source TEXT NOT NULL,
  feed_url TEXT,
  language TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'fail')),
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  items_skipped INT DEFAULT 0,
  errors TEXT,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bulletin schedule
CREATE TABLE IF NOT EXISTS bulletin_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL DEFAULT 'french_global',
  language TEXT NOT NULL DEFAULT 'fr',
  hour INT NOT NULL,
  minute INT NOT NULL DEFAULT 0,
  duration_s INT NOT NULL DEFAULT 300,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_environments JSONB DEFAULT '["development", "staging", "production"]',
  allowed_stations JSONB DEFAULT '[]',
  allowed_languages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Feature flag overrides
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  user_id UUID,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(flag_id, user_id, station_id)
);

-- Feature flag log
CREATE TABLE IF NOT EXISTS feature_flag_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  user_id UUID,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  was_enabled BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now()
);

-- Translation cache
CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  source_text TEXT,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.9,
  provider TEXT DEFAULT 'google',
  content_type TEXT DEFAULT 'script',
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  UNIQUE(text_hash, source_language, target_language)
);

-- Language detection cache
CREATE TABLE IF NOT EXISTS language_detection_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash TEXT NOT NULL,
  detected_language TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  alternatives JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(content_hash)
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('news', 'traffic', 'weather', 'entertainment', 'sports', 'bulletin')),
  language TEXT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prompt template history
CREATE TABLE IF NOT EXISTS prompt_template_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  changed_by TEXT DEFAULT 'system',
  changed_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- 2. V3 ENGINE TABLES
-- =============================================================================

-- radio_station_state (core sync table)
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
  duration_seconds_col INT,
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

-- Add source attribution columns (from migration 013)
ALTER TABLE radio_station_state ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE radio_station_state ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE radio_station_state ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE radio_station_state ADD COLUMN IF NOT EXISTS description TEXT;

-- station_channels
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
  station_name TEXT,
  timezone TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- queue_played_items
CREATE TABLE IF NOT EXISTS queue_played_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'track', 'news', 'traffic', 'weather', 'bulletin',
    'tts', 'jingle', 'entertainment', 'emergency', 'event'
  )),
  item_id TEXT NOT NULL,
  source_table TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_played_ms INT,
  completed BOOLEAN DEFAULT false,
  interrupted BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  priority_at_play INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- tts_audio_cache
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

-- content_templates
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

-- audio_config
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

-- engine_config
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
  station_id_interval_min_ms INT DEFAULT 1200000,
  station_id_interval_max_ms INT DEFAULT 1800000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, station_id)
);

-- provider_taxonomy
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

-- normalizer_config
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

-- playback_history
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

-- Add missing columns to playback_history (handles upgrades from older schemas)
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS voice_id TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS priority_at_play INT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE CASCADE;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS interrupted BOOLEAN DEFAULT false;
ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS interrupt_reason TEXT;

-- entertainment_tracks
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


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

-- events
CREATE INDEX IF NOT EXISTS idx_events_provider ON events(provider);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_provider_record_id ON events(provider, provider_record_id);
CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);
CREATE INDEX IF NOT EXISTS idx_events_provider_hash ON events(provider_hash);

-- news_items
CREATE INDEX IF NOT EXISTS idx_news_items_language ON news_items(language);
CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON news_items(category);
CREATE INDEX IF NOT EXISTS idx_news_items_url ON news_items(url);
CREATE INDEX IF NOT EXISTS idx_news_items_feed_id ON news_items(feed_id);
CREATE INDEX IF NOT EXISTS idx_news_items_ingested_at ON news_items(ingested_at DESC);

-- radio_scripts
CREATE INDEX IF NOT EXISTS idx_radio_scripts_news_item_id ON radio_scripts(news_item_id);

-- provider configs
CREATE INDEX IF NOT EXISTS idx_provider_configs_provider ON provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled ON provider_configs(enabled);

-- provider sync logs
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider ON provider_sync_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_endpoint ON provider_sync_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_created_at ON provider_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_status ON provider_sync_logs(status);

-- ingestion logs
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status ON ingestion_logs(status);

-- station_voices
CREATE INDEX IF NOT EXISTS idx_station_voices_station_id ON station_voices(station_id);
CREATE INDEX IF NOT EXISTS idx_station_voices_language ON station_voices(language);

-- station_schedules
CREATE INDEX IF NOT EXISTS idx_station_schedules_station_id ON station_schedules(station_id);
CREATE INDEX IF NOT EXISTS idx_station_schedules_event_type ON station_schedules(event_type);

-- station_analytics
CREATE INDEX IF NOT EXISTS idx_station_analytics_station_id ON station_analytics(station_id);
CREATE INDEX IF NOT EXISTS idx_station_analytics_metric_name ON station_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_station_analytics_recorded_at ON station_analytics(recorded_at DESC);

-- music
CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_music_tracks_language ON music_tracks(language);
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood ON music_tracks(mood);
CREATE INDEX IF NOT EXISTS idx_music_tracks_available ON music_tracks(is_available);
CREATE INDEX IF NOT EXISTS idx_music_playlists_station_id ON music_playlists(station_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_station_id ON music_play_history(station_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_track_id ON music_play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_played_at ON music_play_history(played_at DESC);

-- feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag_id ON feature_flag_overrides(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_station_id ON feature_flag_overrides(station_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_flag_id ON feature_flag_log(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_evaluated_at ON feature_flag_log(evaluated_at DESC);

-- translation cache
CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_translation_cache_languages ON translation_cache(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_hash ON language_detection_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_expires ON language_detection_cache(expires_at);

-- prompt templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_station_id ON prompt_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_prompt_type ON prompt_templates(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_language ON prompt_templates(language);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_template_history_template_id ON prompt_template_history(template_id);

-- v3 engine indexes
CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_station ON radio_station_state(station_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_version ON radio_station_state(channel_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_station_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_station_channels_active ON station_channels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_station_channels_language ON station_channels(language);
CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_station ON queue_played_items(station_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_item ON queue_played_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_at ON queue_played_items(channel_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_played_expires ON queue_played_items(channel_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_queue_played_lookup ON queue_played_items(channel_id, item_type, item_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_audio_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice ON tts_audio_cache(voice_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_expires ON tts_audio_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tts_cache_lookup ON tts_audio_cache(text_hash, voice_id, language);
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_language ON content_templates(language);
CREATE INDEX IF NOT EXISTS idx_content_templates_station ON content_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_channel ON content_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(template_type, language, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_audio_config_channel ON audio_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_config_station ON audio_config(station_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_channel ON engine_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_station ON engine_config(station_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON provider_taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_provider ON provider_taxonomy(provider);
CREATE INDEX IF NOT EXISTS idx_taxonomy_lookup ON provider_taxonomy(taxonomy_type, provider, source_key);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_provider ON normalizer_config(provider);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_lookup ON normalizer_config(provider, config_key);
CREATE INDEX IF NOT EXISTS idx_playback_history_channel ON playback_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_station ON playback_history(station_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_started ON playback_history(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_history_type ON playback_history(segment_type);
CREATE INDEX IF NOT EXISTS idx_playback_history_source ON playback_history(source_table, segment_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_active ON entertainment_tracks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_channel ON entertainment_tracks(channel_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_mood ON entertainment_tracks(mood);


-- =============================================================================
-- 4. RLS POLICIES
-- =============================================================================

ALTER TABLE radio_station_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_played_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalizer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radio_station_state_select_anon" ON radio_station_state;
CREATE POLICY "radio_station_state_select_anon" ON radio_station_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "radio_station_state_service_role" ON radio_station_state;
CREATE POLICY "radio_station_state_service_role" ON radio_station_state FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "station_channels_select_active" ON station_channels;
CREATE POLICY "station_channels_select_active" ON station_channels FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "station_channels_service_role" ON station_channels;
CREATE POLICY "station_channels_service_role" ON station_channels FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "queue_played_items_service_role" ON queue_played_items;
CREATE POLICY "queue_played_items_service_role" ON queue_played_items FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "tts_audio_cache_service_role" ON tts_audio_cache;
CREATE POLICY "tts_audio_cache_service_role" ON tts_audio_cache FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "content_templates_select_active" ON content_templates;
CREATE POLICY "content_templates_select_active" ON content_templates FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "content_templates_service_role" ON content_templates;
CREATE POLICY "content_templates_service_role" ON content_templates FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "audio_config_select_active" ON audio_config;
CREATE POLICY "audio_config_select_active" ON audio_config FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "audio_config_service_role" ON audio_config;
CREATE POLICY "audio_config_service_role" ON audio_config FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "engine_config_service_role" ON engine_config;
CREATE POLICY "engine_config_service_role" ON engine_config FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "provider_taxonomy_service_role" ON provider_taxonomy;
CREATE POLICY "provider_taxonomy_service_role" ON provider_taxonomy FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "normalizer_config_service_role" ON normalizer_config;
CREATE POLICY "normalizer_config_service_role" ON normalizer_config FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "playback_history_service_role" ON playback_history;
CREATE POLICY "playback_history_service_role" ON playback_history FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "entertainment_tracks_select_active" ON entertainment_tracks;
CREATE POLICY "entertainment_tracks_select_active" ON entertainment_tracks FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "entertainment_tracks_service_role" ON entertainment_tracks;
CREATE POLICY "entertainment_tracks_service_role" ON entertainment_tracks FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- 5. FUNCTIONS & TRIGGERS
-- =============================================================================

-- pg_notify trigger for new events
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

-- Translation cache cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM translation_cache WHERE expires_at < now();
  DELETE FROM language_detection_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Random background music selector
CREATE OR REPLACE FUNCTION get_random_background_music()
RETURNS TEXT AS $$
BEGIN
  RETURN ARRAY[
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3',
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3',
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3'
  ][floor(random() * 3 + 1)];
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 6. SEED DATA — ALL 22 AFRICAN COUNTRIES
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

-- Content sources
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

-- Link sources to stations
INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE cs.name IN ('BBC Africa', 'Africanews', 'Guardian Africa', 'Africa.com', 'How We Made It')
ON CONFLICT (station_id, source_id) DO NOTHING;


-- =============================================================================
-- 7. SEED DATA — PROVIDER CONFIGS
-- =============================================================================

INSERT INTO provider_configs (provider, enabled, config, priority, sync_schedule)
VALUES
  ('rss', true, '{"feed_count": 0}', 5, '*/15 * * * *'),
  ('lezotraffic', true, '{}', 1, '*/1 * * * *')
ON CONFLICT (provider) DO NOTHING;

-- Feature flags
INSERT INTO feature_flags (id, name, description, enabled, rollout_percentage)
VALUES
  ('v2-provider-engine', 'V2 Provider Engine', 'Use the new provider engine for content ingestion', true, 100),
  ('v2-queue-engine', 'V2 Queue Engine', 'Use the new queue engine for broadcast queue management', true, 100),
  ('v2-broadcast-engine', 'V2 Broadcast Engine', 'Use the new broadcast engine for playback control', true, 100),
  ('v2-voice-engine', 'V2 Voice Engine', 'Use the new voice engine for TTS generation', true, 100),
  ('v2-audio-engine', 'V2 Audio Engine', 'Use the new audio engine for mixing and playback', true, 100),
  ('v2-music-engine', 'V2 Music Engine', 'Use the new music engine for playlist management', true, 100),
  ('v2-transition-engine', 'V2 Transition Engine', 'Use the new transition engine for audio transitions', true, 100),
  ('v2-ai-director', 'V2 AI Director', 'Use the new AI director for script generation', true, 100),
  ('v2-language-engine', 'V2 Language Engine', 'Use the new language engine for translation and detection', true, 100),
  ('v2-station-engine', 'V2 Station Engine', 'Use the new station engine for configuration management', true, 100),
  ('v2-scheduling-engine', 'V2 Scheduling Engine', 'Use the new scheduling engine for event management', true, 100),
  ('v2-alert-engine', 'V2 Alert Engine', 'Use the new alert engine for emergency and traffic alerts', true, 100),
  ('v2-analytics-engine', 'V2 Analytics Engine', 'Use the new analytics engine for metrics collection', true, 100)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 8. SEED DATA — BULLETIN SCHEDULE
-- =============================================================================

INSERT INTO bulletin_schedule (name, label, type, language, hour, minute, duration_s)
VALUES
  ('French Global Bulletin — Morning', 'Matin', 'french_global', 'fr', 9,  0, 300),
  ('French Global Bulletin — Midday', 'Midi', 'french_global', 'fr', 12, 0, 300),
  ('French Global Bulletin — Afternoon', 'Après-midi', 'french_global', 'fr', 15, 0, 300),
  ('French Global Bulletin — Evening', 'Soir', 'french_global', 'fr', 18, 0, 300),
  ('French Global Bulletin — Night', 'Nuit', 'french_global', 'fr', 21, 0, 300)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 9. SEED DATA — DRC VOICE PROFILES
-- =============================================================================

-- Lingala voice for Kinshasa
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-lingala-female-01', 'ln', 'female', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Goma
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-swahili-male-01', 'sw', 'male', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Lubumbashi
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-swahili-female-01', 'sw', 'female', 'casual', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- French voice (for bulletins)
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-french-female-01', 'fr', 'female', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;


-- =============================================================================
-- 10. SEED DATA — DRC STATION CHANNELS
-- =============================================================================

-- Kinshasa Main (Lingala)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'kinshasa-main', 'Kinshasa Main',
  'Primary Kinshasa broadcast channel in Lingala',
  88.1, '🇨🇩',
  'ln',
  '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Kinshasa', 'Africa/Kinshasa'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'ln' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- Goma Main (Swahili)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'goma-main', 'Goma Main',
  'Primary Goma broadcast channel in Swahili',
  92.5, '🌋',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "male", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Goma', 'Africa/Maputo'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- Lubumbashi Main (Swahili)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'lubumbashi-main', 'Lubumbashi Main',
  'Primary Lubumbashi broadcast channel in Swahili',
  95.3, '⛏️',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "casual", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Lubumbashi', 'Africa/Maputo'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;


-- =============================================================================
-- 11. SEED DATA — CONTENT TEMPLATES
-- =============================================================================

-- French transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'fr', 'Next update coming your way in just a moment.', true),
  ('transition', 'fr', 'Stay with us, more news on the way.', true),
  ('transition', 'fr', 'We''ll be right back with more updates.', true),
  ('transition', 'fr', 'Don''t go anywhere, we have more stories for you.', true),
  ('transition', 'fr', 'Plus d''actualités dans un instant.', true),
  ('transition', 'fr', 'Restez avec nous, d''autres informations suivent.', true),
  ('transition', 'fr', 'Nous revenons avec de nouvelles mises à jour.', true),
  ('transition', 'fr', 'Ne bougez pas, d''autres histoires arrivent.', true)
ON CONFLICT DO NOTHING;

-- Lingala transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'ln', 'Toki ekoya mo nzete ndakisa.', true),
  ('transition', 'ln', 'Pasieti, toki ekoya na biloko ebengi.', true),
  ('transition', 'ln', 'Tina ekoya na updates nyingi.', true),
  ('transition', 'ln', 'Kala na ye, toki ekoya na biloko mingi.', true)
ON CONFLICT DO NOTHING;

-- Swahili transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'sw', 'Endelea kusikiliza, habari zaidi zinakuja.', true),
  ('transition', 'sw', 'Umbeya, habari za hivi karibuni zinafuata.', true),
  ('transition', 'sw', 'Tunaendelea na habari zaidi baada ya hapo.', true),
  ('transition', 'sw', 'Usiende popote, kuna hadithi zaidi.', true)
ON CONFLICT DO NOTHING;

-- English transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'en', 'Next update coming your way…', true),
  ('transition', 'en', 'In regional news today…', true),
  ('transition', 'en', 'Moving to traffic updates…', true),
  ('transition', 'en', 'Here''s what''s happening now…', true),
  ('transition', 'en', 'Now for the latest reports…', true),
  ('transition', 'en', 'Continuing with today''s stories…', true),
  ('transition', 'en', 'And now from our news desk…', true),
  ('transition', 'en', 'Let''s look at what else is making headlines…', true)
ON CONFLICT DO NOTHING;

-- French station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'fr', 'Vous écoutez {station}. Restez à l''écoute.', true),
  ('station_id', 'fr', 'Ceci est {station}, votre source d''information.', true),
  ('station_id', 'fr', '{station} — l''information en continu.', true)
ON CONFLICT DO NOTHING;

-- Lingala station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'ln', 'Nasikisi {station}. Kala na ye.', true),
  ('station_id', 'ln', 'Ye {station}, oyo ezali source ya information.', true),
  ('station_id', 'ln', '{station} — information ya kowaka.', true)
ON CONFLICT DO NOTHING;

-- Swahili station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'sw', 'Unasikiliza {station}. Endelea kusikiliza.', true),
  ('station_id', 'sw', 'Hii ni {station}, chanzo chako cha habari.', true),
  ('station_id', 'sw', '{station} — habari za wakati wote.', true)
ON CONFLICT DO NOTHING;

-- English station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'en', 'You''re listening to {station}. Stay tuned.', true),
  ('station_id', 'en', 'This is {station}. We''ll be right back with more.', true),
  ('station_id', 'en', 'You''re with {station}. More news coming up.', true),
  ('station_id', 'en', 'Live from {station}. We continue in a moment.', true)
ON CONFLICT DO NOTHING;

-- Fallback messages
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('fallback_message', 'fr', 'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.', true),
  ('fallback_message', 'ln', 'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.', true),
  ('fallback_message', 'sw', 'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.', true),
  ('fallback_message', 'en', 'No recent news feeds detected. Please stand by for the next update.', true)
ON CONFLICT DO NOTHING;

-- Time announcements
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('time_announcement', 'fr', 'Il est maintenant {time}.', true),
  ('time_announcement', 'ln', 'Sɛsɛ ezali {time}.', true),
  ('time_announcement', 'sw', 'Sasa ni {time}.', true),
  ('time_announcement', 'en', 'It''s {time}. You''re listening to {station}.', true)
ON CONFLICT DO NOTHING;

-- Coming up teasers
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('coming_up_teaser', 'fr', 'À venir, plus d''actualités de notre rédaction.', true),
  ('coming_up_teaser', 'fr', 'Restez tuned, nous avons d''autres histoires pour vous.', true),
  ('coming_up_teaser', 'ln', 'Tokina ekoya, biloko ebengi ya information.', true),
  ('coming_up_teaser', 'sw', 'Baada ya hapo, habari zaidi kutoka ofisi yetu.', true),
  ('coming_up_teaser', 'en', 'Coming up, more stories from our news desk.', true),
  ('coming_up_teaser', 'en', 'Still to come, the latest developments.', true),
  ('coming_up_teaser', 'en', 'Up next, more updates for you.', true)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 12. SEED DATA — DRC AUDIO CONFIG (global defaults)
-- =============================================================================

INSERT INTO audio_config (
  channel_id, station_id,
  intro_url, background_url,
  background_url_is_random,
  intro_cue_percent, intro_duck_duration_ms, intro_speech_overlap_seconds,
  intro_min_before_speech, intro_ducked_volume, intro_fallback_cue_ms,
  intro_stop_fade_steps, intro_stop_fade_step_ms,
  background_volume, background_ducked_volume,
  background_fade_in_ms, background_fade_out_ms, background_fade_ms, background_fade_step_ms,
  track_fade_ms, track_fade_step_ms, pre_track_gap_ms,
  speech_gap_min_ms, speech_gap_max_ms,
  host_fade_in_duration_ms, host_delay_after_duck_ms,
  transition_gap_ms, crossfade_duration_ms,
  outro_fade_duration_ms, stop_fade_duration_ms,
  fade_step_ms, full_volume,
  broadcast_segment_ms, entertainment_delay_ms
)
VALUES (
  NULL, NULL,
  'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/radio-assets/LezzoTrafficappIntro.mp3',
  'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3',
  true,
  0.85, 2000, 2.5,
  2.0, 0.18, 3000,
  8, 40,
  0.12, 0.06,
  1500, 1500, 900, 40,
  700, 40, 500,
  300, 800,
  800, 400,
  800, 1000,
  2000, 1500,
  30, 1.0,
  270000, 8000
)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 13. SEED DATA — DRC ENGINE CONFIG
-- =============================================================================

INSERT INTO engine_config (
  channel_id, station_id,
  poll_interval_ms, alert_display_duration_ms, teaser_interval,
  entertainment_delay_all_played_ms, entertainment_delay_many_stories_ms,
  entertainment_delay_moderate_stories_ms, entertainment_delay_few_stories_ms,
  silence_threshold_ms, bfs_check_interval_ms, bridge_check_interval_ms,
  min_bridge_duration_ms, max_transition_length,
  recovery_order, fallback_message, default_timezone,
  station_id_interval_min_ms, station_id_interval_max_ms
)
VALUES (
  NULL, NULL,
  15000, 5000, 4,
  5000, 12000, 8000, 5000,
  3500, 2000, 30000,
  20000, 200,
  '["check_alerts", "check_breaking_news", "check_scheduled_bulletins", "check_pending_rss", "check_cached_scripts", "activate_bridge"]'::jsonb,
  'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.',
  'Africa/Kinshasa',
  1200000, 1800000
)
ON CONFLICT DO NOTHING;

-- Kinshasa-specific
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'kinshasa-main', s.id,
  'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.',
  'Africa/Kinshasa'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Goma-specific
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'goma-main', s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Lubumbashi-specific
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'lubumbashi-main', s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;


-- =============================================================================
-- 14. SEED DATA — ENTERTAINMENT TRACKS (placeholders — replace URLs)
-- =============================================================================

INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT 'Kumbaya', 'Local Artist', 'chill',
  'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/radio-assets/kumbaya.mp3',
  180000,
  '["That was Kumbaya by Local Artist.", "Beautiful rendition of Kumbaya.", "Kumbaya, what a classic."] '::jsonb,
  '["Here''s something to brighten your day.", "Time for a musical break."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'kinshasa-main', s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;

INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT 'Familia', 'Local Artist', 'upbeat',
  'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/radio-assets/familia.mp3',
  200000,
  '["That was Familia by Local Artist.", "Familia — bringing people together."] '::jsonb,
  '["Let''s keep the energy going.", "Here''s another great track."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'goma-main', s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;

INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT 'Kumbaya Encore', 'Local Artist', 'chill',
  'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/radio-assets/kumbaya-encore.mp3',
  195000,
  '["Kumbaya Encore — what a way to end the break."] '::jsonb,
  '["One more for the road.", "Here''s a final treat."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'lubumbashi-main', s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 15. SEED DATA — PROVIDER TAXONOMY (LezoTraffic)
-- =============================================================================

INSERT INTO provider_taxonomy (taxonomy_type, provider, source_key, target_value)
VALUES
  ('incident_type', 'lezotraffic', 'accident_grave', '{"category":"traffic","subcategory":"accident","priority":2}'::jsonb),
  ('incident_type', 'lezotraffic', 'accident', '{"category":"traffic","subcategory":"accident","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'embouteillage', '{"category":"traffic","subcategory":"congestion","priority":5}'::jsonb),
  ('incident_type', 'lezotraffic', 'travaux_routiers', '{"category":"traffic","subcategory":"roadwork","priority":6}'::jsonb),
  ('incident_type', 'lezotraffic', 'inondation', '{"category":"weather","subcategory":"flood","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'route_bloquee', '{"category":"traffic","subcategory":"closure","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'manifestation', '{"category":"traffic","subcategory":"protest","priority":4}'::jsonb),
  ('incident_type', 'lezotraffic', 'panne_electricite', '{"category":"emergency","subcategory":"power_outage","priority":4}'::jsonb),
  ('incident_type', 'lezotraffic', 'incendie', '{"category":"emergency","subcategory":"fire","priority":2}'::jsonb),
  ('incident_type', 'lezotraffic', 'inondation_route', '{"category":"traffic","subcategory":"flood","priority":3}'::jsonb),
  ('severity_map', 'lezotraffic', 'high', '{"priority":2}'::jsonb),
  ('severity_map', 'lezotraffic', 'medium', '{"priority":5}'::jsonb),
  ('severity_map', 'lezotraffic', 'low', '{"priority":8}'::jsonb),
  ('region_country_map', 'lezotraffic', 'kinshasa', '{"country_code":"CD","province":"Kinshasa"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'goma', '{"country_code":"CD","province":"Nord-Kivu"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'lubumbashi', '{"country_code":"CD","province":"Haut-Katanga"}'::jsonb),
  ('city_keywords', 'lezotraffic', 'kinshasa', '{"city":"Kinshasa","keywords":["kinshasa","n''dolo","ngaliema","lemba","matete"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'goma', '{"city":"Goma","keywords":["goma","sake","minova"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'lubumbashi', '{"city":"Lubumbashi","keywords":["lubumbashi","kampemba","kasanja"]}'::jsonb)
ON CONFLICT (taxonomy_type, provider, source_key) DO NOTHING;


-- =============================================================================
-- 16. SEED DATA — NORMALIZER CONFIG
-- =============================================================================

INSERT INTO normalizer_config (provider, config_key, config_value, description)
VALUES
  ('lezotraffic', 'summary_max_length', '500', 'Max characters for summary field'),
  ('lezotraffic', 'description_max_length', '2000', 'Max characters for description field'),
  ('lezotraffic', 'default_country', '"CD"', 'Default country code'),
  ('lezotraffic', 'api_version', '"v1"', 'API version tag'),
  ('lezotraffic', 'raw_payload_version', '1', 'Raw payload schema version'),
  ('lezotraffic', 'default_page_limit', '50', 'Default page size'),
  ('lezotraffic', 'geo_page_limit', '100', 'Page size for geographic endpoints'),
  ('lezotraffic', 'stats_days', '14', 'Statistics time range'),
  ('lezotraffic', 'timeout_ms', '10000', 'API request timeout'),
  ('lezotraffic', 'max_retries', '3', 'Max retries'),
  ('lezotraffic', 'retry_delay_ms', '1000', 'Base retry delay'),
  ('lezotraffic', 'endpoint_unavailable_retry_ms', '86400000', 'Retry window for 404'),
  ('lezotraffic', 'rate_limit_default_retry_s', '60', 'Default rate-limit retry-after'),
  ('lezotraffic', 'refresh_buffer_ms', '300000', 'Token refresh buffer'),
  ('lezotraffic', 'default_token_expiry_s', '900', 'Fallback token expiry'),
  ('lezotraffic', 'refresh_token_expiry_s', '3600', 'Refresh token expiry fallback'),
  ('lezotraffic', 'retryable_http_statuses', '[429,500,502,503,504]', 'HTTP statuses that trigger retry'),
  ('lezotraffic', 'non_retryable_http_statuses', '[400,403,404]', 'HTTP statuses that do not trigger retry'),
  ('lezotraffic', 'retention_incidents_hours', '72', 'Incident data retention'),
  ('lezotraffic', 'retention_accidents_hours', '72', 'Accident data retention'),
  ('lezotraffic', 'retention_routes_hours', '168', 'Route data retention (7 days)'),
  ('lezotraffic', 'retention_transports_hours', '168', 'Transport data retention (7 days)'),
  ('rss', 'default_language', '"fr"', 'Default RSS language'),
  ('rss', 'min_title_length', '5', 'Minimum title length'),
  ('rss', 'english_detection_threshold', '0.15', 'English content detection threshold'),
  ('rss', 'english_min_word_count', '5', 'Word count before English check'),
  ('rss', 'summary_max_length', '500', 'RSS summary truncation'),
  ('rss', 'description_max_length', '2000', 'RSS description truncation'),
  ('rss', 'default_title', '"Untitled"', 'Fallback title'),
  ('global', 'title_max_length', '500', 'Max title length validation'),
  ('global', 'priority_min', '1', 'Min priority value'),
  ('global', 'priority_max', '10', 'Max priority value'),
  ('global', 'hash_length', '64', 'Expected SHA-256 hex length'),
  ('global', 'valid_categories', '["traffic","emergency","news","weather","security","event","agriculture","sports","tourism","transport","government","health","geo"]', 'Valid event categories'),
  ('global', 'valid_statuses', '["active","resolved","archived"]', 'Valid event statuses'),
  ('global', 'known_providers', '["lezotraffic","rss"]', 'Registered provider IDs'),
  ('global', 'priority_level_thresholds', '{"critical":2,"high":4,"medium":6}', 'Priority-to-level mapping'),
  ('global', 'template_summary_max_length', '200', 'Max summary in filled template')
ON CONFLICT (provider, config_key) DO NOTHING;


-- =============================================================================
-- 17. SEED DATA — PROMPT TEMPLATES
-- =============================================================================

INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT
  s.id, 'news', 'fr',
  'Tu es un présentateur de radio professionnel pour {{station_name}} à {{city}}, {{country}}. Rédige un bulletin d''actualités concis et engageant basé sur les informations suivantes : {{content}} Style : {{style}} Durée souhaitée : {{duration_seconds}} secondes. Inclus une introduction et une conclusion appropriées.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country_code = 'CD'
ON CONFLICT DO NOTHING;

INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT
  s.id, 'news', 'sw',
  'Ni mwakilishi wa taarifa za redio kwa {{station_name}} katika {{city}}, {{country}}. Andika taarifa fupi na ya kupendeza kulingana na taarifa zifuatazo : {{content}} Mtindo : {{style}} Muda unaopendekezwa : {{duration_seconds}} sekunde. Jumuisha utangulizi na hitimisho lijalo.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country_code = 'CD'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- DONE!
-- =============================================================================
-- Verify:
--   SELECT channel_id, name, language FROM station_channels WHERE is_active = true;
--   SELECT template_type, language, count(*) FROM content_templates GROUP BY template_type, language;
--   SELECT channel_id, intro_url IS NOT NULL as has_intro FROM audio_config;
--   SELECT provider, count(*) FROM events GROUP BY provider;
-- =============================================================================
