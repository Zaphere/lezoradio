// reset-events.js
// One-time script: reset all 'processed' events back to 'active'
// Run once with: node reset-events.js

import dotenv from 'dotenv';
import { pool } from './supabaseClient.js';

dotenv.config();

async function main() {
  console.log('Resetting processed events back to active (last 24h only)...');

  // Only reset recent events (last 24h) to avoid timeout
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { rows } = await pool.query(
      `UPDATE events
       SET status = 'active'
       WHERE status = 'processed' AND created_at >= $1
       RETURNING id`,
      [cutoff]
    );
    console.log(`✅ Reset ${rows?.length ?? 0} events from 'processed' → 'active'`);
  } catch (error) {
    console.error('Failed to reset events:', error.message);
    try {
      await pool.query(
        `UPDATE events
         SET status = 'active'
         WHERE status = 'processed' AND created_at >= $1`,
        [cutoff]
      );
      console.log('✅ Reset completed (count unknown)');
    } catch (e2) {
      console.error('Retry also failed:', e2.message);
    }
  }

  // Clear queue_played_items (small table, should be fast)
  try {
    await pool.query(
      `DELETE FROM queue_played_items
       WHERE created_at > $1`,
      ['2000-01-01T00:00:00Z']
    );
    console.log('✅ Cleared queue_played_items');
  } catch (qErr) {
    console.error('Failed to clear queue_played_items:', qErr.message);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
