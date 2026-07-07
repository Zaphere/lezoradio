import { supabase } from './supabaseClient.js';
import { logIngestionEvent } from './ingestionLogger.js';

const RETENTION_HOURS = parseInt(process.env.NEWS_RETENTION_HOURS || '72', 10);

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
