-- AARN v2: Translations Cache
-- Caches translations to reduce API calls and improve performance
-- Run this migration in the Supabase SQL editor.

-- Translations Cache Table
CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.9,
  provider TEXT DEFAULT 'google',
  content_type TEXT DEFAULT 'script',
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  UNIQUE(text_hash, source_language, target_language)
);

-- Language Detection Cache Table
CREATE TABLE IF NOT EXISTS language_detection_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash TEXT NOT NULL,
  detected_language TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  alternatives JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(content_hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_translation_cache_languages ON translation_cache(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_hash ON language_detection_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_expires ON language_detection_cache(expires_at);

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM translation_cache WHERE expires_at < now();
  DELETE FROM language_detection_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run daily via pg_cron if available)
-- SELECT cron.schedule('cleanup-expired-cache', '0 2 * * *', 'SELECT cleanup_expired_cache()');