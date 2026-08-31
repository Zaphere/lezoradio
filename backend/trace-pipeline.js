/**
 * Full pipeline trace: Insert simulated LezoTraffic event → trace through pipeline
 * Also check for any sync errors from incident endpoints.
 */
import { pool } from './supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

// 1. Check sync logs for errors
console.log('═══ SYNC LOGS (last 20) ═══');
const { rows: logs } = await pool.query(
  `SELECT * FROM provider_sync_logs
   ORDER BY created_at DESC
   LIMIT 20`
);

for (const l of (logs || [])) {
  const errInfo = l.errors ? ` ERRORS: ${l.errors.substring(0, 100)}` : '';
  console.log(`  [${l.provider}] ${l.status} endpoint=${l.endpoint || 'all'} fetched=${l.items_fetched} inserted=${l.items_inserted}${errInfo}`);
}

// 2. Insert a simulated LezoTraffic traffic event
console.log('\n═══ INSERTING SIMULATED LezoTraffic EVENT ═══');

const testEvent = {
  provider: 'lezotraffic',
  provider_record_id: `test-sim-${Date.now()}`,
  provider_type: 'incident',
  category: 'traffic',
  subcategory: 'traffic_jam',
  priority: 2,
  title: "Embouteillage massif sur l'avenue Lumumba à Kinshasa",
  summary: "Un embouteillage massif bloque l'avenue Lumumba depuis le carrefour de la gare centrale jusqu'à l'échangeur de l'UNEP. Temps d'attente estimé: 45 minutes. Évitez la zone.",
  description: "Un embouteillage massif bloque l'avenue Lumumba. Les automobilistes signalent des temps d'attente de plus de 45 minutes entre le carrefour de la gare centrale et l'échangeur de l'UNEP.",
  country: 'CD',
  province: 'Kinshasa',
  city: 'Kinshasa',
  latitude: -4.3217,
  longitude: 15.3128,
  status: 'active',
  verified: true,
  language: 'fr',
  metadata: {
    type: 'embouteillage',
    severity: 'high',
    endpoint: '/incidents',
    location: 'Avenue Lumumba, Kinshasa',
  },
  raw_payload: {
    id: 'sim-test-001',
    type: 'embouteillage',
    severity: 'high',
    city: 'Kinshasa',
    description: 'Embouteillage massif avenue Lumumba',
    coordinates: { latitude: -4.3217, longitude: 15.3128 },
  },
  occurred_at: new Date().toISOString(),
};

const cols = Object.keys(testEvent);
const vals = Object.values(testEvent);
const placeholders = cols.map((_, i) => `$${i + 1}`);
const insertQuery = `INSERT INTO events (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

let inserted;
try {
  const { rows } = await pool.query(insertQuery, vals);
  inserted = rows[0];
} catch (insertErr) {
  console.error('Insert failed:', insertErr.message);
  process.exit(1);
}

console.log(`  ✅ Inserted event: ${inserted.id}`);
console.log(`  provider: ${inserted.provider}`);
console.log(`  category: ${inserted.category} / ${inserted.subcategory}`);
console.log(`  priority: ${inserted.priority}`);
console.log(`  location: ${inserted.city}, ${inserted.province}, ${inserted.country}`);
console.log(`  raw_payload: ${inserted.raw_payload ? 'present' : 'MISSING'}`);
console.log(`  metadata: ${JSON.stringify(inserted.metadata)}`);

// 3. Generate script for this event
console.log('\n═══ SCRIPT GENERATION ═══');
const { generateEventScript, generateBroadcastScript } = await import('./providers/scriptGenerator.js');

for (const lang of ['fr', 'en', 'ln', 'sw']) {
  const script = generateEventScript(inserted, lang);
  console.log(`\n  [${lang}] ${script}`);
}

// 4. Generate full bulletin
console.log('\n═══ FULL BULLETIN ═══');
const bulletin = generateBroadcastScript([inserted], 'fr');
console.log(`  Combined: ${bulletin.combined}`);

// 5. Verify the event is queryable by queueManager
console.log('\n═══ QUEUE MANAGER QUERY ═══');
const { computeEffectivePriority } = await import('./engine/constants.js');
const effectivePrio = computeEffectivePriority(inserted);
console.log(`  Effective priority: ${effectivePrio} (LezoTraffic traffic = 1)`);

// 6. Check that source attribution is in the event
console.log('\n═══ SOURCE ATTRIBUTION CHECK ═══');
const hasProvider = !!inserted.provider;
const hasCity = !!inserted.city;
const hasProvince = !!inserted.province;
const hasCategory = !!inserted.category;
const hasSubcategory = !!inserted.subcategory;
const hasSeverity = !!(inserted.metadata?.severity);
const hasRawPayload = !!inserted.raw_payload;

console.log(`  provider: ${hasProvider ? '✅' : '❌'} (${inserted.provider})`);
console.log(`  city: ${hasCity ? '✅' : '❌'} (${inserted.city})`);
console.log(`  province: ${hasProvince ? '✅' : '❌'} (${inserted.province})`);
console.log(`  category: ${hasCategory ? '✅' : '❌'} (${inserted.category})`);
console.log(`  subcategory: ${hasSubcategory ? '✅' : '❌'} (${inserted.subcategory})`);
console.log(`  severity: ${hasSeverity ? '✅' : '❌'} (${inserted.metadata.severity})`);
console.log(`  raw_payload: ${hasRawPayload ? '✅' : '❌'}`);

const allPassed = hasProvider && hasCity && hasProvince && hasCategory && hasSubcategory && hasSeverity && hasRawPayload;
console.log(`\n  ${allPassed ? '🎉 ALL SOURCE ATTRIBUTION FIELDS PRESENT' : '⚠️  SOME FIELDS MISSING'}`);

// 7. Clean up test event
console.log('\n═══ CLEANUP ═══');
try {
  await pool.query('DELETE FROM events WHERE id = $1', [inserted.id]);
  console.log(`  ✅ Test event deleted`);
} catch (delErr) {
  console.log(`  ⚠️  Could not delete test event: ${delErr.message}`);
}

console.log('\n═══ Pipeline trace complete ═══');
