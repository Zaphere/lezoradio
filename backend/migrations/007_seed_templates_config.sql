-- =============================================================================
-- Migration 007: Seed Data — Content Templates, Audio Config, Engine Config
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
  ('transition', 'fr', 'Ne bougez pas, d''autres histoires arrivent.', true)
ON CONFLICT DO NOTHING;

-- Lingala transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'ln', 'Toki ekoya mo nzete ndakisa.', true),
  ('transition', 'ln', 'Pasieti, toki ekoya na biloko ebengi.', true),
  ('transition', 'ln', 'Tina ekoya na updates nyingi.', true),
  ('transition', 'ln', 'Kala na ye, toki ekoya na biloko mingi.', true)
ON CONFLICT DO NOTHING;

-- Swahili transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'sw', 'Endelea kusikiliza, habari zaidi zinakuja.', true),
  ('transition', 'sw', 'Umbeya, habari za hivi karibuni zinafuata.', true),
  ('transition', 'sw', 'Tunaendelea na habari zaidi baada ya hapo.', true),
  ('transition', 'sw', 'Usiende popote, kuna hadithi zaidi.', true)
ON CONFLICT DO NOTHING;

-- English transitions
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('transition', 'en', 'Next update coming your way…', true),
  ('transition', 'en', 'In regional news today…', true),
  ('transition', 'en', 'Moving to traffic updates…', true),
  ('transition', 'en', 'Here''s what''s happening now…', true),
  ('transition', 'en', 'Now for the latest reports…', true),
  ('transition', 'en', 'Continuing with today''s stories…', true),
  ('transition', 'en', 'And now from our news desk…', true),
  ('transition', 'en', 'Let''s look at what else is making headlines…', true)
ON CONFLICT DO NOTHING;

-- French station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'fr', 'Vous écoutez {station}. Restez à l''écoute.', true),
  ('station_id', 'fr', 'Ceci est {station}, votre source d''information.', true),
  ('station_id', 'fr', '{station} — l''information en continu.', true)
ON CONFLICT DO NOTHING;

-- Lingala station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'ln', 'Nasikisi {station}. Kala na ye.', true),
  ('station_id', 'ln', 'Ye {station}, oyo ezali source ya information.', true),
  ('station_id', 'ln', '{station} — information ya kowaka.', true)
ON CONFLICT DO NOTHING;

-- Swahili station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'sw', 'Unasikiliza {station}. Endelea kusikiliza.', true),
  ('station_id', 'sw', 'Hii ni {station}, chanzo chako cha habari.', true),
  ('station_id', 'sw', '{station} — habari za wakati wote.', true)
ON CONFLICT DO NOTHING;

-- English station IDs
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('station_id', 'en', 'You''re listening to {station}. Stay tuned.', true),
  ('station_id', 'en', 'This is {station}. We''ll be right back with more.', true),
  ('station_id', 'en', 'You''re with {station}. More news coming up.', true),
  ('station_id', 'en', 'Live from {station}. We continue in a moment.', true)
ON CONFLICT DO NOTHING;

-- Fallback messages
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('fallback_message', 'fr', 'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.', true),
  ('fallback_message', 'ln', 'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.', true),
  ('fallback_message', 'sw', 'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.', true),
  ('fallback_message', 'en', 'No recent news feeds detected. Please stand by for the next update.', true)
ON CONFLICT DO NOTHING;

-- Time announcements
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('time_announcement', 'fr', 'Il est maintenant {time}.', true),
  ('time_announcement', 'ln', 'Sɛsɛ ezali {time}.', true),
  ('time_announcement', 'sw', 'Sasa ni {time}.', true),
  ('time_announcement', 'en', 'It''s {time}. You''re listening to {station}.', true)
ON CONFLICT DO NOTHING;

-- Coming up teasers
INSERT INTO content_templates (template_type, language, text_content, is_active)
VALUES
  ('coming_up_teaser', 'fr', 'À venir, plus d''actualités de notre rédaction.', true),
  ('coming_up_teaser', 'fr', 'Restez tuned, nous avons d''autres histoires pour vous.', true),
  ('coming_up_teaser', 'ln', 'Tokina ekoya, biloko ebengi ya information.', true),
  ('coming_up_teaser', 'sw', 'Baada ya hapo, habari zaidi kutoka ofisi yetu.', true),
  ('coming_up_teaser', 'en', 'Coming up, more stories from our news desk.', true),
  ('coming_up_teaser', 'en', 'Still to come, the latest developments.', true),
  ('coming_up_teaser', 'en', 'Up next, more updates for you.', true)
ON CONFLICT DO NOTHING;

-- Audio config (global defaults)
INSERT INTO audio_config (
  channel_id, station_id,
  intro_url, background_url,
  background_url_is_random,
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
  '/api/content/storage?bucket=introaudio&file=LezzoTrafficappIntro.mp3',
  '/api/content/storage?bucket=introaudio&file=backgroundmusic.mp3',
  true,
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
)
ON CONFLICT DO NOTHING;

-- Engine config (global defaults)
INSERT INTO engine_config (
  channel_id, station_id,
  poll_interval_ms, alert_display_duration_ms, teaser_interval,
  entertainment_delay_all_played_ms, entertainment_delay_many_stories_ms,
  entertainment_delay_moderate_stories_ms, entertainment_delay_few_stories_ms,
  silence_threshold_ms, bfs_check_interval_ms, bridge_check_interval_ms,
  min_bridge_duration_ms, max_transition_length,
  recovery_order, fallback_message, default_timezone,
  station_id_interval_min_ms, station_id_interval_max_ms
)
VALUES (
  NULL, NULL,
  15000, 5000, 4,
  5000, 12000, 8000, 5000,
  3500, 2000, 30000,
  20000, 200,
  '["check_alerts", "check_breaking_news", "check_scheduled_bulletins", "check_pending_rss", "check_cached_scripts", "activate_bridge"]'::jsonb,
  'Pas d''actualités récentes détectées. Veuillez patienter pour la prochaine mise à jour.',
  'Africa/Kinshasa',
  1200000, 1800000
)
ON CONFLICT DO NOTHING;

-- Kinshasa-specific engine config
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'kinshasa-main', s.id,
  'Tapɛni ya biloko ya sɛsɛ. Litika ndakisa ya mpita.',
  'Africa/Kinshasa'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Goma-specific engine config
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'goma-main', s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;

-- Lubumbashi-specific engine config
INSERT INTO engine_config (channel_id, station_id, fallback_message, default_timezone)
SELECT 'lubumbashi-main', s.id,
  'Hakuna habari za hivi karibuni. Tafadhali subiri kwa sasisho lijalo.',
  'Africa/Maputo'
FROM stations s WHERE s.country_code = 'CD' AND s.name = 'DR Congo'
ON CONFLICT (channel_id, station_id) DO NOTHING;
