import { pool } from './supabaseClient.js';
import dotenv from 'dotenv';
import RSSProvider from './providers/rss/rssProvider.js';
import { validateEvent } from './providers/validator.js';
dotenv.config();

async function debugRssSync() {
  console.log('Debugging RSS Provider sync...');
  const provider = new RSSProvider({ enabled: true });
  await provider.initialize();
  
  const result = await provider.sync();
  console.log(`Sync returned ${result.events.length} events.`);
  
  if (result.errors) {
    console.log('Errors from provider.sync():', result.errors);
  }
  
  if (result.events.length > 0) {
    const firstEvent = result.events[0];
    console.log('First event:', JSON.stringify(firstEvent, null, 2));
    
    // Now let's try to insert it using pool directly to see the exact error
    const cols = Object.keys(firstEvent);
    const vals = Object.values(firstEvent);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const insertQuery = `INSERT INTO events (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    
    try {
      const { rows } = await pool.query(insertQuery, vals);
      console.log('Successfully inserted first event. ID:', rows[0].id);
      await pool.query('DELETE FROM events WHERE id = $1', [rows[0].id]);
    } catch (error) {
      console.error('Error inserting first event:', error);
    }
  }
}

debugRssSync().catch(err => console.error('Unhandled error:', err));
