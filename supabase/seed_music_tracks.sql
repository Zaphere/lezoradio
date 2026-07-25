-- Seed music_tracks with real tracks from Music and introaudio buckets
-- Run this in Supabase SQL editor

INSERT INTO music_tracks (title, artist, album, audio_url, duration_ms, mood)
VALUES
  ('Africa Rise', 'DJ Sparks', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/AfricaRise.mp3', 210000, 'upbeat'),
  ('DJ Sparks Letto', 'DJ Sparks', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/DJ%20Sparks%20Letto.mp3', 240000, 'chill'),
  ('The Way Around This World (Kumbaya Groove)', 'Kumbaya', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/Music/The%20Way%20Around%20This%20World%20(Kumbaya%20Groove).mp3', 225000, 'chill'),
  ('Background Music', 'Radio Lezo', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/backgroundmusic.mp3', 300000, 'chill'),
  ('Back Music 2', 'Radio Lezo', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic2.mp3', 300000, 'chill'),
  ('Back Music 3', 'Radio Lezo', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Backmusic3.mp3', 300000, 'chill'),
  ('Global News Theme', 'Radio Lezo', 'Radio Lezo',
   'https://ohvdxujnzsgagdbzuhsy.supabase.co/storage/v1/object/public/introaudio/Globalnews.mp3', 300000, 'dramatic')
ON CONFLICT DO NOTHING;
