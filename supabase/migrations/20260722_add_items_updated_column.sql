-- Add missing items_updated column to provider_sync_logs
-- The table was likely created by fix_events_schema.sql or add_api_version_column.sql
-- which used a different schema than the migration in 20260705_unified_events.sql

ALTER TABLE provider_sync_logs
  ADD COLUMN IF NOT EXISTS items_updated INT DEFAULT 0;
