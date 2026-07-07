-- AARN Live RSS Ingestion + Time-Based Expiry System
-- Run after 20260701_add_timezone_and_bulletin.sql
-- Only extends, never modifies existing tables

-- 1. Ingestion monitoring log
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_source   TEXT NOT NULL,
  feed_url      TEXT,
  language      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success', 'fail')),
  items_fetched INT DEFAULT 0,
  items_inserted INT DEFAULT 0,
  items_skipped INT DEFAULT 0,
  errors        TEXT,
  duration_ms   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Language tag for news_items (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_items' AND column_name = 'language'
  ) THEN
    ALTER TABLE news_items ADD COLUMN language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'sw', 'ln', 'en'));
  END IF;
END $$;

-- 3. Language tag for feeds (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feeds' AND column_name = 'language'
  ) THEN
    ALTER TABLE feeds ADD COLUMN language TEXT DEFAULT 'en';
  END IF;
END $$;

-- 4. Translation metadata for news_items (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_items' AND column_name = 'is_translated'
  ) THEN
    ALTER TABLE news_items ADD COLUMN is_translated BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_items' AND column_name = 'source_language'
  ) THEN
    ALTER TABLE news_items ADD COLUMN source_language TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_items' AND column_name = 'translation_required'
  ) THEN
    ALTER TABLE news_items ADD COLUMN translation_required BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 5. Translation flag for content_sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_sources' AND column_name = 'translation_required'
  ) THEN
    ALTER TABLE content_sources ADD COLUMN translation_required BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 6. Performance indexes (IF NOT EXISTS safe)
CREATE INDEX IF NOT EXISTS idx_news_items_language ON news_items (language);
CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON news_items (category);
CREATE INDEX IF NOT EXISTS idx_news_items_url ON news_items (url);
CREATE INDEX IF NOT EXISTS idx_news_items_feed_id ON news_items (feed_id);
CREATE INDEX IF NOT EXISTS idx_news_items_ingested_at ON news_items (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_scripts_news_item_id ON radio_scripts (news_item_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status ON ingestion_logs (status);

-- 7. Deduplication helper: URL hash for faster lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_items' AND column_name = 'url_hash'
  ) THEN
    ALTER TABLE news_items ADD COLUMN url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED;
    CREATE INDEX IF NOT EXISTS idx_news_items_url_hash ON news_items (url_hash);
  END IF;
END $$;
