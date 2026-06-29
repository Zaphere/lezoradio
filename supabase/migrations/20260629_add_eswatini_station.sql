-- Add Eswatini as a Southern Africa station
-- Run after 20260629_regional_rss_sources.sql

INSERT INTO stations (name, country, country_code, region, language, priority, is_active)
SELECT 'Eswatini', 'Eswatini', 'SZ', 'Southern Africa', 'en', 2, true
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE name = 'Eswatini');

-- Link Eswatini Headlines content source to the Eswatini station
INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
JOIN content_sources cs ON cs.name = 'Eswatini Headlines'
WHERE s.name = 'Eswatini'
ON CONFLICT (station_id, source_id) DO NOTHING;

-- Link global sources to the Eswatini station
INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE s.name = 'Eswatini'
  AND cs.name IN ('BBC Africa', 'Africanews', 'Guardian Africa', 'Africa.com', 'How We Made It')
ON CONFLICT (station_id, source_id) DO NOTHING;
