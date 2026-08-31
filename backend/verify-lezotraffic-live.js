/**
 * Live LezoTraffic Pipeline Verification
 * Run from project root: node backend/verify-lezotraffic-live.js
 */

import { pool } from './supabaseClient.js';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: 'backend/.env' });

// 1. Check provider_configs
console.log('═══ STEP 1: provider_configs ═══');
try {
  const { rows: configs } = await pool.query(
    `SELECT * FROM provider_configs ORDER BY provider`
  );
  for (const c of configs) {
    const marker = c.provider === 'lezotraffic' ? (c.enabled ? ' ✅ ENABLED' : ' ❌ DISABLED') : '';
    console.log(`  provider=${c.provider}  enabled=${c.enabled}  sync=${c.sync_schedule}${marker}`);
  }
} catch (cfgErr) {
  console.error('Error:', cfgErr.message);
}

// 2. Check events table
console.log('\n═══ STEP 2: events (last 10) ═══');
try {
  const { rows: events, rowCount } = await pool.query(
    `SELECT * FROM events
     ORDER BY created_at DESC
     LIMIT 10`
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM events');
  console.log(`  Total events in table: ${countRows[0].count}`);
  for (const e of (events || [])) {
    console.log(`  [${e.provider}] ${e.category}/${e.subcategory || '?'} prio=${e.priority} ${e.province || '?'}/${e.city || '?'} — ${(e.title || '').substring(0, 60)}`);
  }
} catch (evErr) {
  console.error('Error:', evErr.message);
}

// 3. LezoTraffic-specific events
console.log('\n═══ STEP 3: lezotraffic events ═══');
const { rows: ltEvents } = await pool.query(
  `SELECT * FROM events
   WHERE provider = $1
   ORDER BY created_at DESC
   LIMIT 5`,
  ['lezotraffic']
);
const { rows: ltCountRows } = await pool.query(
  `SELECT COUNT(*) as count FROM events WHERE provider = $1`,
  ['lezotraffic']
);
const ltCount = ltCountRows[0].count;

console.log(`  LezoTraffic events: ${ltCount}`);
for (const e of (ltEvents || [])) {
  console.log(`\n  ID: ${e.id}`);
  console.log(`  title: ${(e.title || '').substring(0, 80)}`);
  console.log(`  provider: ${e.provider}  provider_type: ${e.provider_type}`);
  console.log(`  category: ${e.category}  subcategory: ${e.subcategory || 'null'}`);
  console.log(`  priority: ${e.priority}`);
  console.log(`  country: ${e.country}  province: ${e.province}  city: ${e.city}`);
  console.log(`  language: ${e.language}  status: ${e.status}  verified: ${e.verified}`);
  console.log(`  raw_payload: ${e.raw_payload ? 'present (' + JSON.stringify(e.raw_payload).length + ' bytes)' : 'MISSING'}`);
  console.log(`  metadata: ${JSON.stringify(e.metadata || {}).substring(0, 200)}`);
}

// 4. radio_station_state
console.log('\n═══ STEP 4: radio_station_state ═══');
const { rows: states } = await pool.query(
  `SELECT * FROM radio_station_state LIMIT 5`
);

if (!states || states.length === 0) {
  console.log('  No rows (engine not started yet — expected)');
} else {
  for (const s of states) {
    console.log(`  channel=${s.channel_id} type=${s.segment_type} provider=${s.provider || 'null'} city=${s.city || 'null'} province=${s.province || 'null'}`);
  }
}

// 5. Sync logs
console.log('\n═══ STEP 5: provider_sync_logs (last 5) ═══');
const { rows: logs } = await pool.query(
  `SELECT * FROM provider_sync_logs
   ORDER BY created_at DESC
   LIMIT 5`
);

if (!logs || logs.length === 0) {
  console.log('  No sync logs yet');
} else {
  for (const l of logs) {
    console.log(`  [${l.provider}] ${l.status} fetched=${l.items_fetched} inserted=${l.items_inserted} ${l.created_at}`);
  }
}

// 6. station_channels
console.log('\n═══ STEP 6: station_channels ═══');
const { rows: channels } = await pool.query(
  `SELECT * FROM station_channels WHERE is_active = true`
);

if (!channels || channels.length === 0) {
  console.log('  No active channels — need to run 999_seed_drc.sql first');
} else {
  for (const ch of channels) {
    console.log(`  ${ch.channel_id} station=${ch.station_id} lang=${ch.language} tz=${ch.timezone}`);
  }
}

// 7. station_voices
console.log('\n═══ STEP 7: station_voices ═══');
const { rows: voices } = await pool.query(
  `SELECT * FROM station_voices WHERE is_active = true`
);

if (!voices || voices.length === 0) {
  console.log('  No active voices — need to run 999_seed_drc.sql first');
} else {
  for (const v of voices) {
    console.log(`  station=${v.station_id} lang=${v.language} style=${v.style} voice=${v.voice_id?.substring(0, 30)}`);
  }
}

console.log('\n═══ Verification complete ═══');
