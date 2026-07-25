-- Seed music_tracks with real tracks from Music and introaudio buckets
-- Run this in Supabase SQL editor

INSERT INTO music_tracks (title, artist, album, genre, language, duration_ms, mood, audio_url, is_available)
VALUES
  ('Africa Rise', 'DJ Sparks', 'Radio Lezo', 'afrobeats', 'fr', 210000, 'upbeat',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/AfricaRise.mp3', true),
  ('DJ Sparks Letto', 'DJ Sparks', 'Radio Lezo', 'afrobeats', 'fr', 240000, 'chill',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/DJ%20Sparks%20Letto.mp3', true),
  ('The Way Around This World (Kumbaya Groove)', 'Kumbaya', 'Radio Lezo', 'afrobeats', 'fr', 225000, 'chill',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/The%20Way%20Around%20This%20World%20(Kumbaya%20Groove).mp3', true),
  ('Background Music', 'Radio Lezo', 'Radio Lezo', 'ambient', 'fr', 300000, 'chill',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3', true),
  ('Back Music 2', 'Radio Lezo', 'Radio Lezo', 'ambient', 'fr', 300000, 'chill',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3', true),
  ('Back Music 3', 'Radio Lezo', 'Radio Lezo', 'ambient', 'fr', 300000, 'chill',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3', true),
  ('Global News Theme', 'Radio Lezo', 'Radio Lezo', 'news', 'fr', 300000, 'dramatic',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Globalnews.mp3', true)
ON CONFLICT DO NOTHING;
