/**
 * Check LezoTraffic event deduplication
 */

import './env.js';
import { supabase } from './supabaseClient.js';

async function checkDeduplication() {
  console.log('Checking LezoTraffic event deduplication...\n');

  // Get all LezoTraffic events with their provider_record_id and created_at
  const { data: lezoEvents, error: lezoError } = await supabase
    .from('events')
    .select('id, provider_record_id, title, category, subcategory, created_at, status')
    .eq('provider', 'lezotraffic')
    .order('created_at', { ascending: false });

  if (lezoError) {
    console.error('Error getting LezoTraffic events:', lezoError.message);
    return;
  }

  console.log(`Total LezoTraffic events: ${lezoEvents.length}\n`);

  // Group by provider_record_id to see duplicates
  const byRecordId = {};
  lezoEvents.forEach(event => {
    if (!byRecordId[event.provider_record_id]) {
      byRecordId[event.provider_record_id] = [];
    }
    byRecordId[event.provider_record_id].push(event);
  });

  console.log('Events by provider_record_id:');
  Object.entries(byRecordId).forEach(([recordId, events]) => {
    console.log(`  ${recordId}: ${events.length} event(s)`);
    events.forEach(e => {
      console.log(`    - ID: ${e.id}, Created: ${e.created_at}, Status: ${e.status}, Title: ${e.title}`);
    });
  });

  // Check if any events are marked as played
  console.log('\nChecking played status...');
  try {
    const { data: playedItems, error: playedError } = await supabase
      .from('queue_played_items')
      .select('*')
      .in('event_id', lezoEvents.map(e => e.id));

    if (playedError) {
      console.error('Error getting played items:', playedError.message);
    } else {
      console.log(`Played items: ${playedItems.length}`);
      playedItems.forEach(item => {
        const event = lezoEvents.find(e => e.id === item.event_id);
        if (event) {
          console.log(`  - ${event.title} played at ${item.played_at}`);
        }
      });
    }
  } catch (err) {
    console.log('Note: queue_played_items table may not exist or have different schema');
  }

  // Check the raw payload of recent events to see if data is actually changing
  console.log('\nRaw payload analysis for recent events:');
  const recentEvents = lezoEvents.slice(0, 3);
  for (const event of recentEvents) {
    const { data: fullEvent, error: fullError } = await supabase
      .from('events')
      .select('raw_payload')
      .eq('id', event.id)
      .single();

    if (!fullError && fullEvent?.raw_payload) {
      console.log(`\nEvent: ${event.title}`);
      console.log(`  Provider Record ID: ${event.provider_record_id}`);
      console.log(`  Created: ${event.created_at}`);
      console.log(`  Raw payload keys: ${Object.keys(fullEvent.raw_payload).join(', ')}`);
      if (fullEvent.raw_payload.createdAt) {
        console.log(`  API createdAt: ${fullEvent.raw_payload.createdAt}`);
      }
      if (fullEvent.raw_payload.timestamp) {
        console.log(`  API timestamp: ${fullEvent.raw_payload.timestamp}`);
      }
    }
  }
}

checkDeduplication();
