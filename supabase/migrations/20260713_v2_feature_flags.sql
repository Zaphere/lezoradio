-- AARN v2: Feature Flags
-- Database-backed feature flags for gradual rollout
-- Run this migration in the Supabase SQL editor.

-- Feature Flags Table
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

-- Feature Flag Overrides Table
-- Per-user or per-station flag overrides
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  user_id UUID,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(flag_id, user_id, station_id)
);

-- Feature Flag Log Table
-- Tracks flag evaluation for analytics
CREATE TABLE IF NOT EXISTS feature_flag_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  user_id UUID,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  was_enabled BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag_id ON feature_flag_overrides(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_station_id ON feature_flag_overrides(station_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_flag_id ON feature_flag_log(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_evaluated_at ON feature_flag_log(evaluated_at DESC);

-- Seed initial v2 feature flags
INSERT INTO feature_flags (id, name, description, enabled, rollout_percentage)
VALUES
  ('v2-provider-engine', 'V2 Provider Engine', 'Use the new provider engine for content ingestion', false, 0),
  ('v2-queue-engine', 'V2 Queue Engine', 'Use the new queue engine for broadcast queue management', false, 0),
  ('v2-broadcast-engine', 'V2 Broadcast Engine', 'Use the new broadcast engine for playback control', false, 0),
  ('v2-voice-engine', 'V2 Voice Engine', 'Use the new voice engine for TTS generation', false, 0),
  ('v2-audio-engine', 'V2 Audio Engine', 'Use the new audio engine for mixing and playback', false, 0),
  ('v2-music-engine', 'V2 Music Engine', 'Use the new music engine for playlist management', false, 0),
  ('v2-transition-engine', 'V2 Transition Engine', 'Use the new transition engine for audio transitions', false, 0),
  ('v2-ai-director', 'V2 AI Director', 'Use the new AI director for script generation', false, 0),
  ('v2-language-engine', 'V2 Language Engine', 'Use the new language engine for translation and detection', false, 0),
  ('v2-station-engine', 'V2 Station Engine', 'Use the new station engine for configuration management', false, 0),
  ('v2-scheduling-engine', 'V2 Scheduling Engine', 'Use the new scheduling engine for event management', false, 0),
  ('v2-alert-engine', 'V2 Alert Engine', 'Use the new alert engine for emergency and traffic alerts', false, 0),
  ('v2-analytics-engine', 'V2 Analytics Engine', 'Use the new analytics engine for metrics collection', false, 0)
ON CONFLICT (id) DO NOTHING;