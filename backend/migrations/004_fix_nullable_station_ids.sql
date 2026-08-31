-- Fix nullable station_id columns to prevent type mismatch errors
-- These columns need to accept NULL values when stationId is not available

-- Fix queue_played_items.station_id to allow NULL
ALTER TABLE queue_played_items ALTER COLUMN station_id DROP NOT NULL;

-- Fix playback_history.station_id to allow NULL  
ALTER TABLE playback_history ALTER COLUMN station_id DROP NOT NULL;
