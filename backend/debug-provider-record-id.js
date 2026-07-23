/**
 * Debug: Check for events with empty provider_record_id
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

// Find events with empty/null provider_record_id
console.log('═══ Events with empty provider_record_id ═══');
const { data: badEvents } = await supabase
  .from('events')
  .select('id, provider, provider_record_id, category, city, title')
  .eq('provider', 'lezotraffic')
  .or('provider_record_id.is.null,provider_record_id.eq.')
  .limit(10);

if (!badEvents || badEvents.length === 0) {
  console.log('  None found — all events have provider_record_id');
} else {
  for (const e of badEvents) {
    console.log(`  id=${e.id} prid="${e.provider_record_id}" cat=${e.category} city=${e.city}`);
  }
}

// Check city/province events specifically
console.log('\n═══ City events sample ═══');
const { data: cities } = await supabase
  .from('events')
  .select('id, provider_record_id, title, city, province, metadata')
  .eq('provider', 'lezotraffic')
  .eq('provider_type', 'city')
  .limit(3);

for (const c of (cities || [])) {
  console.log(`  prid: "${c.provider_record_id}"`);
  console.log(`  title: ${c.title}  city: ${c.city}  province: ${c.province}`);
  console.log(`  metadata: ${JSON.stringify(c.metadata)}`);
  console.log('');
}

// Check province events sample
console.log('═══ Province events sample ═══');
const { data: provinces } = await supabase
  .from('events')
  .select('id, provider_record_id, title, city, province, metadata')
  .eq('provider', 'lezotraffic')
  .eq('provider_type', 'province')
  .limit(3);

for (const p of (provinces || [])) {
  console.log(`  prid: "${p.provider_record_id}"`);
  console.log(`  title: ${p.title}  province: ${p.province}`);
  console.log(`  metadata: ${JSON.stringify(p.metadata)}`);
  console.log('');
}

// Check the DB schema for provider_record_id constraints
console.log('═══ Schema check ═══');
const { data: cols } = await supabase.rpc('exec_sql', {
  sql: `SELECT column_name, is_nullable, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'provider_record_id'`
});

if (cols) {
  console.log('  provider_record_id schema:', JSON.stringify(cols));
} else {
  console.log('  Could not query schema (rpc not available)');
}
