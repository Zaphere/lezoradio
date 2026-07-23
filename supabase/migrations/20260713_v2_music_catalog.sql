-- AARN v2: Music Catalog
-- Stores music tracks and playlists for broadcast
-- Run this migration in the Supabase SQL editor.

-- Music Tracks Table
CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  duration_ms INT NOT NULL,
  bpm INT,
  mood TEXT,
  tags JSONB DEFAULT '[]',
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  is_explicit BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Music Playlists Table
CREATE TABLE IF NOT EXISTS music_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  shuffle BOOLEAN DEFAULT false,
  loop BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Playlist Tracks Junction Table
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  position INT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Music Play History Table
CREATE TABLE IF NOT EXISTS music_play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT now(),
  duration_played_ms INT,
  completed BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_music_tracks_language ON music_tracks(language);
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood ON music_tracks(mood);
CREATE INDEX IF NOT EXISTS idx_music_tracks_available ON music_tracks(is_available);
CREATE INDEX IF NOT EXISTS idx_music_playlists_station_id ON music_playlists(station_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_music_play_history_station_id ON music_play_history(station_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_track_id ON music_play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_played_at ON music_play_history(played_at DESC);