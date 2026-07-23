-- =============================================================================
-- Migration 999: Seed DRC Data
-- =============================================================================
-- Seeds all DRC-specific data for the Radio Engine:
--   - DR Congo station
--   - Kinshasa, Goma, Lubumbashi channels
--   - Languages (Lingala, Swahili, French)
--   - Voice profiles (station_voices)
--   - Station channels with config
--   - Default transitions (fr, ln, sw)
--   - Default engine config (per channel)
--   - Default audio config (global + per channel)
--   - Entertainment tracks
--   - Provider taxonomy (LezoTraffic)
--   - Normalizer config
--
-- Prerequisites:
--   - stations table must exist with DR Congo entry
--   - station_voices table must exist
--   - All v3 tables (001-011) must be created
--
-- Execute in Supabase SQL Editor AFTER all v3 migrations.
-- =============================================================================

-- =============================================================================
-- 1. DR CONGO STATION
-- =============================================================================
-- The station already exists from phase1_station_extend.sql.
-- Update it with timezone if missing.
UPDATE stations
SET timezone = 'Africa/Kinshasa'
WHERE country_code = 'CD' AND timezone IS NULL;

-- =============================================================================
-- 2. VOICE PROFILES (station_voices)
-- =============================================================================
-- Lingala voice for Kinshasa
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-lingala-female-01', 'ln', 'female', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Goma
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-swahili-male-01', 'sw', 'male', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- Swahili voice for Lubumbashi
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-swahili-female-01', 'sw', 'female', 'casual', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- French voice (for bulletins)
INSERT INTO station_voices (station_id, voice_id, language, gender, style, is_primary)
SELECT id, 'elevenlabs-voice-french-female-01', 'fr', 'female', 'formal', true
FROM stations WHERE country_code = 'CD' AND name = 'DR Congo'
ON CONFLICT (station_id, language, voice_id) DO NOTHING;

-- =============================================================================
-- 3. STATION CHANNELS
-- =============================================================================

-- Kinshasa Main (Lingala)
INSERT INTO station_channels (
  station_id, channel_id, name, description, frequency, emoji,
  language, genre_weights, primary_voice_id, voice_config,
  broadcast_segment_ms, entertainment_delay_ms,
  station_id_interval_min_ms, station_id_interval_max_ms,
  time_announcement_interval_min_ms, time_announcement_interval_max_ms,
  is_active, priority
)
SELECT
  s.id,
  'kinshasa-main',
  'Kinshasa Main',
  'Primary Kinshasa broadcast channel in Lingala',
  88.1,
  '🇨🇩',
  'ln',
  '{"news": 40, "traffic": 20, "music": 25, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000,   -- 4.5 min broadcast segment
  8000,     -- 8s entertainment delay
  600000,   -- 10 min station ID min
  900000,   -- 15 min station ID max
  1200000,  -- 20 min time announcement min
  1800000,  -- 30 min time announcement max
  true,
  1
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
  is_active, priority
)
SELECT
  s.id,
  'goma-main',
  'Goma Main',
  'Primary Goma broadcast channel in Swahili',
  92.5,
  '🌋',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "male", "style": "formal", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000,
  8000,
  600000,
  900000,
  1200000,
  1800000,
  true,
  1
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
  is_active, priority
)
SELECT
  s.id,
  'lubumbashi-main',
  'Lubumbashi Main',
  'Primary Lubumbashi broadcast channel in Swahili',
  95.3,
  '⛏️',
  'sw',
  '{"news": 40, "traffic": 15, "music": 30, "entertainment": 15}'::jsonb,
  sv.voice_id,
  '{"gender": "female", "style": "casual", "stability": 0.5, "similarity_boost": 0.75}'::jsonb,
  270000,
  8000,
  600000,
  900000,
  1200000,
  1800000,
  true,
  1
FROM stations s
JOIN station_voices sv ON sv.station_id = s.id AND sv.language = 'sw' AND sv.is_primary = true
WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id) DO NOTHING;

-- =============================================================================
-- 4. CONTENT TEMPLATES — Transitions
-- =============================================================================

-- French transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'fr', 'Next update coming your way in just a moment.', true),
  ('transition', 'fr', 'Stay with us, more news on the way.', true),
  ('transition', 'fr', 'We''ll be right back with more updates.', true),
  ('transition', 'fr', 'Don''t go anywhere, we have more stories for you.', true),
  ('transition', 'fr', 'Plus d''actualités dans un instant.', true),
  ('transition', 'fr', 'Restez avec nous, d''autres informations suivent.', true),
  ('transition', 'fr', 'Nous revenons avec de nouvelles mises à jour.', true),
  ('transition', 'fr', 'Ne bougez pas, d''autres histoires arrivent.', true);

