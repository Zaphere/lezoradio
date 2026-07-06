/**
 * Check LezoTraffic provider status
 */

import { supabase } from './supabaseClient.js';

async function checkLezoTrafficStatus() {
  console.log('Checking LezoTraffic provider status...\n');

  // Check provider config
  const { data: providerConfig, error: configError } = await supabase
    .from('provider_configs')
    .select('*')
    .eq('provider', 'lezotraffic')
    .single();

  if (configError) {
    console.error('Error getting provider config:', configError.message);
  } else {
    console.log('LezoTraffic provider config:');
    console.log(`  Enabled: ${providerConfig.enabled}`);
    console.log(`  Priority: ${providerConfig.priority}`);
    console.log(`  Sync schedule: ${providerConfig.sync_schedule}`);
    console.log(`  Last sync: ${providerConfig.last_sync_at}`);
    console.log(`  Last sync status: ${providerConfig.last_sync_status}`);
    console.log(`  Last error: ${providerConfig.last_error}`);
  }

  // Check LezoTraffic events
  const { count: lezoCount, error: countError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'lezotraffic');

  if (countError) {
    console.error('Error counting LezoTraffic events:', countError.message);
  } else {
    console.log(`\nLezoTraffic events in database: ${lezoCount}`);
  }

  // Get recent LezoTraffic sync logs
  console.log('\nRecent LezoTraffic sync logs:');
  const { data: lezoSyncLogs, error: lezoSyncError } = await supabase
    .from('provider_sync_logs')
    .select('*')
    .eq('provider', 'lezotraffic')
    .order('created_at', { ascending: false })
    .limit(5);

  if (lezoSyncError) {
    console.error('Error getting LezoTraffic sync logs:', lezoSyncError.message);
  } else {
    if (lezoSyncLogs.length === 0) {
      console.log('  No sync logs found for LezoTraffic');
    } else {
      lezoSyncLogs.forEach(log => {
        console.log(`  - ${log.created_at}: ${log.status} (${log.items_inserted} inserted, ${log.items_skipped} skipped)`);
        if (log.endpoint) {
          console.log(`    Endpoint: ${log.endpoint}`);
        }
        if (log.errors) {
          console.log(`    Errors: ${log.errors.substring(0, 100)}...`);
        }
      });
    }
  }
}

checkLezoTrafficStatus();
