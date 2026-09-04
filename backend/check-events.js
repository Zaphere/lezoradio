/**
 * Check events in the database
 */

import { supabase } from './supabaseClient.js';

async function checkEvents() {
  console.log('Checking events in database...\n');

  // Check total events count
  const { count: totalCount, error: countError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting events:', countError.message);
    return;
  }

  console.log(`Total events in database: ${totalCount}\n`);

  // Check events by provider
  const { data: providerCounts, error: providerError } = await supabase
    .from('events')
    .select('provider');

  if (providerError) {
    console.error('Error getting provider counts:', providerError.message);
    return;
  }

  const providerStats = {};
  providerCounts.forEach(event => {
    providerStats[event.provider] = (providerStats[event.provider] || 0) + 1;
  });

  console.log('Events by provider:');
  Object.entries(providerStats).forEach(([provider, count]) => {
    console.log(`  ${provider}: ${count}`);
  });

  // Get recent LezoTraffic events
  console.log('\nRecent LezoTraffic events:');
  const { data: lezoEvents, error: lezoError } = await supabase
    .from('events')
    .select('*')
    .eq('provider', 'lezotraffic')
    .order('created_at', { ascending: false })
    .limit(5);

  if (lezoError) {
    console.error('Error getting LezoTraffic events:', lezoError.message);
  } else {
    lezoEvents.forEach(event => {
      console.log(`  - ${event.title} (${event.category}/${event.subcategory}) - Priority: ${event.priority}`);
    });
  }

  // Get recent RSS events
  console.log('\nRecent RSS events:');
  const { data: rssEvents, error: rssError } = await supabase
    .from('events')
    .select('*')
    .eq('provider', 'rss')
    .order('created_at', { ascending: false })
    .limit(5);

  if (rssError) {
    console.error('Error getting RSS events:', rssError.message);
  } else {
    rssEvents.forEach(event => {
      console.log(`  - ${event.title.substring(0, 50)}... (${event.category}) - Priority: ${event.priority}`);
    });
  }

  // Check sync logs
  console.log('\nRecent sync logs:');
  const { data: syncLogs, error: syncError } = await supabase
    .from('provider_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (syncError) {
    console.error('Error getting sync logs:', syncError.message);
  } else {
    syncLogs.forEach(log => {
      console.log(`  - ${log.provider}: ${log.status} (${log.items_inserted} inserted, ${log.items_skipped} skipped)`);
    });
  }
}

checkEvents();