-- Lingala transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'ln', 'Toki ekoya mo nzete ndakisa.', true),
  ('transition', 'ln', 'Pasieti, toki ekoya na biloko ebengi.', true),
  ('transition', 'ln', 'Tina ekoya na updates nyingi.', true),
  ('transition', 'ln', 'Kala na ye, toki ekoya na biloko mingi.', true);

-- Swahili transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'sw', 'Endelea kusikiliza, habari zaidi zinakuja.', true),
  ('transition', 'sw', 'Umbeya, habari za hivi karibuni zinafuata.', true),
  ('transition', 'sw', 'Tunaendelea na habari zaidi baada ya hapo.', true),
  ('transition', 'sw', 'Usiende popote, kuna hadithi zaidi.', true);

-- =============================================================================
-- 5. CONTENT TEMPLATES — Station IDs
-- =============================================================================

-- French station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'fr', 'Vous écoutez {station}. Restez à l''écoute.', true),
  ('station_id', 'fr', 'Ceci est {station}, votre source d''information.', true),
  ('station_id', 'fr', '{station} — l''information en continu.', true);

-- Lingala station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'ln', 'Nasikisi {station}. Kala na ye.', true),
  ('station_id', 'ln', 'Ye {station}, oyo ezali source ya information.', true),
  ('station_id', 'ln', '{station} — information ya kowaka.', true);

-- Swahili station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'sw', 'Unasikiliza {station}. Endelea kusikiliza.', true),
  ('station_id', 'sw', 'Hii ni {station}, chanzo chako cha habari.', true),
  ('station_id', 'sw', '{station} — habari za wakati wote.', true);

-- =============================================================================
-- 6. CONTENT TEMPLATES — Fallback Messages
-- =============================================================================

INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('fallback_message', 'fr', 'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.', true),
  ('fallback_message', 'ln', 'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.', true),
  ('fallback_message', 'sw', 'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.', true);

-- =============================================================================
-- 7. CONTENT TEMPLATES — Time Announcements
-- =============================================================================

INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('time_announcement', 'fr', 'Il est maintenant {time}.', true),
  ('time_announcement', 'ln', 'Sɛsɛ ezali {time}.', true),
  ('time_announcement', 'sw', 'Sasa ni {time}.', true);

-- =============================================================================
-- 8. CONTENT TEMPLATES — Coming Up Teasers
-- =============================================================================

INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('coming_up_teaser', 'fr', 'À venir, plus d''actualités de notre rédaction.', true),
  ('coming_up_teaser', 'fr', 'Restez tuned, nous avons d''autres histoires pour vous.', true),
  ('coming_up_teaser', 'ln', 'Tokina ekoya, biloko ebengi ya information.', true),
  ('coming_up_teaser', 'sw', 'Baada ya hapo, habari zaidi kutoka ofisi yetu.', true);

-- =============================================================================
-- 9. AUDIO CONFIG — Global Defaults
-- =============================================================================

INSERT INTO audio_config (
  channel_id, station_id,
  intro_url, background_url,
  intro_cue_percent, intro_duck_duration_ms, intro_speech_overlap_seconds,
  intro_min_before_speech, intro_ducked_volume, intro_fallback_cue_ms,
  intro_stop_fade_steps, intro_stop_fade_step_ms,
  background_volume, background_ducked_volume,
  background_fade_in_ms, background_fade_out_ms, background_fade_ms, background_fade_step_ms,
  track_fade_ms, track_fade_step_ms, pre_track_gap_ms,
  speech_gap_min_ms, speech_gap_max_ms,
  host_fade_in_duration_ms, host_delay_after_duck_ms,
  transition_gap_ms, crossfade_duration_ms,
  outro_fade_duration_ms, stop_fade_duration_ms,
  fade_step_ms, full_volume,
  broadcast_segment_ms, entertainment_delay_ms
)
VALUES (
  NULL, NULL,
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/LezzoTrafficappIntro.mp3',
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/backgroundmusic.mp3',
  0.85, 2000, 2.5,
  2.0, 0.18, 3000,
  8, 40,
  0.12, 0.06,
  1500, 1500, 900, 40,
  700, 40, 500,
  300, 800,
  800, 400,
  800, 1000,
  2000, 1500,
  30, 1.0,
  270000, 8000
);

-- =============================================================================
-- 10. ENGINE CONFIG — Global Defaults
-- =============================================================================

