import { supabase } from './supabaseClient.js';
import { logIngestionEvent } from './ingestionLogger.js';

const RETENTION_HOURS = parseInt(process.env.NEWS_RETENTION_HOURS || '72', 10);
const EVENTS_RETENTION_HOURS = parseInt(process.env.EVENTS_RETENTION_HOURS || RETENTION_HOURS, 10);

/**
 * Prune the `events` table. Unlike news_items/radio_scripts this table was
 * never pruned by anything — RSS (every 15min) and LezoTraffic (every 1min)
 * insert into it forever. Combined with wide rows (raw_payload/metadata
 * JSONB), unbounded growth is what caused "canceling statement due to
 * statement timeout" on queueManager.getUnplayedEvents() and
 * server.js getNewsContent(). Run this regularly, not just once.
 */
export async function deleteExpiredEvents(dryRun = false) {
  const cutoff = new Date(Date.now() - EVENTS_RETENTION_HOURS * 3600000).toISOString();
  console.log(`\n=== Events Table Expiry Cleanup ===`);
  console.log(`Retention: ${EVENTS_RETENTION_HOURS} hours`);
  console.log(`Cutoff: ${cutoff}`);
  console.log(`Dry run: ${dryRun}`);

  const results = { events: 0, errors: [] };

  try {
    const { data: expired, error: findError } = await supabase
      .from('events')
      .select('id')
      .lt('created_at', cutoff);

    if (findError) {
      console.error(`Failed to find expired events: ${findError.message}`);
      results.errors.push(findError.message);
      return results;
    }

    if (!expired || expired.length === 0) {
      console.log('No expired events found.');
      return results;
    }

    const expiredIds = expired.map((row) => row.id);
    console.log(`Found ${expiredIds.length} expired events`);

    if (dryRun) {
      console.log(`(dry-run) Would delete ${expiredIds.length} events`);
      results.events = expiredIds.length;
      return results;
    }

    const BATCH_SIZE = 200;
    let deletedCount = 0;

    for (let i = 0; i < expiredIds.length; i += BATCH_SIZE) {
      const batch = expiredIds.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`Failed to delete events batch ${i / BATCH_SIZE}: ${deleteError.message}`);
        results.errors.push(deleteError.message);
      } else {
        deletedCount += batch.length;
      }
    }

    results.events = deletedCount;
    console.log(`Deleted ${deletedCount} expired events in ${Math.ceil(deletedCount / BATCH_SIZE)} batches`);

    return results;
  } catch (err) {
    console.error(`Events expiry cleanup failed: ${err.message}`);
    results.errors.push(err.message);
    return results;
  }
}

export async function deleteExpiredContent(dryRun = false) {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 3600000).toISOString();
  console.log(`\n=== Content Expiry Cleanup ===`);
  console.log(`Retention: ${RETENTION_HOURS} hours`);
  console.log(`Cutoff: ${cutoff}`);
  console.log(`Dry run: ${dryRun}`);

  const results = { newsItems: 0, scripts: 0, errors: [] };

  try {
    // Find expired news items
    const { data: expired, error: findError } = await supabase
      .from('news_items')
      .select('id')
      .lt('ingested_at', cutoff);

    if (findError) {
      console.error(`Failed to find expired items: ${findError.message}`);
      results.errors.push(findError.message);
      return results;
    }

    if (!expired || expired.length === 0) {
      console.log('No expired content found.');
      return results;
    }

    const expiredIds = expired.map((row) => row.id);
    console.log(`Found ${expiredIds.length} expired news items`);

    if (dryRun) {
      console.log(`(dry-run) Would delete ${expiredIds.length} news items and their scripts`);
      results.newsItems = expiredIds.length;
      return results;
    }

    // Delete radio scripts first (child records)
    const { error: scriptError } = await supabase
      .from('radio_scripts')
      .delete()
      .in('news_item_id', expiredIds);

    if (scriptError) {
      console.error(`Failed to delete expired scripts: ${scriptError.message}`);
      results.errors.push(scriptError.message);
    } else {
      results.scripts = expiredIds.length;
      console.log(`Deleted scripts for ${expiredIds.length} items`);
    }

    // Delete in batches to avoid request size limits
    const BATCH_SIZE = 50;
    let deletedCount = 0;

    for (let i = 0; i < expiredIds.length; i += BATCH_SIZE) {
      const batch = expiredIds.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from('news_items')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`Failed to delete batch ${i / BATCH_SIZE}: ${deleteError.message}`);
        results.errors.push(deleteError.message);
      } else {
        deletedCount += batch.length;
      }
    }

    results.newsItems = deletedCount;
    console.log(`Deleted ${deletedCount} news items in ${Math.ceil(deletedCount / BATCH_SIZE)} batches`);

    await logIngestionEvent({
      feedSource: 'expiry_cleanup',
      status: 'success',
      itemsInserted: 0,
      itemsSkipped: 0,
      errors: null,
    });

    return results;
  } catch (err) {
    console.error(`Content expiry cleanup failed: ${err.message}`);
    results.errors.push(err.message);

    await logIngestionEvent({
      feedSource: 'expiry_cleanup',
      status: 'fail',
      errors: err.message,
    });

    return results;
  }
}
