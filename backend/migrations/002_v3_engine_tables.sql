-- =============================================================================
-- Migration 002: V3 Engine Tables
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
  background_url_is_random BOOLEAN DEFAULT false,
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
