-- =============================================================================
-- Migration 005: Seed Data — Stations, Content Sources, Provider Configs
-- =============================================================================

-- Stations — all 22 African countries
INSERT INTO stations (name, country, country_code, region, language, priority, is_active, timezone)
VALUES
  ('South Africa', 'South Africa', 'ZA', 'Southern Africa', 'en', 1, true, 'Africa/Johannesburg'),
  ('Zambia', 'Zambia', 'ZM', 'Southern Africa', 'en', 2, true, 'Africa/Lusaka'),
  ('Malawi', 'Malawi', 'MW', 'Southern Africa', 'en', 2, true, 'Africa/Blantyre'),
  ('Botswana', 'Botswana', 'BW', 'Southern Africa', 'en', 2, true, 'Africa/Gaborone'),
  ('Namibia', 'Namibia', 'NA', 'Southern Africa', 'en', 2, true, 'Africa/Windhoek'),
  ('Mozambique', 'Mozambique', 'MZ', 'Southern Africa', 'en', 2, true, 'Africa/Maputo'),
  ('DR Congo', 'Democratic Republic of Congo', 'CD', 'Central Africa', 'en', 1, true, 'Africa/Kinshasa'),
  ('Congo', 'Republic of Congo', 'CG', 'Central Africa', 'en', 2, true, 'Africa/Brazzaville'),
  ('Cameroon', 'Cameroon', 'CM', 'Central Africa', 'en', 1, true, 'Africa/Douala'),
  ('Gabon', 'Gabon', 'GA', 'Central Africa', 'en', 2, true, 'Africa/Libreville'),
  ('Central African Republic', 'Central African Republic', 'CF', 'Central Africa', 'en', 2, true, 'Africa/Bangui'),
  ('Chad', 'Chad', 'TD', 'Central Africa', 'en', 2, true, 'Africa/Ndjamena'),
  ('Tanzania', 'Tanzania', 'TZ', 'East Africa', 'en', 1, true, 'Africa/Dar_es_Salaam'),
  ('Kenya', 'Kenya', 'KE', 'East Africa', 'en', 1, true, 'Africa/Nairobi'),
  ('Uganda', 'Uganda', 'UG', 'East Africa', 'en', 1, true, 'Africa/Kampala'),
  ('Rwanda', 'Rwanda', 'RW', 'East Africa', 'en', 2, true, 'Africa/Kigali'),
  ('Burundi', 'Burundi', 'BI', 'East Africa', 'en', 2, true, 'Africa/Bujumbura'),
  ('South Sudan', 'South Sudan', 'SS', 'East Africa', 'en', 2, true, 'Africa/Juba'),
  ('Egypt', 'Egypt', 'EG', 'North Africa', 'en', 3, true, 'Africa/Cairo'),
  ('Algeria', 'Algeria', 'DZ', 'North Africa', 'en', 3, true, 'Africa/Algiers'),
  ('Morocco', 'Morocco', 'MA', 'North Africa', 'en', 3, true, 'Africa/Casablanca'),
  ('Tunisia', 'Tunisia', 'TN', 'North Africa', 'en', 3, true, 'Africa/Tunis')
ON CONFLICT DO NOTHING;

-- Content sources
INSERT INTO content_sources (name, url, type, category, priority)
VALUES
  ('BBC Africa', 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'rss', 'news', 1),
  ('Africanews', 'https://www.africanews.com/feed/rss', 'rss', 'news', 2),
  ('Guardian Africa', 'https://www.theguardian.com/world/africa/rss', 'rss', 'news', 3),
  ('Africa.com', 'https://africa.com/feed', 'rss', 'news', 4),
  ('How We Made It', 'https://www.howwemadeitinafrica.com/feed/', 'rss', 'agriculture', 5),
  ('Eswatini Headlines', 'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf', 'rss', 'local', 1),
  ('IOL South Africa', 'https://www.iol.co.za/rss', 'rss', 'regional', 2),
  ('Radio Okapi', 'https://www.radiookapi.net/rss.xml', 'rss', 'regional', 3),
  ('Africa Traffic News', 'https://news.google.com/rss/search?q=traffic+Africa&hl=en-US&gl=US&ceid=US:en', 'rss', 'traffic', 4),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'rss', 'tech', 5)
ON CONFLICT DO NOTHING;

-- Link sources to stations
INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE cs.name IN ('BBC Africa', 'Africanews', 'Guardian Africa', 'Africa.com', 'How We Made It')
ON CONFLICT (station_id, source_id) DO NOTHING;

-- Provider configs
INSERT INTO provider_configs (provider, enabled, config, priority, sync_schedule)
VALUES
  ('rss', true, '{"feed_count": 0}', 5, '*/15 * * * *'),
  ('lezotraffic', true, '{}', 1, '*/1 * * * *')
ON CONFLICT (provider) DO NOTHING;

-- Feature flags
INSERT INTO feature_flags (id, name, description, enabled, rollout_percentage)
VALUES
  ('v2-provider-engine', 'V2 Provider Engine', 'Use the new provider engine for content ingestion', true, 100),
  ('v2-queue-engine', 'V2 Queue Engine', 'Use the new queue engine for broadcast queue management', true, 100),
  ('v2-broadcast-engine', 'V2 Broadcast Engine', 'Use the new broadcast engine for playback control', true, 100),
  ('v2-voice-engine', 'V2 Voice Engine', 'Use the new voice engine for TTS generation', true, 100),
  ('v2-audio-engine', 'V2 Audio Engine', 'Use the new audio engine for mixing and playback', true, 100),
  ('v2-music-engine', 'V2 Music Engine', 'Use the new music engine for playlist management', true, 100),
  ('v2-transition-engine', 'V2 Transition Engine', 'Use the new transition engine for audio transitions', true, 100),
  ('v2-ai-director', 'V2 AI Director', 'Use the new AI director for script generation', true, 100),
  ('v2-language-engine', 'V2 Language Engine', 'Use the new language engine for translation and detection', true, 100),
  ('v2-station-engine', 'V2 Station Engine', 'Use the new station engine for configuration management', true, 100),
  ('v2-scheduling-engine', 'V2 Scheduling Engine', 'Use the new scheduling engine for event management', true, 100),
  ('v2-alert-engine', 'V2 Alert Engine', 'Use the new alert engine for emergency and traffic alerts', true, 100),
  ('v2-analytics-engine', 'V2 Analytics Engine', 'Use the new analytics engine for metrics collection', true, 100)
ON CONFLICT (id) DO NOTHING;
