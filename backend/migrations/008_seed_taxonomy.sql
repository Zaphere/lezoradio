-- =============================================================================
-- Migration 008: Seed Data — Provider Taxonomy, Normalizer Config, Prompts
-- =============================================================================

-- Provider taxonomy (LezoTraffic)
INSERT INTO provider_taxonomy (taxonomy_type, provider, source_key, target_value)
VALUES
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
  ('severity_map', 'lezotraffic', 'high', '{"priority":2}'::jsonb),
  ('severity_map', 'lezotraffic', 'medium', '{"priority":5}'::jsonb),
  ('severity_map', 'lezotraffic', 'low', '{"priority":8}'::jsonb),
  ('region_country_map', 'lezotraffic', 'kinshasa', '{"country_code":"CD","province":"Kinshasa"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'goma', '{"country_code":"CD","province":"Nord-Kivu"}'::jsonb),
  ('region_country_map', 'lezotraffic', 'lubumbashi', '{"country_code":"CD","province":"Haut-Katanga"}'::jsonb),
  ('city_keywords', 'lezotraffic', 'kinshasa', '{"city":"Kinshasa","keywords":["kinshasa","n''dolo","ngaliema","lemba","matete"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'goma', '{"city":"Goma","keywords":["goma","sake","minova"]}'::jsonb),
  ('city_keywords', 'lezotraffic', 'lubumbashi', '{"city":"Lubumbashi","keywords":["lubumbashi","kampemba","kasanja"]}'::jsonb)
ON CONFLICT (taxonomy_type, provider, source_key) DO NOTHING;

-- Normalizer config
INSERT INTO normalizer_config (provider, config_key, config_value, description)
VALUES
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
  ('rss', 'default_language', '"fr"', 'Default RSS language'),
  ('rss', 'min_title_length', '5', 'Minimum title length'),
  ('rss', 'english_detection_threshold', '0.15', 'English content detection threshold'),
  ('rss', 'english_min_word_count', '5', 'Word count before English check'),
  ('rss', 'summary_max_length', '500', 'RSS summary truncation'),
  ('rss', 'description_max_length', '2000', 'RSS description truncation'),
  ('rss', 'default_title', '"Untitled"', 'Fallback title'),
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

-- Prompt templates (DRC news)
INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT
  s.id, 'news', 'fr',
  'Tu es un présentateur de radio professionnel pour {{station_name}} à {{city}}, {{country}}. Rédige un bulletin d''actualités concis et engageant basé sur les informations suivantes : {{content}} Style : {{style}} Durée souhaitée : {{duration_seconds}} secondes. Inclus une introduction et une conclusion appropriées.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country_code = 'CD'
ON CONFLICT DO NOTHING;

INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT
  s.id, 'news', 'sw',
  'Ni mwakilishi wa taarifa za redio kwa {{station_name}} katika {{city}}, {{country}}. Andika taarifa fupi na ya kupendeza kulingana na taarifa zifuatazo : {{content}} Mtindo : {{style}} Muda unaopendekezwa : {{duration_seconds}} sekunde. Jumuisha utangulizi na hitimisho lijalo.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country_code = 'CD'
ON CONFLICT DO NOTHING;