INSERT INTO engine_config (
  channel_id, station_id,
  poll_interval_ms, alert_display_duration_ms, teaser_interval,
  entertainment_delay_all_played_ms, entertainment_delay_many_stories_ms,
  entertainment_delay_moderate_stories_ms, entertainment_delay_few_stories_ms,
  silence_threshold_ms, bfs_check_interval_ms, bridge_check_interval_ms,
  min_bridge_duration_ms, max_transition_length,
  recovery_order, fallback_message, default_timezone
)
VALUES (
  NULL, NULL,
  15000, 5000, 4,
  5000, 12000, 8000, 5000,
  3500, 2000, 30000,
  20000, 200,
  '["check_alerts", "check_breaking_news", "check_scheduled_bulletins", "check_pending_rss", "check_cached_scripts", "activate_bridge"]'::jsonb,
  'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.',
  'Africa/Kinshasa'
);

-- Kinshasa-specific engine config
INSERT INTO engine_config (
  channel_id, station_id,
  fallback_message, default_timezone
)
SELECT
  'kinshasa-main',
  s.id,
  'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.',
  'Africa/Kinshasa'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Goma-specific engine config
INSERT INTO engine_config (
  channel_id, station_id,
  fallback_message, default_timezone
)
SELECT
  'goma-main',
  s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Lubumbashi-specific engine config
INSERT INTO engine_config (
  channel_id, station_id,
  fallback_message, default_timezone
)
SELECT
  'lubumbashi-main',
  s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- =============================================================================
-- 11. ENTERTAINMENT TRACKS
-- =============================================================================

-- Placeholder tracks — replace audio_url with actual Supabase Storage URLs
INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT
  'Kumbaya',
  'Local Artist',
  'chill',
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/kumbaya.mp3',
  180000,
  '["That was Kumbaya by Local Artist.", "Beautiful rendition of Kumbaya.", "Kumbaya, what a classic."] '::jsonb,
  '["Here''s something to brighten your day.", "Time for a musical break."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'kinshasa-main',
  s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;

INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT
  'Familia',
  'Local Artist',
  'upbeat',
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/familia.mp3',
  200000,
  '["That was Familia by Local Artist.", "Familia — bringing people together."] '::jsonb,
  '["Let''s keep the energy going.", "Here''s another great track."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'goma-main',
  s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;

INSERT INTO entertainment_tracks (
  title, artist, mood, audio_url, duration_ms,
  commentary_templates, intro_before_track,
  segment_open, segment_close,
  channel_id, station_id
)
SELECT
  'Kumbaya Encore',
  'Local Artist',
  'chill',
  'https://your-project.supabase.co/storage/v1/object/public/radio-assets/kumbaya-encore.mp3',
  195000,
  '["Kumbaya Encore — what a way to end the break."] '::jsonb,
  '["One more for the road.", "Here''s a final treat."] '::jsonb,
  'Time for some entertainment!',
  'That''s all for this entertainment break.',
  'lubumbashi-main',
  s.id
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 12. PROVIDER TAXONOMY — LezoTraffic Incident Types
-- =============================================================================

