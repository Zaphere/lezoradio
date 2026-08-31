-- =============================================================================
-- Migration 010: Add tags column to tts_audio_cache
-- Enables tagging cached audio by station, content type, etc.
-- =============================================================================

ALTER TABLE tts_audio_cache ADD COLUMN IF NOT EXISTS tags TEXT[];
