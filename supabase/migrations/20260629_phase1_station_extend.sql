-- Phase 1: Extend stations table for config-driven station registry
-- Run this migration AFTER 20260629_create_stations_sources.sql

-- Add new columns to stations table
ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS priority INT DEFAULT 1;

-- Rename enabled to is_active (skip if already renamed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'enabled') THEN
    ALTER TABLE stations RENAME COLUMN enabled TO is_active;
  END IF;
END $$;

-- Remove Eswatini station (cascade deletes station_sources links)
DELETE FROM stations WHERE name = 'Eswatini Live';

-- Insert new country stations (20 countries across Africa)
INSERT INTO stations (name, country, country_code, region, language, priority, is_active)
VALUES
  -- Southern Africa
  ('South Africa', 'South Africa', 'ZA', 'Southern Africa', 'en', 1, true),
  ('Zambia', 'Zambia', 'ZM', 'Southern Africa', 'en', 2, true),
  ('Malawi', 'Malawi', 'MW', 'Southern Africa', 'en', 2, true),
  ('Botswana', 'Botswana', 'BW', 'Southern Africa', 'en', 2, true),
  ('Namibia', 'Namibia', 'NA', 'Southern Africa', 'en', 2, true),
  ('Mozambique', 'Mozambique', 'MZ', 'Southern Africa', 'en', 2, true),
  
  -- Central Africa
  ('DR Congo', 'Democratic Republic of Congo', 'CD', 'Central Africa', 'en', 1, true),
  ('Congo', 'Republic of Congo', 'CG', 'Central Africa', 'en', 2, true),
  ('Cameroon', 'Cameroon', 'CM', 'Central Africa', 'en', 1, true),
  ('Gabon', 'Gabon', 'GA', 'Central Africa', 'en', 2, true),
  ('Central African Republic', 'Central African Republic', 'CF', 'Central Africa', 'en', 2, true),
  ('Chad', 'Chad', 'TD', 'Central Africa', 'en', 2, true),
  
  -- East Africa
  ('Tanzania', 'Tanzania', 'TZ', 'East Africa', 'en', 1, true),
  ('Kenya', 'Kenya', 'KE', 'East Africa', 'en', 1, true),
  ('Uganda', 'Uganda', 'UG', 'East Africa', 'en', 1, true),
  ('Rwanda', 'Rwanda', 'RW', 'East Africa', 'en', 2, true),
  ('Burundi', 'Burundi', 'BI', 'East Africa', 'en', 2, true),
  ('South Sudan', 'South Sudan', 'SS', 'East Africa', 'en', 2, true),
  
  -- North Africa (future expansion)
  ('Egypt', 'Egypt', 'EG', 'North Africa', 'en', 3, true),
  ('Algeria', 'Algeria', 'DZ', 'North Africa', 'en', 3, true),
  ('Morocco', 'Morocco', 'MA', 'North Africa', 'en', 3, true),
  ('Tunisia', 'Tunisia', 'TN', 'North Africa', 'en', 3, true);
