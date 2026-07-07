-- AARN Provider Framework Upgrade
-- Adds provider_hash, raw payload versioning, event lifecycle columns

-- Add provider_hash for framework-level dedup
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_events_provider_hash ON events(provider_hash);

-- Add raw payload versioning
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_payload_version INT DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS api_version TEXT;

-- Add event lifecycle timestamps
ALTER TABLE events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add provider_type for the French domain type
ALTER TABLE events ADD COLUMN IF NOT EXISTS provider_type TEXT;

-- Add endpoint and metrics columns to sync logs
ALTER TABLE provider_sync_logs ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE provider_sync_logs ADD COLUMN IF NOT EXISTS metrics JSONB;

-- Add capabilities storage to provider_configs
ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS capabilities JSONB;

-- Add comments
COMMENT ON COLUMN events.provider_hash IS 'SHA-256 hash of provider:provider_event_id for dedup';
COMMENT ON COLUMN events.raw_payload_version IS 'Version of raw_payload schema for tracking API changes';
COMMENT ON COLUMN events.api_version IS 'API version that produced this event (e.g. v1)';
COMMENT ON COLUMN events.occurred_at IS 'When the event actually occurred (from provider)';
COMMENT ON COLUMN events.expires_at IS 'When the event expires and can be archived';
COMMENT ON COLUMN events.provider_type IS 'Original type string from the provider (e.g. embouteillage)';
COMMENT ON COLUMN provider_sync_logs.metrics IS 'Structured metrics for provider dashboard';
COMMENT ON COLUMN provider_configs.capabilities IS 'Provider capability metadata';
