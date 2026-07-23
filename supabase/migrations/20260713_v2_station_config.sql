-- AARN v2: Station Configuration Extension
-- Extends the existing stations table with v2 configuration fields
-- Run this migration in the Supabase SQL editor.

-- Add v2 configuration fields to stations table
ALTER TABLE stations ADD COLUMN IF NOT EXISTS v2_config JSONB DEFAULT '{}';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS v2_status TEXT DEFAULT 'inactive';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS v2_last_migration TIMESTAMPTZ;

-- Station Voices Table
-- Maps TTS voices to stations per language
CREATE TABLE IF NOT EXISTS station_voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  language TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'neutral')) DEFAULT 'neutral',
  style TEXT CHECK (style IN ('formal', 'casual', 'dramatic')) DEFAULT 'formal',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, language, voice_id)
);

-- Station Schedules Table
-- Defines broadcast schedules per station
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

-- Station Analytics Table
-- Tracks station performance metrics
CREATE TABLE IF NOT EXISTS station_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_station_voices_station_id ON station_voices(station_id);
CREATE INDEX IF NOT EXISTS idx_station_voices_language ON station_voices(language);
CREATE INDEX IF NOT EXISTS idx_station_schedules_station_id ON station_schedules(station_id);
CREATE INDEX IF NOT EXISTS idx_station_schedules_event_type ON station_schedules(event_type);
CREATE INDEX IF NOT EXISTS idx_station_analytics_station_id ON station_analytics(station_id);
CREATE INDEX IF NOT EXISTS idx_station_analytics_metric_name ON station_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_station_analytics_recorded_at ON station_analytics(recorded_at DESC);