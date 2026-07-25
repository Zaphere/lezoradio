-- Clear stale events backlog: delete events older than 4 hours
-- Keeps only recent events so the engine doesn't starve music

DELETE FROM events
WHERE status = 'active'
  AND created_at < now() - interval '4 hours';

-- Also clear stale queue_played_items older than 24 hours
DELETE FROM queue_played_items
WHERE created_at < now() - interval '24 hours';

-- Force fresh TTS generation with proxy URLs (clear old cached entries)
DELETE FROM tts_audio_cache;
