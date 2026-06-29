-- Fix broken RSS URLs and relink content sources to all active stations
-- Run after create_stations_sources.sql and phase1_station_extend.sql

-- Replace dead AllAfrica URL with Guardian Africa (verified working)
UPDATE content_sources
SET url = 'https://www.theguardian.com/world/africa/rss',
    updated_at = now()
WHERE name = 'AllAfrica'
   OR url = 'https://allafrica.com/tools/headlines/rss/latest/headlines.xml';

-- Link every active content source to every active station
INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE s.is_active = true
  AND cs.enabled = true
ON CONFLICT (station_id, source_id) DO NOTHING;
