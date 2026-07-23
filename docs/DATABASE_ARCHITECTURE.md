# LezoRadio Database Architecture

> **Status:** FROZEN — v1.0 (2026-07-14)
> This document is the project's source of truth for database design. Do not modify during implementation. Changes require a new architecture review cycle.

Complete database design for the Radio Engine. Every backend module reads from the database — zero hardcoded configuration. Event-driven architecture replaces polling loops.

**Companion document:** [ARCHITECTURE.md](./ARCHITECTURE.md) — system architecture, event flow, and migration plan.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Existing Tables — Reused](#existing-tables--reused)
3. [Existing Tables — Deprecated](#existing-tables--deprecated)
4. [New Tables](#new-tables)
5. [Complete Entity Relationship Diagram](#complete-entity-relationship-diagram)
6. [RLS Policies](#rls-policies)
7. [Event-Driven Architecture](#event-driven-architecture)
8. [Migration Plan](#migration-plan)

---

## Design Principles

1. **Zero Hardcoded Config**: Every timing value, template, region, channel, and schedule lives in the database
2. **Event-Driven**: Provider events trigger engine reactions via Supabase Realtime + PostgreSQL triggers — no polling loops
3. **Single Source of Truth**: The `events` table is the unified content store; legacy `news_items`/`radio_scripts` are deprecated
4. **Per-Channel Isolation**: Each broadcast channel (Kinshasa, Goma, Lubumbashi) has independent state, queue, and history
5. **Archive Before Delete**: Legacy code is archived, not deleted, until new engine reaches feature parity

---

## Existing Tables — Reused

These tables already exist in migrations and are used as-is or extended by the new engine.

### `stations`

**Migration:** `20260629_create_stations_sources.sql` + `20260629_phase1_station_extend.sql` + `20260701_add_timezone_and_bulletin.sql` + `20260713_v2_station_config.sql`

**Used by:** StationController, LanguageController, QueueManager

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Station identifier |
| `name` | TEXT NOT NULL | Station name (e.g., "DR Congo") |
| `country` | TEXT NOT NULL | Country name |
| `country_code` | TEXT | ISO 3166-1 alpha-2 |
| `region` | TEXT NOT NULL | Geographic region |
| `language` | TEXT NOT NULL DEFAULT 'en' | Primary language |
| `voice` | TEXT | Legacy voice ID |
| `timezone` | TEXT | IANA timezone (e.g., "Africa/Kinshasa") |
| `priority` | INT DEFAULT 1 | Station priority |
| `is_active` | BOOLEAN DEFAULT true | Whether station is live |
| `image_url` | TEXT | Station logo |
| `v2_config` | JSONB DEFAULT '{}' | V2 engine config (deprecated, replaced by new tables) |
| `v2_status` | TEXT DEFAULT 'inactive' | V2 migration status |
| `v2_last_migration` | TIMESTAMPTZ | Last v2 migration timestamp |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `station_voices`

**Migration:** `20260713_v2_station_config.sql`

**Used by:** LanguageController — resolves voice ID per station/language

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations(id) CASCADE | |
| `voice_id` | TEXT NOT NULL | ElevenLabs voice ID |
| `language` | TEXT NOT NULL | Language code |
| `gender` | TEXT CHECK ('male','female','neutral') DEFAULT 'neutral' | |
| `style` | TEXT CHECK ('formal','casual','dramatic') DEFAULT 'formal' | |
| `is_primary` | BOOLEAN DEFAULT false | Primary voice for this language |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique:** `(station_id, language, voice_id)`

### `station_schedules`

**Migration:** `20260713_v2_station_config.sql`

**Used by:** EventScheduler — determines what plays when

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations(id) CASCADE | |
| `event_type` | TEXT NOT NULL CHECK ('news','music','entertainment','weather','traffic','emergency') | |
| `start_time` | TIME NOT NULL | |
| `end_time` | TIME | NULL = no end |
| `recurrence` | TEXT CHECK ('daily','weekly','custom') DEFAULT 'daily' | |
| `recurrence_pattern` | TEXT | Custom cron expression |
| `priority` | INT NOT NULL DEFAULT 5 | |
| `language` | TEXT NOT NULL DEFAULT 'fr' | |
| `content_config` | JSONB DEFAULT '{}' | Event-type-specific config |
| `enabled` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `station_analytics`

**Migration:** `20260713_v2_station_config.sql`

**Used by:** StationController — tracks station metrics

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations(id) CASCADE | |
| `metric_name` | TEXT NOT NULL | e.g., "tracks_played", "bulletins_generated" |
| `metric_value` | NUMERIC NOT NULL | |
| `dimensions` | JSONB DEFAULT '{}' | Additional context |
| `recorded_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

### `bulletin_schedule`

**Migration:** `20260701_add_timezone_and_bulletin.sql`

**Used by:** EventScheduler — bulletin timing

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | Display name |
| `type` | TEXT NOT NULL DEFAULT 'french_global' | Bulletin type |
| `language` | TEXT NOT NULL DEFAULT 'fr' | |
| `hour` | INT NOT NULL | Hour in station timezone |
| `minute` | INT NOT NULL DEFAULT 0 | |
| `duration_s` | INT NOT NULL DEFAULT 300 | Duration in seconds |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `events`

**Migration:** `20260705_unified_events.sql` + `20260706_provider_framework_upgrade.sql`

**Used by:** QueueManager (content source), Provider Framework (write target)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `provider` | TEXT NOT NULL | 'rss', 'lezotraffic', etc. |
| `provider_record_id` | TEXT NOT NULL | Provider's unique ID |
| `provider_type` | TEXT | Specific type from provider |
| `category` | TEXT NOT NULL | 'news', 'traffic', 'weather', 'emergency' |
| `subcategory` | TEXT | 'accident', 'politics', etc. |
| `priority` | INT NOT NULL DEFAULT 5 | 1-10, lower = higher |
| `title` | TEXT NOT NULL | |
| `summary` | TEXT | |
| `description` | TEXT | |
| `country` | TEXT DEFAULT 'CD' | |
| `province` | TEXT | |
| `city` | TEXT | |
| `latitude` | NUMERIC | |
| `longitude` | NUMERIC | |
| `status` | TEXT DEFAULT 'active' | 'active', 'resolved', 'archived' |
| `verified` | BOOLEAN DEFAULT false | |
| `language` | TEXT DEFAULT 'fr' | |
| `occurred_at` | TIMESTAMPTZ | When event actually happened |
| `expires_at` | TIMESTAMPTZ | When no longer relevant |
| `metadata` | JSONB | Provider-specific data |
| `raw_payload` | JSONB | Original API response |
| `raw_payload_version` | INT DEFAULT 1 | |
| `api_version` | TEXT | |
| `provider_hash` | TEXT | SHA-256 dedup hash |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique:** `(provider, provider_record_id)`

### `provider_configs`

**Migration:** `20260705_unified_events.sql`

**Used by:** Provider Framework — provider configuration

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `provider` | TEXT NOT NULL UNIQUE | Provider identifier |
| `enabled` | BOOLEAN DEFAULT true | |
| `config` | JSONB | Provider-specific config |
| `priority` | INT DEFAULT 5 | |
| `sync_schedule` | TEXT | Cron expression |
| `capabilities` | JSONB | Provider capabilities |
| `last_sync_at` | TIMESTAMPTZ | |
| `last_sync_status` | TEXT | |
| `last_error` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `music_tracks`

**Migration:** `20260713_v2_music_catalog.sql`

**Used by:** QueueManager (entertainment content), AudioManager (track metadata)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `artist` | TEXT NOT NULL | |
| `album` | TEXT | |
| `genre` | TEXT NOT NULL | |
| `language` | TEXT DEFAULT 'fr' | |
| `duration_ms` | INT NOT NULL | |
| `bpm` | INT | |
| `mood` | TEXT | |
| `tags` | JSONB DEFAULT '[]' | |
| `audio_url` | TEXT NOT NULL | Storage URL |
| `cover_url` | TEXT | |
| `is_explicit` | BOOLEAN DEFAULT false | |
| `is_available` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `music_playlists`

**Migration:** `20260713_v2_music_catalog.sql`

**Used by:** QueueManager — playlist management

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | |
| `station_id` | UUID FK → stations(id) SET NULL | NULL = global playlist |
| `description` | TEXT | |
| `is_public` | BOOLEAN DEFAULT true | |
| `shuffle` | BOOLEAN DEFAULT false | |
| `loop` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `playlist_tracks`

**Migration:** `20260713_v2_music_catalog.sql`

**Used by:** QueueManager — ordered track lists

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `playlist_id` | UUID FK → music_playlists(id) CASCADE | |
| `track_id` | UUID FK → music_tracks(id) CASCADE | |
| `position` | INT NOT NULL | |
| `added_at` | TIMESTAMPTZ | |

**Unique:** `(playlist_id, track_id)`

### `music_play_history`

**Migration:** `20260713_v2_music_catalog.sql`

**Used by:** QueueManager — entertainment rotation tracking

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations(id) CASCADE | |
| `track_id` | UUID FK → music_tracks(id) CASCADE | |
| `played_at` | TIMESTAMPTZ | |
| `duration_played_ms` | INT | |
| `completed` | BOOLEAN DEFAULT false | |

### `translation_cache`

**Migration:** `20260713_v2_translations_cache.sql`

**Used by:** LanguageController — translation caching

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `text_hash` | TEXT NOT NULL | SHA-256 of input text |
| `source_language` | TEXT NOT NULL | |
| `target_language` | TEXT NOT NULL | |
| `translated_text` | TEXT NOT NULL | |
| `confidence` | NUMERIC DEFAULT 0.9 | |
| `provider` | TEXT DEFAULT 'google' | |
| `content_type` | TEXT DEFAULT 'script' | |
| `hit_count` | INT DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days') | |

**Unique:** `(text_hash, source_language, target_language)`

### `language_detection_cache`

**Migration:** `20260713_v2_translations_cache.sql`

**Used by:** LanguageController — language detection caching

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `content_hash` | TEXT NOT NULL | |
| `detected_language` | TEXT NOT NULL | |
| `confidence` | NUMERIC NOT NULL | |
| `alternatives` | JSONB DEFAULT '[]' | |
| `created_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days') | |

**Unique:** `(content_hash)`

### `prompt_templates`

**Migration:** `20260713_v2_prompt_templates.sql`

**Used by:** AI script generation, ContentNormalizer

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations(id) CASCADE | |
| `prompt_type` | TEXT NOT NULL CHECK ('news','traffic','weather','entertainment','sports','bulletin') | |
| `language` | TEXT NOT NULL | |
| `template` | TEXT NOT NULL | Mustache/handlebars template |
| `variables` | JSONB DEFAULT '[]' | |
| `version` | INT DEFAULT 1 | |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_by` | TEXT DEFAULT 'system' | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `feature_flags`

**Migration:** `20260713_v2_feature_flags.sql`

**Used by:** Engine feature gating

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Flag identifier |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `enabled` | BOOLEAN DEFAULT false | |
| `rollout_percentage` | INT DEFAULT 0 CHECK (0..100) | |
| `allowed_environments` | JSONB | |
| `allowed_stations` | JSONB | |
| `allowed_languages` | JSONB | |
| `metadata` | JSONB DEFAULT '{}' | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

## Existing Tables — Deprecated

These legacy tables are kept for read-only access during migration. New writes go to the new tables. After feature parity, these are archived.

### `news_items` (Deprecated → `events`)

**Reason:** Replaced by unified `events` table. New ingestion writes to `events`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `feed_id` | UUID FK → feeds(id) | |
| `title` | TEXT | |
| `description` | TEXT | |
| `content` | TEXT | |
| `url` | TEXT UNIQUE | |
| `region` | TEXT | |
| `category` | TEXT | |
| `published_at` | TIMESTAMPTZ | |
| `ingested_at` | TIMESTAMPTZ | |
| `is_processed` | BOOLEAN DEFAULT false | |
| `language` | TEXT DEFAULT 'fr' CHECK ('fr','sw','ln','en') | |
| `is_translated` | BOOLEAN DEFAULT false | |
| `source_language` | TEXT | |
| `translation_required` | BOOLEAN DEFAULT false | |
| `url_hash` | TEXT GENERATED ALWAYS AS md5(url) STORED | |

### `feeds` (Deprecated → `provider_configs`)

**Reason:** Replaced by `provider_configs` + `content_sources`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `url` | TEXT | |
| `region` | TEXT | |
| `category` | TEXT | |
| `type` | TEXT CHECK ('rss','atom','json','xml') | |
| `is_active` | BOOLEAN | |
| `last_fetched_at` | TIMESTAMPTZ | |
| `language` | TEXT DEFAULT 'en' | |

### `radio_scripts` (Deprecated → `events` + `prompt_templates`)

**Reason:** AI-generated scripts are now `events` with `metadata.script`; templates are in `prompt_templates`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `news_item_id` | UUID FK → news_items(id) | |
| `script` | TEXT | |
| `script_text` | TEXT | |
| `type` | TEXT | |
| `region` | TEXT | |
| `category` | TEXT | |
| `is_read` | BOOLEAN DEFAULT false | |
| `created_at` | TIMESTAMPTZ | |

### `broadcast_queue` (Deprecated → `queue_played_items`)

**Reason:** Replaced by `queue_played_items` with proper per-channel tracking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `script_id` | UUID FK → radio_scripts(id) | |
| `region` | TEXT | |
| `category` | TEXT | |
| `priority` | INT | |
| `is_played` | BOOLEAN | |
| `is_interrupted` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### `alerts` (Deprecated → `events` with category='emergency')

**Reason:** Emergency alerts are now `events` records with `category='emergency'` and high priority.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | TEXT | |
| `message` | TEXT | |
| `severity` | TEXT CHECK ('low','medium','high','critical') | |
| `region` | TEXT | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

---

## New Tables

### 1. `radio_station_state` — Now Playing State

The core synchronization table. The engine writes the current `NowPlaying` state; the frontend reads it via Supabase Realtime subscription.

**Module:** PlaybackController (write), useNowPlaying hook (read)

```sql
CREATE TABLE IF NOT EXISTS radio_station_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,           -- e.g., 'kinshasa-main', 'goma-news'
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

  -- Current segment
  segment_type TEXT NOT NULL CHECK (segment_type IN (
    'intro', 'track', 'tts', 'jingle', 'bulletin',
    'announcement', 'ambient', 'silence', 'transition'
  )),
  segment_id TEXT,                    -- Reference to content item

  -- Audio source
  audio_url TEXT,                     -- CDN/Storage URL
  audio_type TEXT CHECK (audio_type IN ('stream', 'tts', 'jingle', 'ambient')),

  -- Track metadata (when segment_type = 'track')
  title TEXT,
  artist TEXT,
  album TEXT,
  duration_seconds INT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,    -- Server timestamp
  duration_seconds INT NOT NULL,      -- Segment duration

  -- Transition hint
  transition_type TEXT CHECK (transition_type IN ('crossfade', 'duck', 'cut', 'next')),
  transition_duration_ms INT DEFAULT 1000,
  duck_volume NUMERIC(3,2),           -- 0.00-1.00

  -- Next item preview
  next_segment_type TEXT,
  next_audio_url TEXT,
  next_title TEXT,
  next_artist TEXT,
  next_duration_seconds INT,

  -- Station context
  language TEXT NOT NULL,
  voice_id TEXT,

  -- Metadata
  version INT NOT NULL DEFAULT 1,     -- Incremented on every state change
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_station ON radio_station_state(station_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_version ON radio_station_state(channel_id, version DESC);

-- RLS: Frontend can read, backend (service role) can write
ALTER TABLE radio_station_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can read station state"
  ON radio_station_state FOR SELECT
  USING (true);

CREATE POLICY "Backend can update station state"
  ON radio_station_state FOR ALL
  USING (auth.role() = 'service_role');
```

**Row example:**
```json
{
  "channel_id": "kinshasa-main",
  "station_id": "uuid-of-dr-congo",
  "segment_type": "track",
  "segment_id": "uuid-of-music-track",
  "audio_url": "https://storage.supabase.co/.../song.mp3",
  "audio_type": "stream",
  "title": "Kumbaya",
  "artist": "Local Artist",
  "duration_seconds": 245,
  "started_at": "2026-07-14T10:30:00Z",
  "duration_seconds": 245,
  "transition_type": "crossfade",
  "transition_duration_ms": 1000,
  "next_segment_type": "tts",
  "next_audio_url": "https://storage.supabase.co/.../tts.mp3",
  "next_title": "Breaking: Road closure on Route Nationale 1",
  "language": "ln",
  "voice_id": "elevenlabs-voice-id",
  "version": 47,
  "generated_at": "2026-07-14T10:30:00Z"
}
```

### 2. `queue_played_items` — Broadcast Queue / Played Tracking

Tracks what has been played per channel to prevent repeats and manage rotation. Replaces the legacy `broadcast_queue` table.

**Module:** QueueManager

```sql
CREATE TABLE IF NOT EXISTS queue_played_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Indexes: fast lookup for "what hasn't been played recently"
CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_station ON queue_played_items(station_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_item ON queue_played_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_at ON queue_played_items(channel_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_played_expires ON queue_played_items(channel_id, expires_at);

-- Composite index for "find unplayed items" query
CREATE INDEX IF NOT EXISTS idx_queue_played_lookup ON queue_played_items(channel_id, item_type, item_id, played_at DESC);

-- RLS: Backend only
ALTER TABLE queue_played_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON queue_played_items FOR ALL
  USING (auth.role() = 'service_role');
```

**Query pattern — "Get next unplayed track for Kinshasa":**
```sql
SELECT mt.*
FROM music_tracks mt
WHERE mt.is_available = true
  AND NOT EXISTS (
    SELECT 1 FROM queue_played_items qp
    WHERE qp.channel_id = 'kinshasa-main'
      AND qp.item_type = 'track'
      AND qp.item_id = mt.id::text
      AND qp.played_at > now() - INTERVAL '4 hours'
  )
ORDER BY RANDOM()
LIMIT 1;
```

### 3. `station_channels` — Channel Definitions

Defines broadcast channels per station. Each channel has its own language, genre weights, and voice config. This is the core table for adding new countries/languages without code changes.

**Module:** StationController, QueueManager

```sql
CREATE TABLE IF NOT EXISTS station_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,    -- e.g., 'kinshasa-main', 'goma-news'

  -- Display
  name TEXT NOT NULL,                 -- "Kinshasa Main"
  description TEXT,
  frequency NUMERIC(4,1),             -- FM frequency (88.1, 92.5, etc.)
  emoji TEXT,                         -- Channel icon

  -- Content mix
  language TEXT NOT NULL DEFAULT 'fr',
  genre_weights JSONB DEFAULT '{
    "news": 40,
    "traffic": 20,
    "music": 25,
    "entertainment": 15
  }',

  -- Voice configuration
  primary_voice_id TEXT,              -- ElevenLabs voice ID for this channel
  voice_config JSONB DEFAULT '{
    "gender": "female",
    "style": "formal",
    "stability": 0.5,
    "similarity_boost": 0.75
  }',

  -- Behavior
  broadcast_segment_ms INT DEFAULT 270000,  -- News segment duration
  entertainment_delay_ms INT DEFAULT 8000,  -- Delay before entertainment
  station_id_interval_min_ms INT DEFAULT 600000,   -- 10 min
  station_id_interval_max_ms INT DEFAULT 900000,   -- 15 min
  time_announcement_interval_min_ms INT DEFAULT 1200000, -- 20 min
  time_announcement_interval_max_ms INT DEFAULT 1800000, -- 30 min

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_station_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_station_channels_active ON station_channels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_station_channels_language ON station_channels(language);

-- RLS: Frontend can read active channels
ALTER TABLE station_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can read active channels"
  ON station_channels FOR SELECT
  USING (is_active = true);

CREATE POLICY "Backend can manage channels"
  ON station_channels FOR ALL
  USING (auth.role() = 'service_role');
```

**Seed data — DRC channels:**
```sql
INSERT INTO station_channels (station_id, channel_id, name, language, frequency, genre_weights, primary_voice_id, voice_config)
SELECT
  s.id,
  'kinshasa-main',
  'Kinshasa Main',
  'ln',  -- Lingala
  88.1,
  '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}',
  sv.voice_id,
  '{"gender": "female", "style": "formal"}'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'ln' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

INSERT INTO station_channels (station_id, channel_id, name, language, frequency, genre_weights, primary_voice_id, voice_config)
SELECT
  s.id,
  'goma-main',
  'Goma Main',
  'sw',  -- Swahili
  92.5,
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}',
  sv.voice_id,
  '{"gender": "male", "style": "formal"}'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

INSERT INTO station_channels (station_id, channel_id, name, language, frequency, genre_weights, primary_voice_id, voice_config)
SELECT
  s.id,
  'lubumbashi-main',
  'Lubumbashi Main',
  'sw',  -- Swahili
  95.3,
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}',
  sv.voice_id,
  '{"gender": "female", "style": "casual"}'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;
```

### 4. `tts_audio_cache` — TTS Audio Caching

Caches generated TTS audio to avoid regeneration. Stores the Supabase Storage URL for each unique text+voice combination.

**Module:** TTSGenerator

```sql
CREATE TABLE IF NOT EXISTS tts_audio_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Input fingerprint
  text_hash TEXT NOT NULL,            -- SHA-256(normalized_text + voice_id + language)
  text_content TEXT NOT NULL,         -- Original text for debugging
  voice_id TEXT NOT NULL,             -- ElevenLabs voice ID
  language TEXT NOT NULL,

  -- Output
  audio_url TEXT NOT NULL,            -- Supabase Storage URL
  audio_duration_ms INT,             -- Duration for scheduling
  audio_file_size INT,               -- File size in bytes

  -- Metadata
  provider TEXT DEFAULT 'elevenlabs',
  model_id TEXT,                     -- e.g., 'eleven_multilingual_v2'
  stability NUMERIC(3,2),
  similarity_boost NUMERIC(3,2),

  -- Usage tracking
  hit_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Expiry
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(text_hash, voice_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_audio_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice ON tts_audio_cache(voice_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_expires ON tts_audio_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tts_cache_lookup ON tts_audio_cache(text_hash, voice_id, language);

-- RLS: Backend only
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON tts_audio_cache FOR ALL
  USING (auth.role() = 'service_role');
```

**Query pattern — "Get cached TTS or generate":**
```sql
-- Check cache
SELECT audio_url, audio_duration_ms
FROM tts_audio_cache
WHERE text_hash = $1 AND voice_id = $2 AND language = $3
  AND expires_at > now()
LIMIT 1;

-- On cache miss: generate, then:
INSERT INTO tts_audio_cache (text_hash, text_content, voice_id, language, audio_url, audio_duration_ms, model_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (text_hash, voice_id, language) DO UPDATE SET
  hit_count = tts_audio_cache.hit_count + 1,
  last_used_at = now();
```

### 5. `content_templates` — All Text Templates

Replaces all hardcoded text arrays (transitions, teasers, station IDs, bridge intros, commentary, French bulletin scripts). Templates support `{station}`, `{time}`, `{date}` placeholders.

**Module:** ContentNormalizer, EventScheduler, PlaybackController

```sql
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Classification
  template_type TEXT NOT NULL CHECK (template_type IN (
    'transition',           -- Between-story transitions
    'coming_up_teaser',     -- Teaser before upcoming stories
    'station_id',           -- Station identification voiceover
    'bridge_intro',         -- Music bridge introduction
    'bridge_outro',         -- Music bridge conclusion
    'commentary',           -- Post-entertainment-track commentary
    'intro_before_track',   -- Pre-entertainment-track intro
    'entertainment_open',   -- Entertainment segment opening
    'entertainment_close',  -- Entertainment segment closing
    'french_bulletin_intro', -- French bulletin opening
    'french_bulletin_outro', -- French bulletin closing
    'time_announcement',    -- Time-of-day announcement
    'fallback_message',     -- When no content available
    'alert_banner',         -- Emergency alert banner
    'bfs_transition'        -- Broadcast flow supervisor transitions
  )),

  -- Scoping
  language TEXT NOT NULL DEFAULT 'fr',
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,  -- NULL = global
  channel_id TEXT,                                             -- NULL = all channels

  -- Content
  text_content TEXT NOT NULL,         -- Template text with {placeholders}
  category TEXT,                      -- For script templates: 'news', 'traffic', etc.
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_language ON content_templates(language);
CREATE INDEX IF NOT EXISTS idx_content_templates_station ON content_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_channel ON content_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(template_type, language, is_active) WHERE is_active = true;

-- RLS: Frontend can read, backend can manage
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can read templates"
  ON content_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Backend can manage templates"
  ON content_templates FOR ALL
  USING (auth.role() = 'service_role');
```

**Query pattern — "Get random transition for French Lingala channel":**
```sql
SELECT text_content
FROM content_templates
WHERE template_type = 'transition'
  AND language = 'ln'
  AND is_active = true
  AND (station_id IS NULL OR station_id = $1)
  AND (channel_id IS NULL OR channel_id = $2)
ORDER BY RANDOM()
LIMIT 1;
```

**Seed data — transitions (from current hardcoded arrays):**
```sql
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'fr', 'Next update coming your way in just a moment.', true),
  ('transition', 'fr', 'Stay with us, more news on the way.', true),
  ('transition', 'fr', 'We''ll be right back with more updates.', true),
  ('transition', 'fr', 'Don''t go anywhere, we have more stories for you.', true),
  ('transition', 'ln', 'Toki ekoya mo㎥ ndakisa.', true),
  ('transition', 'ln', 'Pasieti, toki ekoya na biloko ebengi.', true),
  ('transition', 'sw', 'Endelea kusikiliza, habari zaidi zinakuja.', true),
  ('transition', 'sw', 'Umbeya, habari za hivi karibuni zinafuata.', true);
```

### 6. `audio_config` — Audio Timing & Volume Settings

All audio timing, volume, and fade configuration. Replaces hardcoded values in `timing.ts`, `IntroAudio.ts`, `BackgroundAudio.ts`, `TrackAudio.ts`, `AudioManager.ts`.

**Module:** AudioManager, useAudioExecutor, PlaybackController

```sql
CREATE TABLE IF NOT EXISTS audio_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope
  channel_id TEXT,                    -- NULL = global default
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,  -- NULL = global

  -- Intro settings
  intro_url TEXT,                     -- Supabase Storage URL for intro jingle
  intro_cue_percent NUMERIC(4,2) DEFAULT 0.85,
  intro_duck_duration_ms INT DEFAULT 2000,
  intro_speech_overlap_seconds NUMERIC(3,1) DEFAULT 2.5,
  intro_min_before_speech NUMERIC(3,1) DEFAULT 2.0,
  intro_ducked_volume NUMERIC(3,2) DEFAULT 0.18,
  intro_fallback_cue_ms INT DEFAULT 3000,
  intro_stop_fade_steps INT DEFAULT 8,
  intro_stop_fade_step_ms INT DEFAULT 40,

  -- Background music settings
  background_url TEXT,                -- Supabase Storage URL for background music
  background_volume NUMERIC(3,2) DEFAULT 0.12,
  background_ducked_volume NUMERIC(3,2) DEFAULT 0.06,
  background_fade_in_ms INT DEFAULT 1500,
  background_fade_out_ms INT DEFAULT 1500,
  background_fade_ms INT DEFAULT 900,
  background_fade_step_ms INT DEFAULT 40,

  -- Track (entertainment) settings
  track_fade_ms INT DEFAULT 700,
  track_fade_step_ms INT DEFAULT 40,
  pre_track_gap_ms INT DEFAULT 500,
  speech_gap_min_ms INT DEFAULT 300,
  speech_gap_max_ms INT DEFAULT 800,

  -- Host/TTS settings
  host_fade_in_duration_ms INT DEFAULT 800,
  host_delay_after_duck_ms INT DEFAULT 400,

  -- Transition settings
  transition_gap_ms INT DEFAULT 800,
  crossfade_duration_ms INT DEFAULT 1000,
  outro_fade_duration_ms INT DEFAULT 2000,
  stop_fade_duration_ms INT DEFAULT 1500,

  -- Animation
  fade_step_ms INT DEFAULT 30,

  -- Volume levels
  full_volume NUMERIC(3,2) DEFAULT 1.0,

  -- Segment timing
  broadcast_segment_ms INT DEFAULT 270000,  -- 4.5 min
  entertainment_delay_ms INT DEFAULT 8000,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id, station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audio_config_channel ON audio_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_config_station ON audio_config(station_id);

-- RLS: Frontend can read, backend can manage
ALTER TABLE audio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can read audio config"
  ON audio_config FOR SELECT
  USING (is_active = true);

CREATE POLICY "Backend can manage audio config"
  ON audio_config FOR ALL
  USING (auth.role() = 'service_role');
```

**Seed data — global defaults:**
```sql
INSERT INTO audio_config (channel_id, station_id, intro_url, background_url)
VALUES (
  NULL,
  NULL,
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/LezzoTrafficappIntro.mp3',
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/backgroundmusic.mp3'
);
```

### 7. `engine_config` — Engine Behavior Settings

All engine scheduling, recovery, and behavior configuration. Replaces hardcoded values in `useRadioEngine.ts`, `broadcastFlowSupervisor.ts`, `frenchBulletin.ts`.

**Module:** PlaybackController, EventScheduler, radioEngine

```sql
CREATE TABLE IF NOT EXISTS engine_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope
  channel_id TEXT,                    -- NULL = global default
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,

  -- Scheduling
  poll_interval_ms INT DEFAULT 15000,  -- Legacy polling (kept for backward compat)
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

  -- Recovery order
  recovery_order JSONB DEFAULT '["check_alerts", "check_breaking_news", "check_scheduled_bulletins", "check_pending_rss", "check_cached_scripts", "activate_bridge"]',

  -- Fallback
  fallback_message TEXT DEFAULT 'No recent news feeds detected. Please stand by for the next update.',

  -- Timezone
  default_timezone TEXT DEFAULT 'UTC',

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(channel_id, station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engine_config_channel ON engine_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_station ON engine_config(station_id);

-- RLS: Backend only
ALTER TABLE engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON engine_config FOR ALL
  USING (auth.role() = 'service_role');
```

### 8. `provider_taxonomy` — Classification Mappings

Stores category/subcategory mappings, severity maps, and geographic mappings for all providers. Replaces hardcoded taxonomies in `lezotraffic/taxonomy.js`, `rss/rssNormalizer.js`, `validator.js`.

**Module:** ContentNormalizer, Provider Framework

```sql
CREATE TABLE IF NOT EXISTS provider_taxonomy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Classification
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN (
    'incident_type',        -- Provider-specific type → unified category/subcategory
    'severity_map',         -- Severity string → priority number
    'category_map',         -- Provider category → unified category
    'subcategory_map',      -- Provider category → unified subcategory
    'region_country_map',   -- Region string → country code
    'city_keywords',        -- Text keywords → city name
    'priority_rules',       -- Conditions → priority number
    'rss_category_map',     -- RSS category → unified category
    'rss_subcategory_map'   -- RSS category → unified subcategory
  )),

  provider TEXT NOT NULL,             -- 'lezotraffic', 'rss', 'global'
  language TEXT DEFAULT 'fr',

  -- Mapping data
  source_key TEXT NOT NULL,           -- Input key (e.g., 'accident_grave', 'high')
  target_value JSONB NOT NULL,        -- Output value (e.g., {"category":"traffic","subcategory":"accident"})

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(taxonomy_type, provider, source_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON provider_taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_provider ON provider_taxonomy(provider);
CREATE INDEX IF NOT EXISTS idx_taxonomy_lookup ON provider_taxonomy(taxonomy_type, provider, source_key);

-- RLS: Backend only
ALTER TABLE provider_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON provider_taxonomy FOR ALL
  USING (auth.role() = 'service_role');
```

**Seed data — LezoTraffic incident types:**
```sql
INSERT INTO provider_taxonomy (taxonomy_type, provider, source_key, target_value)
VALUES
  ('incident_type', 'lezotraffic', 'accident_grave', '{"category":"traffic","subcategory":"accident","priority":2}'),
  ('incident_type', 'lezotraffic', 'accident', '{"category":"traffic","subcategory":"accident","priority":3}'),
  ('incident_type', 'lezotraffic', 'embouteillage', '{"category":"traffic","subcategory":"congestion","priority":5}'),
  ('incident_type', 'lezotraffic', 'travaux_routiers', '{"category":"traffic","subcategory":"roadwork","priority":6}'),
  ('incident_type', 'lezotraffic', 'inondation', '{"category":"weather","subcategory":"flood","priority":3}'),
  ('severity_map', 'lezotraffic', 'high', '{"priority":2}'),
  ('severity_map', 'lezotraffic', 'medium', '{"priority":5}'),
  ('severity_map', 'lezotraffic', 'low', '{"priority":8}');
```

### 9. `normalizer_config` — Content Normalizer Settings

Max lengths, default values, detection thresholds, and validation rules. Replaces hardcoded values in normalizers and validators.

**Module:** ContentNormalizer, Provider Framework

```sql
CREATE TABLE IF NOT EXISTS normalizer_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope
  provider TEXT NOT NULL,             -- 'lezotraffic', 'rss', 'global'
  config_key TEXT NOT NULL,           -- e.g., 'summary_max_length', 'default_country'
  config_value JSONB NOT NULL,        -- The value (number, string, array, object)

  description TEXT,                   -- Human-readable description
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(provider, config_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_normalizer_config_provider ON normalizer_config(provider);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_lookup ON normalizer_config(provider, config_key);

-- RLS: Backend only
ALTER TABLE normalizer_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON normalizer_config FOR ALL
  USING (auth.role() = 'service_role');
```

**Seed data:**
```sql
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
  ('lezotraffic', 'retention_routes_hours', '168', 'Route data retention'),
  ('lezotraffic', 'retention_transports_hours', '168', 'Transport data retention'),
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
  ('global', 'template_summary_max_length', '200', 'Max summary in filled template');
```

### 10. `playback_history` — Detailed Playback Log

Comprehensive log of every segment played. Used for analytics, debugging, and compliance. Extends `music_play_history` with full context.

**Module:** PlaybackController, StationController

```sql
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

-- RLS: Backend only
ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend service role full access"
  ON playback_history FOR ALL
  USING (auth.role() = 'service_role');
```

### 11. `entertainment_tracks` — Entertainment Segment Config

Configuration for entertainment segments. Extends `music_tracks` with broadcast-specific settings.

**Module:** QueueManager, PlaybackController

```sql
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

-- RLS: Frontend can read active, backend can manage
ALTER TABLE entertainment_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can read active entertainment"
  ON entertainment_tracks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Backend can manage entertainment"
  ON entertainment_tracks FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Complete Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE STATION TABLES                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  stations (18 cols)                                                 │
│    ├──< station_channels (20 cols)         ← NEW: Channel defs     │
│    ├──< station_voices (8 cols)            EXISTING: Voice mapping │
│    ├──< station_schedules (13 cols)        EXISTING: Broadcast sched│
│    ├──< station_analytics (7 cols)         EXISTING: Metrics       │
│    └──< radio_station_state (22 cols)      ← NEW: Now Playing     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         CONTENT TABLES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  events (23 cols)                    EXISTING: Unified content     │
│    ├──< playback_history (17 cols)   ← NEW: Detailed play log     │
│    └──< queue_played_items (12 cols) ← NEW: Played tracking       │
│                                                                     │
│  music_tracks (16 cols)             EXISTING: Music catalog        │
│    ├──< music_playlists (8 cols)     EXISTING: Playlist mgmt      │
│    │      └──< playlist_tracks (5 cols) EXISTING: Track ordering   │
│    ├──< music_play_history (6 cols)  EXISTING: Music rotation      │
│    └──< entertainment_tracks (15 cols) ← NEW: Entertainment config │
│                                                                     │
│  bulletin_schedule (9 cols)         EXISTING: Bulletin timing      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         CONFIGURATION TABLES                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  audio_config (30+ cols)            ← NEW: Audio timing/volumes   │
│  engine_config (18+ cols)           ← NEW: Engine behavior        │
│  content_templates (16 cols)        ← NEW: All text templates     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         PROVIDER TABLES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  provider_configs (12 cols)         EXISTING: Provider settings    │
│  provider_sync_logs (11 cols)       EXISTING: Sync tracking        │
│  provider_taxonomy (10 cols)        ← NEW: Classification maps    │
│  normalizer_config (8 cols)         ← NEW: Normalizer settings    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         LANGUAGE / TTS TABLES                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  translation_cache (12 cols)        EXISTING: Translation cache    │
│  language_detection_cache (7 cols)  EXISTING: Language detection   │
│  tts_audio_cache (16 cols)          ← NEW: TTS audio cache        │
│  prompt_templates (13 cols)         EXISTING: AI prompt templates  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         FEATURE / MISC TABLES                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  feature_flags (11 cols)            EXISTING: Feature gating       │
│  feature_flag_overrides (7 cols)    EXISTING: Per-station overrides│
│  feature_flag_log (7 cols)          EXISTING: Audit trail          │
│  content_sources (16 cols)          EXISTING: RSS source registry  │
│  station_sources (3 cols)           EXISTING: Station-source link  │
│  ingestion_logs (11 cols)           EXISTING: Ingestion tracking   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         LEGACY (Deprecated)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  news_items (15 cols)       ← DEPRECATED → events                  │
│  feeds (9 cols)             ← DEPRECATED → provider_configs        │
│  radio_scripts (9 cols)     ← DEPRECATED → events + prompt_templates│
│  broadcast_queue (7 cols)   ← DEPRECATED → queue_played_items      │
│  alerts (6 cols)            ← DEPRECATED → events (category=emergency)│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## RLS Policies

### Summary

| Table | Frontend Read | Frontend Write | Backend Read | Backend Write |
|-------|:---:|:---:|:---:|:---:|
| `radio_station_state` | ✅ | ❌ | ✅ | ✅ |
| `station_channels` | ✅ (active only) | ❌ | ✅ | ✅ |
| `queue_played_items` | ❌ | ❌ | ✅ | ✅ |
| `tts_audio_cache` | ❌ | ❌ | ✅ | ✅ |
| `content_templates` | ✅ (active only) | ❌ | ✅ | ✅ |
| `audio_config` | ✅ (active only) | ❌ | ✅ | ✅ |
| `engine_config` | ❌ | ❌ | ✅ | ✅ |
| `provider_taxonomy` | ❌ | ❌ | ✅ | ✅ |
| `normalizer_config` | ❌ | ❌ | ✅ | ✅ |
| `playback_history` | ❌ | ❌ | ✅ | ✅ |
| `entertainment_tracks` | ✅ (active only) | ❌ | ✅ | ✅ |
| `events` | ✅ | ❌ | ✅ | ✅ |
| `stations` | ✅ | ❌ | ✅ | ✅ |
| `station_voices` | ✅ | ❌ | ✅ | ✅ |
| `station_schedules` | ✅ | ❌ | ✅ | ✅ |
| `music_tracks` | ✅ | ❌ | ✅ | ✅ |
| `music_playlists` | ✅ | ❌ | ✅ | ✅ |
| `bulletin_schedule` | ✅ | ❌ | ✅ | ✅ |
| `translation_cache` | ❌ | ❌ | ✅ | ✅ |
| `prompt_templates` | ✅ | ❌ | ✅ | ✅ |

### Policy Definitions

```sql
-- ============================================
-- RADIO STATION STATE (Now Playing)
-- ============================================
ALTER TABLE radio_station_state ENABLE ROW LEVEL SECURITY;

-- Frontend: read-only access to all station states
CREATE POLICY "radio_station_state_select_anon"
  ON radio_station_state FOR SELECT
  USING (true);

-- Backend: full access via service role
CREATE POLICY "radio_station_state_service_role"
  ON radio_station_state FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- STATION CHANNELS
-- ============================================
ALTER TABLE station_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_channels_select_active"
  ON station_channels FOR SELECT
  USING (is_active = true);

CREATE POLICY "station_channels_service_role"
  ON station_channels FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- QUEUE PLAYED ITEMS
-- ============================================
ALTER TABLE queue_played_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_played_items_service_role"
  ON queue_played_items FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- TTS AUDIO CACHE
-- ============================================
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tts_audio_cache_service_role"
  ON tts_audio_cache FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- CONTENT TEMPLATES
-- ============================================
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_templates_select_active"
  ON content_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "content_templates_service_role"
  ON content_templates FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- AUDIO CONFIG
-- ============================================
ALTER TABLE audio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_config_select_active"
  ON audio_config FOR SELECT
  USING (is_active = true);

CREATE POLICY "audio_config_service_role"
  ON audio_config FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- ENGINE CONFIG
-- ============================================
ALTER TABLE engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engine_config_service_role"
  ON engine_config FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PROVIDER TAXONOMY
-- ============================================
ALTER TABLE provider_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_taxonomy_service_role"
  ON provider_taxonomy FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- NORMALIZER CONFIG
-- ============================================
ALTER TABLE normalizer_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normalizer_config_service_role"
  ON normalizer_config FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PLAYBACK HISTORY
-- ============================================
ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playback_history_service_role"
  ON playback_history FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- ENTERTAINMENT TRACKS
-- ============================================
ALTER TABLE entertainment_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entertainment_tracks_select_active"
  ON entertainment_tracks FOR SELECT
  USING (is_active = true);

CREATE POLICY "entertainment_tracks_service_role"
  ON entertainment_tracks FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Event-Driven Architecture

### Overview

The Radio Engine uses an **event-driven architecture** instead of polling loops. Three event sources drive the engine:

1. **Provider Events** — Content arrives from RSS/LezoTraffic providers
2. **Supabase Realtime** — Frontend subscribes to `radio_station_state` changes
3. **Scheduled Timers** — Bulletins, time announcements, station IDs

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT SOURCES                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. PROVIDER EVENTS (push)                                         │
│     Provider sync → INSERT INTO events → PostgreSQL trigger         │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│     │ RSS Provider  │───→│ events table │───→│ notify('new_event')│  │
│     │ LezoTraffic   │───→│              │    └────────┬─────────┘   │
│     └──────────────┘    └──────────────┘             │              │
│                                                       ▼              │
│                                            ┌──────────────────┐     │
│                                            │ Engine listens   │     │
│                                            │ via pg_notify()  │     │
│                                            └──────────────────┘     │
│                                                                     │
│  2. SUPABASE REALTIME (push to frontend)                           │
│     Engine writes → UPDATE radio_station_state → Realtime broadcast │
│     ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐   │
│     │ Engine writes │───→│ radio_station_   │───→│ Frontend     │   │
│     │ new state     │    │ state UPDATE     │    │ subscribes  │   │
│     └──────────────┘    └──────────────────┘    └──────────────┘   │
│                                                                     │
│  3. SCHEDULED TIMERS (engine-internal)                              │
│     ┌──────────────────────────────────────────────────────────┐   │
│     │ node-cron schedules (from bulletin_schedule table):      │   │
│     │   - 09:00, 12:00, 15:00, 18:00, 21:00 → bulletin       │   │
│     │   - Every 10-15 min → station ID jingle                  │   │
│     │   - Every 20-30 min → time announcement                  │   │
│     │   - On segment end → next content selection              │   │
│     └──────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Provider Events — `pg_notify` / `LISTEN`

When a provider syncs new content, a PostgreSQL trigger fires `pg_notify` to alert the engine.

**Trigger — notify engine on new events:**
```sql
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

CREATE TRIGGER trg_events_notify_engine
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_engine_new_event();
```

**Engine listener (Node.js):**
```javascript
// backend/engine/eventListener.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Listen for new events via pg_notify
supabase.channel('engine-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'events'
  }, (payload) => {
    console.log('New event:', payload.new);
    // Trigger queue rebuild for affected channels
    engine.onNewContent(payload.new);
  })
  .subscribe();

// Also listen for state changes (for cross-tab sync)
supabase.channel('engine-state')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'radio_station_state'
  }, (payload) => {
    // Frontend receives this via Realtime subscription
    console.log('State updated:', payload.new);
  })
  .subscribe();
```

### 2. Supabase Realtime — Frontend Subscription

The frontend subscribes to `radio_station_state` changes via Supabase Realtime. No polling.

**Frontend hook:**
```typescript
// src/hooks/useNowPlaying.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useNowPlaying(channelId: string) {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchState = async () => {
      const { data } = await supabase
        .from('radio_station_state')
        .select('*')
        .eq('channel_id', channelId)
        .single();
      if (data) setNowPlaying(data);
    };
    fetchState();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`radio-state-${channelId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'radio_station_state',
        filter: `channel_id=eq.${channelId}`
      }, (payload) => {
        setNowPlaying(payload.new);
        setIsConnected(true);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  return { nowPlaying, isConnected };
}
```

### 3. Scheduled Timers — Bulletins & Announcements

Bulletins and time-based announcements use `node-cron` with schedules read from the database.

**Engine scheduler:**
```javascript
// backend/engine/eventScheduler.js
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export class EventScheduler {
  constructor(engine) {
    this.engine = engine;
    this.jobs = new Map();
  }

  async initialize() {
    // Load bulletin schedules from database
    const { data: bulletins } = await supabase
      .from('bulletin_schedule')
      .select('*')
      .eq('is_active', true);

    for (const bulletin of bulletins) {
      const cronExpr = `${bulletin.minute} ${bulletin.hour} * * *`;
      const job = cron.schedule(cronExpr, () => {
        this.engine.triggerBulletin(bulletin);
      }, { timezone: this.engine.timezone });
      this.jobs.set(bulletin.id, job);
    }

    // Load station ID and time announcement intervals from station_channels
    const { data: channels } = await supabase
      .from('station_channels')
      .select('channel_id, station_id_interval_min_ms, station_id_interval_max_ms, time_announcement_interval_min_ms, time_announcement_interval_max_ms')
      .eq('is_active', true);

    for (const channel of channels) {
      this.scheduleStationId(channel);
      this.scheduleTimeAnnouncement(channel);
    }
  }

  scheduleStationId(channel) {
    const interval = channel.station_id_interval_min_ms +
      Math.random() * (channel.station_id_interval_max_ms - channel.station_id_interval_min_ms);

    setInterval(() => {
      this.engine.triggerStationId(channel.channel_id);
    }, interval);
  }

  scheduleTimeAnnouncement(channel) {
    const interval = channel.time_announcement_interval_min_ms +
      Math.random() * (channel.time_announcement_interval_max_ms - channel.time_announcement_interval_min_ms);

    setInterval(() => {
      this.engine.triggerTimeAnnouncement(channel.channel_id);
    }, interval);
  }
}
```

### 4. Engine Core — Event-Driven Loop

The engine reacts to events instead of polling. It maintains an internal state machine per channel.

```javascript
// backend/engine/radioEngine.js
export class RadioEngine {
  constructor() {
    this.channels = new Map(); // channel_id → ChannelState
    this.eventListener = new EventListener(this);
    this.scheduler = new EventScheduler(this);
    this.queueManager = new QueueManager();
    this.playbackController = new PlaybackController();
    this.ttsGenerator = new TTSGenerator();
  }

  async start() {
    // Initialize from database
    await this.loadChannelStates();
    await this.scheduler.initialize();
    await this.eventListener.start();

    console.log('Radio Engine started — event-driven mode');
  }

  // Called when new content arrives (provider event)
  async onNewContent(event) {
    const affectedChannels = await this.getAffectedChannels(event);
    for (const channelId of affectedChannels) {
      await this.rebuildQueue(channelId);
      // If the new content has higher priority than current, interrupt
      if (event.priority < this.channels.get(channelId).currentPriority) {
        await this.interruptWithContent(channelId, event);
      }
    }
  }

  // Called by scheduler when bulletin is due
  async triggerBulletin(bulletin) {
    const channels = await this.getChannelsForBulletin(bulletin);
    for (const channelId of channels) {
      await this.interruptWithBulletin(channelId, bulletin);
    }
  }

  // Called by scheduler for station ID
  async triggerStationId(channelId) {
    await this.insertJingle(channelId, 'station_id');
  }

  // Called by scheduler for time announcement
  async triggerTimeAnnouncement(channelId) {
    await this.insertTts(channelId, 'time_announcement');
  }

  // Write new state to database (frontend picks up via Realtime)
  async updateState(channelId, newState) {
    const current = this.channels.get(channelId);
    const version = (current?.version || 0) + 1;

    await supabase
      .from('radio_station_state')
      .upsert({
        channel_id: channelId,
        station_id: current.stationId,
        ...newState,
        version,
        generated_at: new Date().toISOString()
      }, { onConflict: 'channel_id' });

    this.channels.set(channelId, { ...current, ...newState, version });
  }

  // Log to playback_history
  async logPlayback(channelId, segment) {
    await supabase.from('playback_history').insert({
      channel_id: channelId,
      station_id: this.channels.get(channelId).stationId,
      segment_type: segment.type,
      segment_id: segment.id,
      source_table: segment.sourceTable,
      audio_url: segment.audioUrl,
      title: segment.title,
      artist: segment.artist,
      duration_seconds: segment.duration,
      started_at: new Date().toISOString(),
      language: segment.language,
      voice_id: segment.voiceId
    });
  }
}
```

---

## Migration Plan

### Phase 0: Dead Code Cleanup ✅ (Completed)

**Action:** Deleted dead files, archived nothing (they were already dead code with no imports).

**Deleted:**
- `src/engines/` (36 files) — V2 scaffolding
- `src/services/radio/` (5 files) — Dead services
- `src/services/rss/` (6 files) — Dead RSS
- `src/services/tts/browserTTS.ts`, `ttsProvider.ts`
- `src/services/audio/AmbientAudio.ts`
- `src/lib/broadcastState.ts`
- `src/components/diagnostics/` (3 files)

### Phase 1: Archive Legacy Code (New)

**Action:** Move legacy code to `src/_legacy/` archive directory. No deletions — preserve for reference until feature parity.

**Archive directory:** `src/_legacy/`

```
src/_legacy/
├── hooks/
│   ├── useRadioEngine.ts          (919 lines) — Archive, keep for reference
│   ├── useVoiceEngine.ts          (142 lines) — Archive
│   ├── useBroadcastFlowSupervisor.ts (250 lines) — Archive
│   ├── useFrenchBulletin.ts       (61 lines)  — Archive
│   └── useBulletinSync.ts         (89 lines)  — Archive
├── lib/
│   ├── broadcastProgress.ts       (92 lines)  — Archive
│   ├── broadcastFlowSupervisor.ts (73 lines)  — Archive
│   ├── frenchBulletin.ts          (104 lines) — Archive
│   ├── stationNewsFilter.ts       (73 lines)  — Archive
│   ├── newsText.ts                (98 lines)  — Archive
│   └── types.ts                   (461 lines) — Archive (TRANSITIONS array)
├── services/
│   └── tts/
│       └── elevenlabsTTS.ts       (273 lines) — Archive (TTS moves to backend)
└── README.md                      — Documents what each archived file did
```

**Process:**
1. Create `src/_legacy/` directory
2. Move each file, preserving relative paths
3. Update any imports in active code to point to new backend equivalents
4. Create `src/_legacy/README.md` explaining the archive
5. Add `// @deprecated — archived in Phase 1, replaced by [new file]` comment at top of each archived file

### Phase 2: Database Migration (New)

**Action:** Create the new database tables from the schema above.

**Migration file:** `supabase/migrations/20260714_v3_radio_engine.sql`

**Contents:**
1. `CREATE TABLE radio_station_state` + indexes + RLS
2. `CREATE TABLE queue_played_items` + indexes + RLS
3. `CREATE TABLE station_channels` + indexes + RLS + seed data
4. `CREATE TABLE tts_audio_cache` + indexes + RLS
5. `CREATE TABLE content_templates` + indexes + RLS + seed data
6. `CREATE TABLE audio_config` + indexes + RLS + seed data
7. `CREATE TABLE engine_config` + indexes + RLS + seed data
8. `CREATE TABLE provider_taxonomy` + indexes + RLS + seed data
9. `CREATE TABLE normalizer_config` + indexes + RLS + seed data
10. `CREATE TABLE playback_history` + indexes + RLS
11. `CREATE TABLE entertainment_tracks` + indexes + RLS
12. `CREATE FUNCTION notify_engine_new_event()` trigger
13. `CREATE TRIGGER trg_events_notify_engine`

### Phase 3: Backend Engine Core (New)

**Action:** Implement backend engine modules that read from the new tables.

**Files to create:**
```
backend/engine/
├── radioEngine.js          — Top-level orchestrator
├── eventListener.js        — pg_notify listener
├── eventScheduler.js       — Cron-based bulletins/announcements
├── queueManager.js         — Queue generation from DB
├── playbackController.js   — State machine + segment timing
├── audioManager.js         — Mix computation (mirrors AudioManager.ts)
├── ttsGenerator.js         — ElevenLabs API + Storage
├── languageController.js   — Voice resolution from station_voices
├── stationController.js    — Config from station_channels
├── contentNormalizer.js    — Reads provider_taxonomy + normalizer_config
├── radioWsServer.js        — WebSocket server
├── constants.js            — (minimal, most config from DB)
└── utils/
    ├── timezone.js
    └── newsText.js
```

### Phase 4: Frontend Migration (New)

**Action:** Replace active hooks with new DB-driven hooks.

**New files:**
```
src/hooks/
├── useNowPlaying.ts        — Supabase Realtime subscription
└── useAudioExecutor.ts     — Audio rendering (reuses AudioManager.ts)
```

**Deprecated (moved to _legacy):**
- `useRadioEngine.ts` → `useNowPlaying` + `useAudioExecutor`
- `useVoiceEngine.ts` → Backend TTS
- `useBroadcastFlowSupervisor.ts` → Backend EventScheduler
- `useFrenchBulletin.ts` → Backend EventScheduler
- `useBulletinSync.ts` → `useNowPlaying` (state is in NowPlaying)

### Phase 5: Hardening + Archive Cleanup (New)

**Action:** After feature parity is confirmed:
1. Verify all legacy functionality is replicated
2. Run parallel testing (old vs new)
3. Delete `src/_legacy/` directory
4. Remove deprecated tables (`news_items`, `feeds`, `radio_scripts`, `broadcast_queue`, `alerts`)
5. Final documentation update

---

## Adding a New Country (Expansion Example)

Adding Kenya requires **zero code changes** — only database inserts:

```sql
-- 1. Create station
INSERT INTO stations (name, country, country_code, region, language, timezone, priority, is_active)
VALUES ('Kenya', 'Kenya', 'KE', 'East Africa', 'sw', 'Africa/Nairobi', 1, true);

-- 2. Create channels
INSERT INTO station_channels (station_id, channel_id, name, language, frequency, genre_weights, primary_voice_id)
SELECT
  s.id,
  'nairobi-main',
  'Nairobi Main',
  'sw',
  91.5,
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}',
  sv.voice_id
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'KE';

-- 3. Configure voice
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-id-here', 'sw', 'female', 'formal', true
FROM stations WHERE country_code = 'KE';

-- 4. Set audio config (channel-specific overrides)
INSERT INTO audio_config (channel_id, station_id, intro_url, background_url)
SELECT 'nairobi-main', s.id,
  'https://storage.supabase.co/.../kenya-intro.mp3',
  'https://storage.supabase.co/.../kenya-background.mp3'
FROM stations WHERE country_code = 'KE';

-- 5. Set engine config (channel-specific overrides)
INSERT INTO engine_config (channel_id, station_id, fallback_message)
SELECT 'nairobi-main', s.id, 'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.'
FROM stations WHERE country_code = 'KE';

-- 6. Add content templates in Swahili
INSERT INTO content_templates (template_type, language, channel_id, text_content)
VALUES
  ('transition', 'sw', 'nairobi-main', 'Endelea kusikiliza, habari zaidi zinakuja.'),
  ('station_id', 'sw', 'nairobi-main', 'Unasikiliza {station}. Karibu.'),
  ('fallback_message', 'sw', 'nairobi-main', 'Hakuna habari za hivi karibuni. Tafadhali subiri.');

-- 7. Add entertainment tracks
INSERT INTO entertainment_tracks (title, artist, audio_url, duration_ms, channel_id, station_id)
SELECT 'Kenya Beats', 'Local Artist', 'https://storage/.../kenya-beats.mp3', 180000, 'nairobi-main', s.id
FROM stations WHERE country_code = 'KE';

-- 8. Add bulletin schedule (if needed)
INSERT INTO bulletin_schedule (name, type, language, hour, minute, duration_s)
VALUES
  ('Swahili Bulletin — Morning', 'swahili_global', 'sw', 7, 0, 300),
  ('Swahili Bulletin — Midday', 'swahili_global', 'sw', 12, 0, 300),
  ('Swahili Bulletin — Evening', 'swahili_global', 'sw', 18, 0, 300);
```

**The engine automatically:**
- Picks up the new channel on next startup
- Starts generating queues for `nairobi-main`
- Subscribes to provider events for Kenya content
- Schedules bulletins at the configured times
- Uses the configured Swahili voice for TTS
