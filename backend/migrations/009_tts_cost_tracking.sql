-- Migration 009: Add cost tracking columns to tts_audio_cache
-- Tracks ElevenLabs API usage costs per TTS generation

ALTER TABLE tts_audio_cache
  ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tts_cache_cost ON tts_audio_cache(cost_usd);
CREATE INDEX IF NOT EXISTS idx_tts_cache_chars ON tts_audio_cache(character_count);
