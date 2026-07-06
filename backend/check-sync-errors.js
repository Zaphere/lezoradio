/**
 * Check sync error details
 */

import { supabase } from './supabaseClient.js';

async function checkSyncErrors() {
  console.log('Checking sync error details...\n');

  const { data: syncLogs, error } = await supabase
    .from('provider_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error getting sync logs:', error.message);
    return;
  }

  syncLogs.forEach(log => {
    console.log(`Provider: ${log.provider}`);
    console.log(`Status: ${log.status}`);
    console.log(`Items fetched: ${log.items_fetched}`);
    console.log(`Items inserted: ${log.items_inserted}`);
    console.log(`Items skipped: ${log.items_skipped}`);
    console.log(`Duration: ${log.duration_ms}ms`);
    console.log(`Errors: ${log.errors}`);
    console.log('---');
  });
}

checkSyncErrors();
