-- =============================================================================
-- Migration 015: news_items table performance fix
-- =============================================================================
-- The news_items table has a single-column index on ingested_at DESC but
-- the hot-path query (getNewsContent) also filters by category IN (...),
-- so a composite index is needed.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_news_items_category_ingested
  ON news_items (category, ingested_at DESC);

ANALYZE news_items;