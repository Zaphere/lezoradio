/**
 * Deep trace of real LezoTraffic events — find traffic/security incidents
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

// 1. Count by category
console.log('═══ LezoTraffic events by category ═══');
const categories = ['traffic', 'security', 'emergency', 'geo', 'event', 'transport', 'news'];
for (const cat of categories) {
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'lezotraffic')
    .eq('category', cat);
  console.log(`  ${cat}: ${count} events`);
}

// 2. Find actual traffic/security incidents (not geo)
console.log('\n═══ Real traffic/security incidents (last 10) ═══');
const { data: incidents } = await supabase
  .from('events')
  .select('*')
  .eq('provider', 'lezotraffic')
  .not('category', 'eq', 'geo')
  .order('created_at', { ascending: false })
  .limit(10);

if (!incidents || incidents.length === 0) {
  console.log('  No traffic/security incidents found');
  console.log('  All events are geo/city/province metadata');
} else {
  for (const e of incidents) {
    console.log(`\n  ─── ${e.id} ───`);
    console.log(`  title: ${e.title}`);
    console.log(`  provider_type: ${e.provider_type}`);
    console.log(`  category: ${e.category}  subcategory: ${e.subcategory}`);
    console.log(`  priority: ${e.priority}  severity: ${e.metadata?.severity || e.metadata?.incident_severity || 'n/a'}`);
    console.log(`  location: ${e.city || '?'}, ${e.province || '?'}, ${e.country}`);
    console.log(`  summary: ${(e.summary || '').substring(0, 150)}`);
    console.log(`  raw_payload keys: ${e.raw_payload ? Object.keys(e.raw_payload).join(', ') : 'MISSING'}`);
    console.log(`  metadata: ${JSON.stringify(e.metadata || {}).substring(0, 200)}`);
  }
}

// 3. Try generating a script for the top incident
console.log('\n═══ Script generation for top incident ═══');
const { generateEventScript } = await import('./providers/scriptGenerator.js');

const topIncident = incidents?.find(e => e.category === 'traffic' || e.category === 'security');
if (topIncident) {
  for (const lang of ['fr', 'en']) {
    const script = generateEventScript(topIncident, lang);
    console.log(`\n  [${lang}] ${script}`);
  }
} else {
  // Generate for top event anyway
  const top = incidents?.[0];
  if (top) {
    for (const lang of ['fr', 'en']) {
      const script = generateEventScript(top, lang);
      console.log(`\n  [${lang}] ${script}`);
    }
  }
}

// 4. Count totals by provider_type
console.log('\n═══ LezoTraffic by provider_type ═══');
const types = ['incident', 'alert', 'city', 'province', 'destination'];
for (const t of types) {
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'lezotraffic')
    .eq('provider_type', t);
  console.log(`  ${t}: ${count}`);
}

console.log('\n═══ Deep trace complete ═══');
