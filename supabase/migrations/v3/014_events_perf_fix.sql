-- =============================================================================
-- Migration 014: events table performance fix
-- =============================================================================
-- The `events` table has grown unbounded (no retention job ever pruned it,
-- unlike news_items/radio_scripts) and every hot-path query filters on
-- status + category + created_at, ordered by created_at DESC. Only single
-- column indexes existed, so Postgres could not satisfy this efficiently and
-- queries were hitting "canceling statement due to statement timeout".
--
-- This adds the composite index the actual query shapes need, plus a
-- retention column check to support the new expiry cleanup job.
-- =============================================================================

-- Composite index matching queueManager.getUnplayedEvents() and
-- backend/server.js getNewsContent():
--   WHERE status = 'active' AND category <> 'geo' AND created_at >= X
--   ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_events_status_category_created
  ON events (status, category, created_at DESC);

-- Covers the frontend/backend category-list ("IN (...)") + created_at range
-- query shape when status isn't filtered (e.g. admin views).
CREATE INDEX IF NOT EXISTS idx_events_category_created
  ON events (category, created_at DESC);

-- Refresh planner statistics immediately after index creation so the new
-- indexes are actually used right away rather than waiting for autovacuum.
ANALYZE events;
