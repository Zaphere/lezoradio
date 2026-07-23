/**
 * Live LezoTraffic Pipeline Verification
 * Run from project root: node backend/verify-lezotraffic-live.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

// Load env
dotenv.config({ path: 'backend/.env' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(url, key, { realtime: { transport: ws } });

// 1. Check provider_configs
console.log('═══ STEP 1: provider_configs ═══');
const { data: configs, error: cfgErr } = await supabase
  .from('provider_configs')
  .select('*')
  .order('provider');

if (cfgErr) {
  console.error('Error:', cfgErr.message);
} else {
  for (const c of configs) {
    const marker = c.provider === 'lezotraffic' ? (c.enabled ? ' ✅ ENABLED' : ' ❌ DISABLED') : '';
    console.log(`  provider=${c.provider}  enabled=${c.enabled}  sync=${c.sync_schedule}${marker}`);
  }
}

// 2. Check events table
console.log('\n═══ STEP 2: events (last 10) ═══');
const { data: events, error: evErr, count } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(10);

if (evErr) {
  console.error('Error:', evErr.message);
} else {
  console.log(`  Total events in table: ${count}`);
  for (const e of (events || [])) {
    console.log(`  [${e.provider}] ${e.category}/${e.subcategory || '?'} prio=${e.priority} ${e.province || '?'}/${e.city || '?'} — ${(e.title || '').substring(0, 60)}`);
  }
}

// 3. LezoTraffic-specific events
console.log('\n═══ STEP 3: lezotraffic events ═══');
const { data: ltEvents, count: ltCount } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .eq('provider', 'lezotraffic')
  .order('created_at', { ascending: false })
  .limit(5);

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
const { data: states } = await supabase
  .from('radio_station_state')
  .select('*')
  .limit(5);

if (!states || states.length === 0) {
  console.log('  No rows (engine not started yet — expected)');
} else {
  for (const s of states) {
    console.log(`  channel=${s.channel_id} type=${s.segment_type} provider=${s.provider || 'null'} city=${s.city || 'null'} province=${s.province || 'null'}`);
  }
}

// 5. Sync logs
console.log('\n═══ STEP 5: provider_sync_logs (last 5) ═══');
const { data: logs } = await supabase
  .from('provider_sync_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5);

if (!logs || logs.length === 0) {
  console.log('  No sync logs yet');
} else {
  for (const l of logs) {
    console.log(`  [${l.provider}] ${l.status} fetched=${l.items_fetched} inserted=${l.items_inserted} ${l.created_at}`);
  }
}

// 6. station_channels
console.log('\n═══ STEP 6: station_channels ═══');
const { data: channels } = await supabase
  .from('station_channels')
  .select('*')
  .eq('is_active', true);

if (!channels || channels.length === 0) {
  console.log('  No active channels — need to run 999_seed_drc.sql first');
} else {
  for (const ch of channels) {
    console.log(`  ${ch.channel_id} station=${ch.station_id} lang=${ch.language} tz=${ch.timezone}`);
  }
}

// 7. station_voices
console.log('\n═══ STEP 7: station_voices ═══');
const { data: voices } = await supabase
  .from('station_voices')
  .select('*')
  .eq('is_active', true);

if (!voices || voices.length === 0) {
  console.log('  No active voices — need to run 999_seed_drc.sql first');
} else {
  for (const v of voices) {
    console.log(`  station=${v.station_id} lang=${v.language} style=${v.style} voice=${v.voice_id?.substring(0, 30)}`);
  }
}

console.log('\n═══ Verification complete ═══');
