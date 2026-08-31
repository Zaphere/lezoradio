/**
 * Deep trace of real LezoTraffic events — find traffic/security incidents
 */
import { pool } from './supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

// 1. Count by category
console.log('═══ LezoTraffic events by category ═══');
const categories = ['traffic', 'security', 'emergency', 'geo', 'event', 'transport', 'news'];
for (const cat of categories) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM events
     WHERE provider = $1 AND category = $2`,
    ['lezotraffic', cat]
  );
  console.log(`  ${cat}: ${rows[0].count} events`);
}

// 2. Find actual traffic/security incidents (not geo)
console.log('\n═══ Real traffic/security incidents (last 10) ═══');
const { rows: incidents } = await pool.query(
  `SELECT * FROM events
   WHERE provider = $1 AND category != $2
   ORDER BY created_at DESC
   LIMIT 10`,
  ['lezotraffic', 'geo']
);

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
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM events
     WHERE provider = $1 AND provider_type = $2`,
    ['lezotraffic', t]
  );
  console.log(`  ${t}: ${rows[0].count}`);
}

console.log('\n═══ Deep trace complete ═══');
