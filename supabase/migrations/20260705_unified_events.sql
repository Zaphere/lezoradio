-- AARN Generic Provider Framework: Unified Events Table
-- This migration creates a unified data model for all providers (RSS, LezoTraffic, Weather, etc.)
-- Run this migration in the Supabase SQL editor.

-- Unified Events Table
-- All providers insert normalized records into this single table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL, -- 'rss', 'lezotraffic', 'weather', etc.
  provider_record_id TEXT NOT NULL, -- Provider's unique ID
  provider_type TEXT, -- Specific type from provider (e.g., 'alert', 'incident')
  category TEXT NOT NULL, -- 'news', 'traffic', 'weather', 'emergency', etc.
  subcategory TEXT, -- 'accident', 'congestion', 'politics', etc.
  priority INT NOT NULL DEFAULT 5, -- 1-10, lower = higher priority
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  country TEXT DEFAULT 'CD',
  province TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status TEXT DEFAULT 'active', -- 'active', 'resolved', 'archived'
  verified BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'fr',
  occurred_at TIMESTAMPTZ, -- When the event actually happened
  expires_at TIMESTAMPTZ, -- When the event should no longer be relevant
  metadata JSONB, -- Provider-specific structured data
  raw_payload JSONB, -- Original API response for debugging
  raw_payload_version INT DEFAULT 1, -- Version of raw payload structure
  api_version TEXT, -- API version used to fetch data
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_record_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_provider ON events(provider);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_provider_record_id ON events(provider, provider_record_id);
CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);

-- Provider Configs Table
-- Stores configuration for each provider and station mappings
CREATE TABLE IF NOT EXISTS provider_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  config JSONB, -- Provider-specific configuration
  priority INT DEFAULT 5,
  sync_schedule TEXT, -- Cron expression
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for provider configs
CREATE INDEX IF NOT EXISTS idx_provider_configs_provider ON provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled ON provider_configs(enabled);

-- Provider Sync Logs Table
-- Tracks sync operations across all providers
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT, -- Specific endpoint synced (e.g., 'alerts', 'incidents')
  status TEXT NOT NULL, -- 'success', 'fail', 'partial'
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  items_updated INT DEFAULT 0,
  items_skipped INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  errors TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for sync logs
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider ON provider_sync_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_endpoint ON provider_sync_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_created_at ON provider_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_status ON provider_sync_logs(status);

-- Seed default provider configurations
INSERT INTO provider_configs (provider, enabled, config, priority, sync_schedule)
VALUES
  ('rss', true, '{"feed_count": 0}', 5, '*/15 * * * *'),
  ('lezotraffic', false, '{}', 5, '*/1 * * * *')
ON CONFLICT (provider) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE events IS 'Unified events table for all providers (RSS, LezoTraffic, Weather, etc.)';
COMMENT ON COLUMN events.provider IS 'Provider identifier (rss, lezotraffic, weather, etc.)';
COMMENT ON COLUMN events.provider_record_id IS 'Unique ID from the provider system';
COMMENT ON COLUMN events.category IS 'Event category (news, traffic, weather, emergency, etc.)';
COMMENT ON COLUMN events.subcategory IS 'Event subcategory (accident, congestion, politics, etc.)';
COMMENT ON COLUMN events.priority IS 'Broadcast priority (1-10, lower = higher priority)';
COMMENT ON COLUMN events.metadata IS 'Provider-specific structured data';
COMMENT ON COLUMN events.raw_payload IS 'Original API response for debugging';

COMMENT ON TABLE provider_configs IS 'Configuration for each provider';
COMMENT ON COLUMN provider_configs.config IS 'Provider-specific configuration (JSONB)';
COMMENT ON COLUMN provider_configs.sync_schedule IS 'Cron expression for sync schedule';

COMMENT ON TABLE provider_sync_logs IS 'Sync operation logs for all providers';
