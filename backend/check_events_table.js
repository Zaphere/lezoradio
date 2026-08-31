import { pool } from './supabaseClient.js';

async function run() {
  console.log('Querying table information for events...');
  
  try {
    const { rows } = await pool.query('SELECT * FROM events LIMIT 1');
    console.log('Success, data structure:', rows);
  } catch (error) {
    console.error('Error fetching from events:', error);
  }

  try {
    const { rows: cols } = await pool.query(
      "SELECT * FROM information_schema.columns WHERE table_name = $1",
      ['events']
    );
    console.log('Columns from view:', cols);
  } catch (err) {
    console.log('Could not query columns view:', err.message);
  }
}

run();
