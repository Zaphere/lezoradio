-- =============================================================================
-- Migration 006: Seed Data — Bulletin Schedule, DRC Voices & Channels
-- =============================================================================

-- Bulletin schedule
INSERT INTO bulletin_schedule (name, label, type, language, hour, minute, duration_s)
VALUES
  ('French Global Bulletin — Morning', 'Matin', 'french_global', 'fr', 9,  0, 300),
  ('French Global Bulletin — Midday', 'Midi', 'french_global', 'fr', 12, 0, 300),
  ('French Global Bulletin — Afternoon', 'Après-midi', 'french_global', 'fr', 15, 0, 300),
  ('French Global Bulletin — Evening', 'Soir', 'french_global', 'fr', 18, 0, 300),
  ('French Global Bulletin — Night', 'Nuit', 'french_global', 'fr', 21, 0, 300)
ON CONFLICT DO NOTHING;

-- DRC Voice Profiles
-- Lingala voice for Kinshasa
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'uTB2ynnsQgtJDou6IulW', 'ln', 'male', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Goma
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, '2tSJpap7gXlgDV2bauu0', 'sw', 'female', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Lubumbashi
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, '2tSJpap7gXlgDV2bauu0', 'sw', 'female', 'casual', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- French voice (for bulletins)
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, '3IyGWZwOTNraZr1Tz0fI', 'fr', 'male', 'bulletin', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- French alert voice
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, '3IyGWZwOTNraZr1Tz0fI', 'fr', 'male', 'alert', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- DRC Station Channels
-- Kinshasa Main (Lingala)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'kinshasa-main', 'Kinshasa Main',
  'Primary Kinshasa broadcast channel in Lingala',
  88.1, '🇨🇩',
  'ln',
  '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Kinshasa', 'Africa/Kinshasa'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'ln' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- Goma Main (Swahili)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'goma-main', 'Goma Main',
  'Primary Goma broadcast channel in Swahili',
  92.5, '🌋',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "male", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Goma', 'Africa/Maputo'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- Lubumbashi Main (Swahili)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'lubumbashi-main', 'Lubumbashi Main',
  'Primary Lubumbashi broadcast channel in Swahili',
  95.3, '⛏️',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "casual", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Lubumbashi', 'Africa/Maputo'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- Global Main (French)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority, station_name, timezone
)
SELECT
  s.id, 'global-main', 'Global Main',
  'Global news and entertainment channel',
  94.1, '🌍',
  'fr',
  '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "male", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000, 8000, 600000, 900000, 1200000, 1800000,
  true, 1, 'Radio Lezo Global', 'Africa/Kinshasa'
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'fr' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;
