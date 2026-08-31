import { pool } from './supabaseClient.js';

const { rows: data } = await pool.query(
  'SELECT script, region, category FROM radio_scripts WHERE region = $1 LIMIT 5',
  ['congo']
);

for (const s of data || []) {
  console.log('---');
  console.log('Category:', s.category);
  console.log('Script:', s.script.substring(0, 300));
}
