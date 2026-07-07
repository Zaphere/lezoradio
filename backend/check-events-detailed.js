/**
 * Check detailed event data from database
 */

import { supabase } from './supabaseClient.js';

async function checkDetailedEvents() {
  console.log('Checking detailed event data...\n');

  // Get recent events with all columns
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching events:', error.message);
    return;
  }

  console.log(`Total events found: ${events.length}\n`);

  events.forEach((event, index) => {
    console.log(`Event ${index + 1}:`);
    console.log(`  ID: ${event.id}`);
    console.log(`  Provider: ${event.provider}`);
    console.log(`  Provider Record ID: ${event.provider_record_id}`);
    console.log(`  Provider Type: ${event.provider_type}`);
    console.log(`  Title: ${event.title}`);
    console.log(`  Category: ${event.category}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  Created At: ${event.created_at}`);
    console.log(`  Occurred At: ${event.occurred_at}`);
    console.log(`  Expires At: ${event.expires_at}`);
    console.log(`  API Version: ${event.api_version}`);
    console.log(`  Raw Payload Version: ${event.raw_payload_version}`);
    console.log(`  Country: ${event.country}`);
    console.log(`  Province: ${event.province}`);
    console.log(`  City: ${event.city}`);
    console.log(`  Latitude: ${event.latitude}`);
    console.log(`  Longitude: ${event.longitude}`);
    console.log(`  Priority: ${event.priority}`);
    console.log(`  Language: ${event.language}`);
    console.log(`  Verified: ${event.verified}`);
    console.log(`---`);
  });

  // Check table structure
  const { data: columns, error: columnsError } = await supabase
    .rpc('get_table_columns', { table_name: 'events' })
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  if (!columnsError && columns) {
    console.log('\nTable columns:', columns.map(c => c.column_name).join(', '));
  }
}

checkDetailedEvents();