INSERT INTO provider_taxonomy (taxonomy_type, provider, source_key, target_value)
VALUES
  -- Incident types
  ('incident_type', 'lezotraffic', 'accident_grave', '{"category":"traffic","subcategory":"accident","priority":2}'::jsonb),
  ('incident_type', 'lezotraffic', 'accident', '{"category":"traffic","subcategory":"accident","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'embouteillage', '{"category":"traffic","subcategory":"congestion","priority":5}'::jsonb),
  ('incident_type', 'lezotraffic', 'travaux_routiers', '{"category":"traffic","subcategory":"roadwork","priority":6}'::jsonb),
  ('incident_type', 'lezotraffic', 'inondation', '{"category":"weather","subcategory":"flood","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'route_bloquee', '{"category":"traffic","subcategory":"closure","priority":3}'::jsonb),
  ('incident_type', 'lezotraffic', 'manifestation', '{"category":"traffic","subcategory":"protest","priority":4}'::jsonb),
  ('incident_type', 'lezotraffic', 'panne_electricite', '{"category":"emergency","subcategory":"power_outage","priority":4}'::jsonb),
  ('incident_type', 'lezotraffic', 'incendie', '{"category":"emergency","subcategory":"fire","priority":2}'::jsonb),
  ('incident_type', 'lezotraffic', 'inondation_route', '{"category":"traffic","subcategory":"flood","priority":3}'::jsonb),

  -- Severity maps
  ('severity_map', 'lezotraffic', 'high', '{"priority":2}'::jsonb),
  ('severity_map', 'lezotraffic', 'medium', '{"priority":5}'::jsonb),
  ('severity_map', 'lezotraffic', 'low', '{"priority":8}'::jsonb),

  -- Region-country maps
  ('region_country_map', 'lezotraffic', 'kinshasa', '{"country_code":"CD","province":"Kinshasa"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'goma', '{"country_code":"CD","province":"Nord-Kivu"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'lubumbashi', '{"country_code":"CD","province":"Haut-Katanga"}'::jsonb),

  -- City keywords
  ('city_keywords', 'lezotraffic', 'kinshasa', '{"city":"Kinshasa","keywords":["kinshasa","n''dolo","ngaliema","lemba","matete"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'goma', '{"city":"Goma","keywords":["goma","sake","minova"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'lubumbashi', '{"city":"Lubumbashi","keywords":["lubumbashi","kampemba","kasanja"]}'::jsonb)

ON CONFLICT (taxonomy_type, provider, source_key) DO NOTHING;

-- =============================================================================
-- 13. NORMALIZER CONFIG
-- =============================================================================

INSERT INTO normalizer_config (provider, config_key, config_value, description)
VALUES
  -- LezoTraffic config
  ('lezotraffic', 'summary_max_length', '500', 'Max characters for summary field'),
  ('lezotraffic', 'description_max_length', '2000', 'Max characters for description field'),
  ('lezotraffic', 'default_country', '"CD"', 'Default country code'),
  ('lezotraffic', 'api_version', '"v1"', 'API version tag'),
  ('lezotraffic', 'raw_payload_version', '1', 'Raw payload schema version'),
  ('lezotraffic', 'default_page_limit', '50', 'Default page size'),
  ('lezotraffic', 'geo_page_limit', '100', 'Page size for geographic endpoints'),
  ('lezotraffic', 'stats_days', '14', 'Statistics time range'),
  ('lezotraffic', 'timeout_ms', '10000', 'API request timeout'),
  ('lezotraffic', 'max_retries', '3', 'Max retries'),
  ('lezotraffic', 'retry_delay_ms', '1000', 'Base retry delay'),
  ('lezotraffic', 'endpoint_unavailable_retry_ms', '86400000', 'Retry window for 404'),
  ('lezotraffic', 'rate_limit_default_retry_s', '60', 'Default rate-limit retry-after'),
  ('lezotraffic', 'refresh_buffer_ms', '300000', 'Token refresh buffer'),
  ('lezotraffic', 'default_token_expiry_s', '900', 'Fallback token expiry'),
  ('lezotraffic', 'refresh_token_expiry_s', '3600', 'Refresh token expiry fallback'),
  ('lezotraffic', 'retryable_http_statuses', '[429,500,502,503,504]', 'HTTP statuses that trigger retry'),
  ('lezotraffic', 'non_retryable_http_statuses', '[400,403,404]', 'HTTP statuses that do not trigger retry'),
  ('lezotraffic', 'retention_incidents_hours', '72', 'Incident data retention'),
  ('lezotraffic', 'retention_accidents_hours', '72', 'Accident data retention'),
  ('lezotraffic', 'retention_routes_hours', '168', 'Route data retention (7 days)'),
  ('lezotraffic', 'retention_transports_hours', '168', 'Transport data retention (7 days)'),

  -- RSS config
  ('rss', 'default_language', '"fr"', 'Default RSS language'),
  ('rss', 'min_title_length', '5', 'Minimum title length'),
  ('rss', 'english_detection_threshold', '0.15', 'English content detection threshold'),
  ('rss', 'english_min_word_count', '5', 'Word count before English check'),
  ('rss', 'summary_max_length', '500', 'RSS summary truncation'),
  ('rss', 'description_max_length', '2000', 'RSS description truncation'),
  ('rss', 'default_title', '"Untitled"', 'Fallback title'),

  -- Global config
  ('global', 'title_max_length', '500', 'Max title length validation'),
  ('global', 'priority_min', '1', 'Min priority value'),
  ('global', 'priority_max', '10', 'Max priority value'),
  ('global', 'hash_length', '64', 'Expected SHA-256 hex length'),
  ('global', 'valid_categories', '["traffic","emergency","news","weather","security","event","agriculture","sports","tourism","transport","government","health","geo"]', 'Valid event categories'),
  ('global', 'valid_statuses', '["active","resolved","archived"]', 'Valid event statuses'),
  ('global', 'known_providers', '["lezotraffic","rss"]', 'Registered provider IDs'),
  ('global', 'priority_level_thresholds', '{"critical":2,"high":4,"medium":6}', 'Priority-to-level mapping'),
  ('global', 'template_summary_max_length', '200', 'Max summary in filled template')

ON CONFLICT (provider, config_key) DO NOTHING;

-- =============================================================================
-- Done! All DRC seed data inserted.
-- =============================================================================
-- To verify:
--   SELECT channel_id, name, language FROM station_channels WHERE is_active = true;
--   SELECT template_type, language, count(*) FROM content_templates GROUP BY template_type, language;
--   SELECT channel_id, intro_url IS NOT NULL as has_intro FROM audio_config;
-- =============================================================================
