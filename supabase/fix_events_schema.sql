-- Comprehensive fix for events table schema
-- Add all missing columns that the backend expects

ALTER TABLE events ADD COLUMN IF NOT EXISTS api_version TEXT DEFAULT 'v1';
ALTER TABLE events ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6);
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_record_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_payload_version TEXT DEFAULT 'v1';
ALTER TABLE events ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Add missing column to feeds table
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS region TEXT;

-- Fix provider_sync_logs table
DROP TABLE IF EXISTS provider_sync_logs;
CREATE TABLE provider_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT,
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  items_skipped INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix ingestion_logs table
DROP TABLE IF EXISTS ingestion_logs;
CREATE TABLE ingestion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  feed_name TEXT,
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
