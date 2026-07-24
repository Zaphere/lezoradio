// reset-events.js
// One-time script: reset all 'processed' events back to 'active'
// Run once with: node reset-events.js

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Resetting processed events back to active (last 24h only)...');

  // Only reset recent events (last 24h) to avoid timeout
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('events')
    .update({ status: 'active' })
    .eq('status', 'processed')
    .gte('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('Failed to reset events:', error.message);
    // Try without .select() to reduce payload
    const { error: e2 } = await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('status', 'processed')
      .gte('created_at', cutoff);
    if (e2) {
      console.error('Retry also failed:', e2.message);
    } else {
      console.log('✅ Reset completed (count unknown)');
    }
  } else {
    console.log(`✅ Reset ${data?.length ?? 0} events from 'processed' → 'active'`);
  }

  // Clear queue_played_items (small table, should be fast)
  const { error: qErr } = await supabase
    .from('queue_played_items')
    .delete()
    .gt('created_at', '2000-01-01T00:00:00Z');

  if (qErr) {
    console.error('Failed to clear queue_played_items:', qErr.message);
  } else {
    console.log('✅ Cleared queue_played_items');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
