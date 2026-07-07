-- AARN Enhancement: Add timezone support to stations for Global Time System
-- Run this migration in the Supabase SQL editor.

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Set default timezones for existing stations based on country
UPDATE stations SET timezone = 'Africa/Johannesburg' WHERE country_code = 'ZA' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Lusaka'       WHERE country_code = 'ZM' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Blantyre'      WHERE country_code = 'MW' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Gaborone'      WHERE country_code = 'BW' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Windhoek'      WHERE country_code = 'NA' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Maputo'        WHERE country_code = 'MZ' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Kinshasa'      WHERE country_code = 'CD' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Brazzaville'   WHERE country_code = 'CG' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Douala'        WHERE country_code = 'CM' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Libreville'    WHERE country_code = 'GA' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Bangui'        WHERE country_code = 'CF' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Ndjamena'      WHERE country_code = 'TD' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Dar_es_Salaam' WHERE country_code = 'TZ' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Nairobi'       WHERE country_code = 'KE' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Kampala'       WHERE country_code = 'UG' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Kigali'        WHERE country_code = 'RW' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Bujumbura'     WHERE country_code = 'BI' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Juba'          WHERE country_code = 'SS' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Cairo'         WHERE country_code = 'EG' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Algiers'       WHERE country_code = 'DZ' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Casablanca'    WHERE country_code = 'MA' AND timezone IS NULL;
UPDATE stations SET timezone = 'Africa/Tunis'         WHERE country_code = 'TN' AND timezone IS NULL;

-- Create a bulletin_schedule table for extensible bulletin configuration
CREATE TABLE IF NOT EXISTS bulletin_schedule (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'french_global',
  language   TEXT NOT NULL DEFAULT 'fr',
  hour       INT NOT NULL,
  minute     INT NOT NULL DEFAULT 0,
  duration_s INT NOT NULL DEFAULT 300,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the French global bulletin schedule
INSERT INTO bulletin_schedule (name, type, language, hour, minute, duration_s)
VALUES
  ('French Global Bulletin — Morning',  'french_global', 'fr', 9,  0, 300),
  ('French Global Bulletin — Midday',   'french_global', 'fr', 12, 0, 300),
  ('French Global Bulletin — Afternoon', 'french_global', 'fr', 15, 0, 300),
  ('French Global Bulletin — Evening',  'french_global', 'fr', 18, 0, 300),
  ('French Global Bulletin — Night',    'french_global', 'fr', 21, 0, 300);
