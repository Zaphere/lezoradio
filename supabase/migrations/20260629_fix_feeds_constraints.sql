-- Fix feeds table check constraints to allow broader values
-- Run this in Supabase SQL editor

-- Drop existing check constraints if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feeds_type_check') THEN
    ALTER TABLE feeds DROP CONSTRAINT feeds_type_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feeds_region_check') THEN
    ALTER TABLE feeds DROP CONSTRAINT feeds_region_check;
  END IF;
END $$;

-- Add new, more permissive check constraints
ALTER TABLE feeds ADD CONSTRAINT feeds_type_check 
  CHECK (type IN ('rss', 'atom', 'json', 'xml'));

ALTER TABLE feeds ADD CONSTRAINT feeds_region_check 
  CHECK (region IN (
    'eswatini', 'south-africa', 'congo', 'traffic', 'tech',
    'southern-africa', 'central-africa', 'east-africa', 'north-africa',
    'global', 'local', 'regional', 'unknown'
  ));
