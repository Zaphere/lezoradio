-- =============================================================================
-- CLEANUP: Remove duplicate events rows
-- =============================================================================
-- LezoTraffic normalizer used Date.now() in provider_record_id, so every
-- sync created new unique rows for cities/provinces/destinations.
-- This deduplicates: keeps only the OLDEST row per provider+provider_record_id
-- and deletes the rest.
--
-- SAFE TO RUN: This is idempotent. Re-running finds no duplicates and deletes 0.
-- =============================================================================

-- Step 1: See how many duplicates exist
SELECT provider, COUNT(*) AS total_rows,
       COUNT(DISTINCT provider_record_id) AS unique_records,
       COUNT(*) - COUNT(DISTINCT provider_record_id) AS duplicates
FROM events
GROUP BY provider;

-- Step 2: See the worst offenders (top 10 most duplicated records)
SELECT provider, provider_record_id, COUNT(*) AS dup_count
FROM events
GROUP BY provider, provider_record_id
HAVING COUNT(*) > 1
ORDER BY dup_count DESC
LIMIT 10;

-- Step 3: Delete duplicates (keep the row with the oldest created_at)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY provider, provider_record_id
           ORDER BY created_at ASC
         ) AS rn
  FROM events
)
DELETE FROM events
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Step 4: Verify cleanup
SELECT provider, COUNT(*) AS total_rows,
       COUNT(DISTINCT provider_record_id) AS unique_records
FROM events
GROUP BY provider;

-- Step 5: Check total row count
SELECT COUNT(*) AS total_events_remaining FROM events;
