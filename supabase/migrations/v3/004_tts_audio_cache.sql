-- =============================================================================
-- Migration 004: tts_audio_cache
-- =============================================================================
-- Caches generated TTS audio to avoid regeneration. Stores the Supabase
-- Storage URL for each unique text+voice combination.
--
-- Module: TTSGenerator
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS tts_audio_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Input fingerprint
  text_hash TEXT NOT NULL,            -- SHA-256(normalized_text + voice_id + language)
  text_content TEXT NOT NULL,         -- Original text for debugging
  voice_id TEXT NOT NULL,             -- ElevenLabs voice ID
  language TEXT NOT NULL,

  -- Output
  audio_url TEXT NOT NULL,            -- Supabase Storage URL
  audio_duration_ms INT,             -- Duration for scheduling
  audio_file_size INT,               -- File size in bytes

  -- Metadata
  provider TEXT DEFAULT 'elevenlabs',
  model_id TEXT,                     -- e.g., 'eleven_multilingual_v2'
  stability NUMERIC(3,2),
  similarity_boost NUMERIC(3,2),

  -- Usage tracking
  hit_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Expiry
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(text_hash, voice_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_audio_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice ON tts_audio_cache(voice_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_expires ON tts_audio_cache(expires_at);

-- Composite index for cache lookup
CREATE INDEX IF NOT EXISTS idx_tts_cache_lookup ON tts_audio_cache(text_hash, voice_id, language);

-- RLS
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tts_audio_cache_service_role"
  ON tts_audio_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE tts_audio_cache IS 'Caches generated TTS audio. Keyed by text_hash + voice_id + language.';
COMMENT ON COLUMN tts_audio_cache.text_hash IS 'SHA-256 hash of normalized text for cache lookup';
COMMENT ON COLUMN tts_audio_cache.expires_at IS 'Auto-expires after 7 days to prevent stale cache';
