-- =============================================================================
-- BACKGROUND MUSIC ROTATION SQL
-- =============================================================================
-- This script allows you to switch between your 3 background music files
-- Run the appropriate UPDATE statement to change the active background music
-- =============================================================================

-- Option 1: Use backgroundmusic.mp3
UPDATE audio_config 
SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3'
WHERE channel_id IS NULL;

-- Option 2: Use Backmusic2.mp3
-- UPDATE audio_config 
-- SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3'
-- WHERE channel_id IS NULL;

-- Option 3: Use Backmusic3.mp3
-- UPDATE audio_config 
-- SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3'
-- WHERE channel_id IS NULL;

-- =============================================================================
-- RANDOM ROTATION SETUP (Optional)
-- =============================================================================
-- If you want the background music to rotate randomly between the 3 tracks,
-- you can create a function that randomly selects one:

CREATE OR REPLACE FUNCTION get_random_background_music()
RETURNS TEXT AS $$
BEGIN
  RETURN ARRAY[
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3',
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3',
    'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3'
  ][floor(random() * 3 + 1)];
END;
$$ LANGUAGE plpgsql;

-- Then update to use a random track:
-- UPDATE audio_config 
-- SET background_url = get_random_background_music()
-- WHERE channel_id IS NULL;

-- =============================================================================
-- PER-CHANNEL BACKGROUND MUSIC (Optional)
-- =============================================================================
-- If you want different channels to use different background music:

-- Kinshasa channel uses backgroundmusic.mp3
UPDATE audio_config 
SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3'
WHERE channel_id = 'kinshasa-main';

-- Goma channel uses Backmusic2.mp3
-- UPDATE audio_config 
-- SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3'
-- WHERE channel_id = 'goma-main';

-- Lubumbashi channel uses Backmusic3.mp3
-- UPDATE audio_config 
-- SET background_url = 'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3'
-- WHERE channel_id = 'lubumbashi-main';

-- =============================================================================
-- VERIFY CURRENT BACKGROUND MUSIC
-- =============================================================================
SELECT channel_id, background_url FROM audio_config;
