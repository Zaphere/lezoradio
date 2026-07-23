# Supabase Database Recreation Guide

This guide explains how to recreate your LezoRadio Supabase database from scratch if it becomes corrupted.

## ⚠️ Important Warning

**This process will DELETE ALL EXISTING DATA in your Supabase database.** Make sure to backup any important data before proceeding.

## Prerequisites

1. Access to your Supabase project dashboard
2. Supabase SQL Editor access
3. Your Supabase project URL and anon key (for environment variables)

## Step-by-Step Instructions

### Step 1: Backup Existing Data (Optional but Recommended)

If you have any important data you want to preserve:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Export data from critical tables:
   ```sql
   -- Backup stations
   SELECT * FROM stations;
   
   -- Backup content sources
   SELECT * FROM content_sources;
   
   -- Backup events/news items
   SELECT * FROM events;
   SELECT * FROM news_items;
   ```

### Step 2: Open the Supabase SQL Editor

1. Log in to your Supabase dashboard
2. Navigate to your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 3: Run the Recreation Script

1. Open the file: `/home/lezoapp/projects/lezoradio/supabase/recreate_database.sql`
2. Copy the entire contents of the file
3. Paste it into the Supabase SQL Editor
4. **IMPORTANT**: First, uncomment the DROP TABLE statements at the top if you want to completely reset the database
5. Click "Run" to execute the script

The script will:
- Create all required tables (Phase 1 + V3 migrations)
- Set up proper indexes and constraints
- Configure Row Level Security (RLS) policies
- Insert seed data (stations, content sources, default configurations)
- Set up the events trigger for real-time notifications### Step 4: Verify the Recreation

Run these verification queries in the SQL Editor:

```sql
-- Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify stations were seeded
SELECT COUNT(*) as station_count FROM stations;

-- Verify content sources were seeded
SELECT COUNT(*) as source_count FROM content_sources;

-- Verify station channels exist
SELECT COUNT(*) as channel_count FROM station_channels;

-- Verify content templates exist
SELECT template_type, language, COUNT(*) 
FROM content_templates 
GROUP BY template_type, language;
```

Expected results:
- ~25 tables created
- 22 stations
- 10 content sources
- 3 station channels (Kinshasa, Goma, Lubumbashi)
- Multiple content templates

### Step 5: Configure Storage Buckets

The recreation script references audio files in Supabase Storage. You need to:

1. Go to Storage in your Supabase dashboard
2. Create a bucket named `introaudio` (or update the URLs in the script)
3. Upload your audio files:
   - `LezzoTrafficappIntro.mp3` (intro jingle)
   - `backgroundmusic.mp3` (background music)
   - `Kumbaya.mp3` (entertainment track)
   - `Familia.mp3` (entertainment track)
   - `kumbaya-encore.mp3` (entertainment track)

4. Update the audio URLs in the database if your bucket name is different:
   ```sql
   UPDATE audio_config 
   SET intro_url = 'https://your-project.supabase.co/storage/v1/object/public/your-bucket/your-file.mp3'
   WHERE channel_id IS NULL;
   ```

### Step 6: Update Environment Variables

Ensure your local environment variables are configured correctly:

1. Check your `.env` file or environment configuration:
   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. If you created a new Supabase project, update these values with the new project credentials.

### Step 7: Test the Application

1. Start your LezoRadio application
2. Navigate to the Radio page
3. Verify that:
   - Stations load correctly
   - Content sources are accessible
   - News items can be fetched
   - Audio playback works

## Alternative: Individual Migration Execution

If you prefer to run migrations individually instead of the combined script:

### Phase 1 Migrations (in order):

1. `20260629_create_stations_sources.sql`
2. `20260629_phase1_station_extend.sql`
3. `20260629_regional_rss_sources.sql`
4. `20260629_add_eswatini_station.sql`
5. `20260629_fix_feeds_constraints.sql`
6. `20260629_fix_rss_sources.sql`
7. `20260629_add_timezone_and_bulletin.sql`
8. `20260701_live_ingestion_ext.sql`
9. `20260706_provider_framework_upgrade.sql`
10. `20260713_v2_station_config.sql`
11. `20260713_v2_music_catalog.sql`
12. `20260713_v2_prompt_templates.sql`
13. `20260713_v2_translations_cache.sql`
14. `20260713_v2_feature_flags.sql`

### V3 Migrations (in order):

1. `v3/001_radio_station_state.sql`
2. `v3/002_station_channels.sql`
3. `v3/003_queue_played_items.sql`
4. `v3/004_tts_audio_cache.sql`
5. `v3/005_content_templates.sql`
6. `v3/006_audio_config.sql`
7. `v3/007_engine_config.sql`
8. `v3/008_provider_taxonomy.sql`
9. `v3/009_normalizer_config.sql`
10. `v3/010_playback_history.sql`
11. `v3/011_entertainment_tracks.sql`
12. `v3/012_events_notify_trigger.sql`
13. `v3/013_enable_lezotraffic_and_source_fields.sql`
14. `v3/999_seed_drc.sql`

## Troubleshooting

### Issue: "Table already exists" errors

**Solution**: The script uses `IF NOT EXISTS` clauses, but if you have custom tables with the same names, you may need to:
1. Uncomment the DROP TABLE statements at the top of the script
2. Or manually drop conflicting tables before running the script

### Issue: RLS policy errors

**Solution**: Ensure you're running the script with sufficient permissions. Use the service role key if needed.

### Issue: Missing audio files

**Solution**: The audio_config table references Supabase Storage URLs. Either:
1. Upload the audio files to Storage and update the URLs
2. Or set the audio_config URLs to NULL temporarily

### Issue: Events trigger not working

**Solution**: Verify the trigger was created:
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trg_events_notify_engine';
```

### Issue: Station channels not appearing

**Solution**: The seed data requires the stations table to exist first. Ensure stations were created before running the seed section.

## Database Schema Overview

### Core Tables

- **stations**: Radio station definitions
- **content_sources**: RSS feeds and content providers
- **station_sources**: Many-to-many relationship between stations and sources
- **events**: News events and content items
- **news_items**: Legacy news items table

### V3 Tables

- **radio_station_state**: Real-time playback state per channel
- **station_channels**: Broadcast channels with language/voice config
- **queue_played_items**: Tracks played items for rotation control
- **tts_audio_cache**: Cached TTS audio
- **content_templates**: Text templates for transitions, IDs, etc.
- **audio_config**: Audio timing and volume configuration
- **engine_config**: Engine behavior and scheduling config
- **provider_taxonomy**: Provider classification mappings
- **normalizer_config**: Content normalizer settings
- **playback_history**: Detailed playback log
- **entertainment_tracks**: Entertainment segment configuration

## Support

If you encounter issues not covered in this guide:

1. Check the Supabase logs in your dashboard
2. Review the individual migration files in `/supabase/migrations/`
3. Verify your environment variables are correctly set
4. Ensure your Supabase project has the necessary permissions enabled

## Recovery from Backup

If you have a database backup:

1. Go to your Supabase dashboard
2. Navigate to Database > Backups
3. Select a backup point before the corruption
4. Click "Restore" to recover from that point

This is often faster than recreating from scratch if you have recent backups available.
