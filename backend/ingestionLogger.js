import { supabase } from './supabaseClient.js';

export async function logIngestionEvent({
  feedSource,
  feedUrl = null,
  language = null,
  status,
  itemsFetched = 0,
  itemsInserted = 0,
  itemsSkipped = 0,
  errors = null,
  durationMs = 0,
}) {
  // Build the full desired payload
  const fullPayload = {
    feed_source: feedSource,
    feed_url: feedUrl,
    language,
    status,
    items_fetched: itemsFetched,
    items_inserted: itemsInserted,
    items_skipped: itemsSkipped,
    errors: errors ? String(errors).substring(0, 2000) : null,
    duration_ms: durationMs,
  };

  // Strip any columns we already know are missing
  const payload = { ...fullPayload };
  for (const col of _missingCols) {
    delete payload[col];
  }

  try {
    let { error } = await supabase.from('ingestion_logs').insert(payload);

    // Self-healing: if PostgREST complains about a missing column, strip it and retry.
    // Loop so we can handle multiple absent columns in one run.
    let retries = 0;
    while (error && error.message && error.message.includes('column') && retries < 10) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const badCol = match[1];
      _missingCols.add(badCol);
      delete payload[badCol];
      ({ error } = await supabase.from('ingestion_logs').insert(payload));
      retries++;
    }

    if (error) {
      console.warn(`[ingestionLogger] Failed to log after ${retries} retries: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[ingestionLogger] Failed to log ingestion event: ${err.message}`);
  }
}



// Set of column names that are known to be absent from the ingestion_logs table.
// Populated dynamically on first failed insert — no startup probing needed.
const _missingCols = new Set();


export async function getRecentLogs(limit = 20, status = null) {
  try {
    let q = supabase
      .from('ingestion_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch recent logs: ${err.message}`);
    return [];
  }
}

export async function getIngestionSummary(hours = 24) {
  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString();

    const { data: successCount } = await supabase
      .from('ingestion_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('status', 'success');

    const { data: failCount } = await supabase
      .from('ingestion_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('status', 'fail');

    const { data: totalInserted } = await supabase
      .from('ingestion_logs')
      .select('items_inserted')
      .gte('created_at', since);

    const totalItemsInserted = (totalInserted || []).reduce((sum, r) => sum + (r.items_inserted || 0), 0);

    return {
      since,
      successful: successCount?.length || 0,
      failed: failCount?.length || 0,
      totalItemsInserted,
    };
  } catch (err) {
    console.error(`Failed to get ingestion summary: ${err.message}`);
    return { since: null, successful: 0, failed: 0, totalItemsInserted: 0 };
  }
}
