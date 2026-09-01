-- ============================================================================
-- Migration 001: Initial schema — all Radio Lezo tables
-- ============================================================================
-- Run: node backend/migrate.js
-- This migration is idempotent (safe to run multiple times).

-- ── Schema version tracking ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 1: Content / News & Media
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_items (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  description   TEXT,
  content       TEXT,
  url           TEXT,
  region        TEXT,
  category      TEXT DEFAULT 'regional',
  feed_name     TEXT,
  published_at  TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radio_scripts (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  news_item_id  TEXT,
  script        TEXT,
  language      TEXT DEFAULT 'fr',
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_sources (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  type          TEXT,
  url           TEXT,
  is_active     BOOLEAN DEFAULT true,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_templates (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_type   TEXT NOT NULL,
  language        TEXT NOT NULL,
  text_content    TEXT NOT NULL,
  channel_id      TEXT,
  is_active       BOOLEAN DEFAULT true,
  usage_count     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feeds (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  url           TEXT,
  is_active     BOOLEAN DEFAULT true,
  category      TEXT,
  language      TEXT,
  last_fetched  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title         TEXT,
  artist        TEXT,
  audio_url     TEXT,
  duration_ms   INTEGER,
  is_available  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entertainment_tracks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title         TEXT,
  artist        TEXT,
  audio_url     TEXT,
  duration_ms   INTEGER,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 2: Radio Engine / Station Infrastructure
-- ============================================================================

CREATE TABLE IF NOT EXISTS stations (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  country_code  TEXT,
  frequency     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS station_channels (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id        TEXT REFERENCES stations(id),
  channel_id        TEXT UNIQUE NOT NULL,
  name              TEXT,
  description       TEXT,
  frequency         NUMERIC,
  emoji             TEXT,
  language          TEXT DEFAULT 'fr',
  primary_voice_id  TEXT,
  is_active         BOOLEAN DEFAULT true,
  priority          INTEGER DEFAULT 1,
  region            TEXT,
  genre_weights     JSONB DEFAULT '{"news":0.4,"traffic":0.2,"entertainment":0.2,"music":0.2}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS station_voices (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id    TEXT REFERENCES stations(id),
  voice_id      TEXT NOT NULL,
  language      TEXT NOT NULL,
  gender        TEXT,
  style         TEXT,
  is_primary    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, language, voice_id)
);

CREATE TABLE IF NOT EXISTS station_sources (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id    TEXT REFERENCES stations(id),
  source_id     TEXT,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radio_station_state (
  channel_id              TEXT PRIMARY KEY,
  station_id              TEXT,
  segment_type            TEXT DEFAULT 'silence',
  segment_id              TEXT,
  audio_url               TEXT,
  audio_type              TEXT,
  title                   TEXT,
  artist                  TEXT,
  album                   TEXT,
  duration_seconds        INTEGER DEFAULT 0,
  started_at              TIMESTAMPTZ DEFAULT now(),
  transition_type         TEXT,
  transition_duration_ms  INTEGER DEFAULT 1000,
  duck_volume             NUMERIC,
  next_segment_type       TEXT,
  next_audio_url          TEXT,
  next_title              TEXT,
  next_artist             TEXT,
  next_duration_seconds   INTEGER,
  language                TEXT DEFAULT 'fr',
  voice_id                TEXT,
  version                 INTEGER DEFAULT 1,
  generated_at            TIMESTAMPTZ DEFAULT now(),
  provider                TEXT,
  city                    TEXT,
  province                TEXT,
  description             TEXT
);

CREATE TABLE IF NOT EXISTS broadcast_queue (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id    TEXT,
  segment_type  TEXT,
  audio_url     TEXT,
  title         TEXT,
  duration      INTEGER,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type          TEXT,
  message       TEXT,
  severity      TEXT DEFAULT 'info',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 3: Queue / Playback / Scheduling
-- ============================================================================

CREATE TABLE IF NOT EXISTS queue_played_items (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id    TEXT NOT NULL,
  item_type     TEXT NOT NULL,
  item_id       TEXT NOT NULL,
  station_id    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS playback_history (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id    TEXT,
  segment_type  TEXT,
  segment_id    TEXT,
  audio_url     TEXT,
  title         TEXT,
  artist        TEXT,
  duration_seconds INTEGER,
  started_at    TIMESTAMPTZ DEFAULT now(),
  provider      TEXT,
  city          TEXT,
  province      TEXT,
  station_id    TEXT
);

CREATE TABLE IF NOT EXISTS bulletin_schedule (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id    TEXT,
  label         TEXT,
  cron_expr     TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 4: Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider      TEXT,
  category      TEXT,
  subcategory   TEXT,
  title         TEXT,
  summary       TEXT,
  description   TEXT,
  city          TEXT,
  province      TEXT,
  country       TEXT,
  region        TEXT,
  priority      INTEGER DEFAULT 5,
  language      TEXT,
  status        TEXT DEFAULT 'active',
  occurred_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 5: TTS / Audio
-- ============================================================================

CREATE TABLE IF NOT EXISTS tts_audio_cache (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  text_hash         TEXT NOT NULL,
  text_content      TEXT,
  voice_id          TEXT,
  language          TEXT,
  region            TEXT DEFAULT 'global',
  audio_url         TEXT,
  audio_duration_ms INTEGER,
  audio_file_size   INTEGER,
  model_id          TEXT,
  character_count   INTEGER,
  cost_usd          NUMERIC DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(region, text_hash, voice_id, language)
);

CREATE TABLE IF NOT EXISTS audio_config (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key           TEXT UNIQUE NOT NULL,
  value         JSONB,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 6: Translation / Language
-- ============================================================================

CREATE TABLE IF NOT EXISTS translation_cache (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_text     TEXT,
  source_lang     TEXT,
  target_lang     TEXT,
  translated_text TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_text, source_lang, target_lang)
);

-- ============================================================================
-- CATEGORY 7: Provider Framework
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_configs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider      TEXT UNIQUE NOT NULL,
  enabled       BOOLEAN DEFAULT true,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider      TEXT,
  status        TEXT,
  items_synced  INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS provider_taxonomy (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider      TEXT,
  category      TEXT,
  mapping       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS normalizer_config (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider      TEXT UNIQUE NOT NULL,
  rules         JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORY 8: Ingestion / Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingestion_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  feed_name     TEXT,
  status        TEXT,
  items_count   INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ── Indexes for performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_region ON news_items(region);
CREATE INDEX IF NOT EXISTS idx_news_items_ingested ON news_items(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id, item_type);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_tts_audio_cache_hash ON tts_audio_cache(text_hash, voice_id, language, region);
CREATE INDEX IF NOT EXISTS idx_playback_history_channel ON playback_history(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_provider_status ON events(provider, status);
CREATE INDEX IF NOT EXISTS idx_station_channels_channel_id ON station_channels(channel_id);
