/**
 * Debug: Check for events with empty provider_record_id
 */
import { pool } from './supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

// Find events with empty/null provider_record_id
console.log('═══ Events with empty provider_record_id ═══');
const { rows: badEvents } = await pool.query(
  `SELECT id, provider, provider_record_id, category, city, title
   FROM events
   WHERE provider = $1
     AND (provider_record_id IS NULL OR provider_record_id = '')
   LIMIT 10`,
  ['lezotraffic']
);

if (!badEvents || badEvents.length === 0) {
  console.log('  None found — all events have provider_record_id');
} else {
  for (const e of badEvents) {
    console.log(`  id=${e.id} prid="${e.provider_record_id}" cat=${e.category} city=${e.city}`);
  }
}

// Check city/province events specifically
console.log('\n═══ City events sample ═══');
const { rows: cities } = await pool.query(
  `SELECT id, provider_record_id, title, city, province, metadata
   FROM events
   WHERE provider = $1 AND provider_type = $2
   LIMIT 3`,
  ['lezotraffic', 'city']
);

for (const c of (cities || [])) {
  console.log(`  prid: "${c.provider_record_id}"`);
  console.log(`  title: ${c.title}  city: ${c.city}  province: ${c.province}`);
  console.log(`  metadata: ${JSON.stringify(c.metadata)}`);
  console.log('');
}

// Check province events sample
console.log('═══ Province events sample ═══');
const { rows: provinces } = await pool.query(
  `SELECT id, provider_record_id, title, city, province, metadata
   FROM events
   WHERE provider = $1 AND provider_type = $2
   LIMIT 3`,
  ['lezotraffic', 'province']
);

for (const p of (provinces || [])) {
  console.log(`  prid: "${p.provider_record_id}"`);
  console.log(`  title: ${p.title}  province: ${p.province}`);
  console.log(`  metadata: ${JSON.stringify(p.metadata)}`);
  console.log('');
}

// Check the DB schema for provider_record_id constraints
console.log('═══ Schema check ═══');
try {
  const { rows: cols } = await pool.query(
    `SELECT column_name, is_nullable, character_maximum_length
     FROM information_schema.columns
     WHERE table_name = 'events' AND column_name = 'provider_record_id'`
  );

  if (cols && cols.length > 0) {
    console.log('  provider_record_id schema:', JSON.stringify(cols));
  } else {
    console.log('  Could not query schema (rpc not available)');
  }
} catch (e) {
  console.log('  Could not query schema (rpc not available)');
}
