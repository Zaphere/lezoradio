-- AARN: Stations, Content Sources, and Station-Source join table
-- Run this migration in the Supabase SQL editor.

-- Stations table
CREATE TABLE stations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  country    TEXT NOT NULL,
  region     TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  voice      TEXT,
  enabled    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Content sources table
CREATE TABLE content_sources (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'rss',
  category      TEXT NOT NULL DEFAULT 'news',
  priority      INT NOT NULL DEFAULT 5,
  enabled       BOOLEAN DEFAULT true,
  health        TEXT DEFAULT 'unknown',
  last_checked  TIMESTAMPTZ,
  last_success  TIMESTAMPTZ,
  last_failure  TIMESTAMPTZ,
  article_count INT DEFAULT 0,
  response_time INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Station-Source join table (M:N relationship)
CREATE TABLE station_sources (
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  source_id  UUID REFERENCES content_sources(id) ON DELETE CASCADE,
  priority   INT NOT NULL DEFAULT 5,
  enabled    BOOLEAN DEFAULT true,
  PRIMARY KEY (station_id, source_id)
);

-- Seed: Eswatini Live station
INSERT INTO stations (name, country, region, language, voice)
VALUES ('Eswatini Live', 'eswatini', 'Southern Africa', 'en', 'Sipho');

-- Seed: 5 recommended content sources
INSERT INTO content_sources (name, url, type, category, priority)
VALUES
  ('BBC Africa',       'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'rss', 'news',       1),
  ('Africanews',       'https://www.africanews.com/feed/rss',               'rss', 'news',       2),
  ('Guardian Africa',  'https://www.theguardian.com/world/africa/rss', 'rss', 'news', 3),
  ('Africa.com',       'https://africa.com/feed',                           'rss', 'news',       4),
  ('How We Made It',   'https://www.howwemadeitinafrica.com/feed/',         'rss', 'agriculture',5);

-- Link all 5 sources to Eswatini Live
INSERT INTO station_sources (station_id, source_id, priority)
SELECT
  (SELECT id FROM stations WHERE name = 'Eswatini Live'),
  id,
  priority
FROM content_sources;
