-- Regional RSS sources + station-specific links
-- Run after 20260629_fix_rss_sources.sql

INSERT INTO content_sources (name, url, type, category, priority)
SELECT v.name, v.url, v.type, v.category, v.priority
FROM (VALUES
  ('Eswatini Headlines', 'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf', 'rss', 'local', 1),
  ('IOL South Africa', 'https://www.iol.co.za/rss', 'rss', 'regional', 2),
  ('Radio Okapi', 'https://www.radiookapi.net/rss.xml', 'rss', 'regional', 3),
  ('Africa Traffic News', 'https://news.google.com/rss/search?q=traffic+Africa&hl=en-US&gl=US&ceid=US:en', 'rss', 'traffic', 4),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'rss', 'tech', 5)
) AS v(name, url, type, category, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM content_sources cs WHERE cs.url = v.url
);

UPDATE content_sources
SET name = 'Guardian Africa',
    url = 'https://www.theguardian.com/world/africa/rss',
    updated_at = now()
WHERE name = 'AllAfrica'
   OR url = 'https://allafrica.com/tools/headlines/rss/latest/headlines.xml';

INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
JOIN content_sources cs ON cs.name = 'IOL South Africa'
WHERE s.name = 'South Africa'
ON CONFLICT (station_id, source_id) DO NOTHING;

INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
JOIN content_sources cs ON cs.name = 'Radio Okapi'
WHERE s.name IN ('DR Congo', 'Congo')
ON CONFLICT (station_id, source_id) DO NOTHING;

INSERT INTO station_sources (station_id, source_id, priority, enabled)
SELECT s.id, cs.id, cs.priority, true
FROM stations s
CROSS JOIN content_sources cs
WHERE s.is_active = true
  AND cs.name IN ('BBC Africa', 'Africanews', 'Guardian Africa', 'Africa.com', 'How We Made It')
ON CONFLICT (station_id, source_id) DO NOTHING;
