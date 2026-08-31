import { pool } from './supabaseClient.js';

const { rows: scripts } = await pool.query('SELECT region, category FROM radio_scripts LIMIT 20');
console.log('Sample scripts:', JSON.stringify(scripts, null, 2));

const { rows: totalRows } = await pool.query('SELECT COUNT(*) as count FROM radio_scripts');
console.log('Total scripts:', totalRows[0].count);

const { rows: regions } = await pool.query('SELECT region FROM radio_scripts');
const regionCounts = {};
for (const r of regions || []) {
  regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
}
console.log('Region counts:', regionCounts);
