-- =====================================================
-- Diagnostic: Check what's deleting data in Supabase
-- =====================================================

-- 1. Check for pg_cron scheduled jobs (these run on a schedule)
SELECT jobid, jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;

-- 2. Check for triggers on events, news_items, radio_scripts
SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('events', 'news_items', 'radio_scripts')
ORDER BY event_object_table, trigger_name;

-- 3. Check for functions that might be doing deletion
SELECT proname, prosrc
FROM pg_proc
WHERE proname ILIKE '%retent%'
   OR proname ILIKE '%clean%'
   OR proname ILIKE '%expir%'
   OR proname ILIKE '%delet%'
   OR proname ILIKE '%prune%';

-- 4. Check data counts (how many records exist)
SELECT 'events' AS table_name, COUNT(*) AS row_count FROM events
UNION ALL
SELECT 'news_items', COUNT(*) FROM news_items
UNION ALL
SELECT 'radio_scripts', COUNT(*) FROM radio_scripts;

-- 5. Check newest events
SELECT provider, category, title, created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check newest news_items
SELECT region, category, title, ingested_at
FROM news_items
ORDER BY ingested_at DESC
LIMIT 10;

-- 7. Check newest radio_scripts
SELECT region, category, created_at
FROM radio_scripts
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check the age of newest vs oldest data
SELECT 'events' AS tbl,
  MIN(created_at) AS oldest, MAX(created_at) AS newest,
  EXTRACT(epoch FROM MAX(created_at) - MIN(created_at))/3600 AS age_hours
FROM events
UNION ALL
SELECT 'news_items',
  MIN(ingested_at), MAX(ingested_at),
  EXTRACT(epoch FROM MAX(ingested_at) - MIN(ingested_at))/3600
FROM news_items
UNION ALL
SELECT 'radio_scripts',
  MIN(created_at), MAX(created_at),
  EXTRACT(epoch FROM MAX(created_at) - MIN(created_at))/3600
FROM radio_scripts;

-- 9. Check for any extensions enabled (cron, pg_cron)
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- 10. Check if there are any custom scheduled tasks via Supabase
SELECT * FROM cron.job WHERE active = true;
