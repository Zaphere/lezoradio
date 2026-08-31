-- =============================================================================
-- Migration 001: Core Tables
-- Radio Lezo database schema — adapted for standard PostgreSQL
-- =============================================================================

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  country    TEXT NOT NULL,
  region     TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  voice      TEXT,
  is_active  BOOLEAN DEFAULT true,
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
  style TEXT CHECK (style IN ('formal', 'casual', 'dramatic', 'bulletin', 'alert', 'station_id')) DEFAULT 'formal',
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
