/**
 * Test: LezoTraffic Pipeline End-to-End
 *
 * Simulates a LezoTraffic event, generates scripts, and verifies
 * the full pipeline: events → script generation → priority ordering.
 *
 * Usage: node backend/test-lezotraffic-pipeline.js
 *
 * This script does NOT require a live database — it tests the
 * scriptGenerator and priority computation directly.
 */

import {
  generateEventScript,
  generateBulletinIntro,
  generateStationIdText,
  generateTimeAnnouncement,
  generateCombinedScript,
  generateBroadcastScript,
} from './providers/scriptGenerator.js';

import {
  computeEffectivePriority,
  PROVIDER_PRIORITY,
  CATEGORY_PRIORITY,
} from './engine/constants.js';

// ── Simulated LezoTraffic Events ──────────────────────────────────────────

const LEZOTRAFFIC_EVENTS = [
  {
    id: 'lt-001',
    provider: 'lezotraffic',
    provider_record_id: 'lt-api-001',
    provider_type: 'incident',
    category: 'traffic',
    subcategory: 'traffic_jam',
    priority: 2,
    title: 'Embouteillage massif sur l\'avenue Lumumba',
    summary: 'Un embouteillage massif bloque l\'avenue Lumumba depuis le carrefour de la gare centrale jusqu\'à l\'échangeur de l\'UNEP. Temps d\'attente estimé: 45 minutes.',
    description: 'Un embouteillage massif bloque l\'avenue Lumumba...',
    country: 'CD',
    province: 'Kinshasa',
    city: 'Kinshasa',
    status: 'active',
    verified: true,
    language: 'fr',
    created_at: new Date().toISOString(),
  },
  {
    id: 'lt-002',
    provider: 'lezotraffic',
    provider_record_id: 'lt-api-002',
    provider_type: 'alert',
    category: 'security',
    subcategory: 'barricade',
    priority: 1,
    title: 'Barricade signalée au rond-point de l\'Échangeur',
    summary: 'Des manifestants ont érigé une barricade au rond-point de l\'Échangeur. Police sur place. Circulation détournée.',
    country: 'CD',
    province: 'Kinshasa',
    city: 'Kinshasa',
    status: 'active',
    verified: true,
    language: 'fr',
    created_at: new Date().toISOString(),
  },
  {
    id: 'lt-003',
    provider: 'lezotraffic',
    provider_record_id: 'lt-api-003',
    provider_type: 'incident',
    category: 'traffic',
    subcategory: 'accident',
    priority: 3,
    title: 'Accident de circulation sur la Route Nationale 1',
    summary: 'Un accident impliquant deux véhicules a eu lieu sur la RN1 à la hauteur de Kinkole. Un blessé signalé.',
    country: 'CD',
    province: 'Kinshasa',
    city: 'Kinkole',
    status: 'active',
    verified: false,
    language: 'fr',
    created_at: new Date().toISOString(),
  },
];

const RSS_EVENTS = [
  {
    id: 'rss-001',
    provider: 'rss',
    category: 'news',
    subcategory: null,
    priority: 4,
    title: 'Le Président lance un nouveau programme d\'infrastructures',
    summary: 'Le Président de la République a lancé ce mardi un vaste programme de construction d\'infrastructures routières dans la province du Haut-Katanga.',
    country: 'CD',
    province: 'Haut-Katanga',
    city: 'Lubumbashi',
    status: 'active',
    language: 'fr',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rss-002',
    provider: 'rss',
    category: 'news',
    subcategory: null,
    priority: 5,
    title: 'Conférence sur le climat à Kinshasa',
    summary: 'Une conférence internationale sur le changement climatique se tient à Kinshasa cette semaine.',
    country: 'CD',
    province: 'Kinshasa',
    city: 'Kinshasa',
    status: 'active',
    language: 'fr',
    created_at: new Date().toISOString(),
  },
];

// ── Test Functions ────────────────────────────────────────────────────────

function testPriorityComputation() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 1: Priority Computation (Provider + Category)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allEvents = [...LEZOTRAFFIC_EVENTS, ...RSS_EVENTS];
  const prioritized = allEvents
    .map(e => ({
      id: e.id,
      provider: e.provider,
      category: e.category,
      title: e.title.substring(0, 50),
      effective_priority: computeEffectivePriority(e),
      db_priority: e.priority,
    }))
    .sort((a, b) => a.effective_priority - b.effective_priority);

  console.log('Provider priorities:', PROVIDER_PRIORITY);
  console.log('Category priorities:', CATEGORY_PRIORITY);
  console.log('\nSorted by effective priority (lower = plays first):\n');

  for (const item of prioritized) {
    console.log(`  [${item.effective_priority}] ${item.provider}/${item.category} — "${item.title}..."`);
  }

  // Verify LezoTraffic events outrank RSS
  const ltMin = Math.min(...LEZOTRAFFIC_EVENTS.map(e => computeEffectivePriority(e)));
  const rssMin = Math.min(...RSS_EVENTS.map(e => computeEffectivePriority(e)));
  console.log(`\n  LezoTraffic best priority: ${ltMin}`);
  console.log(`  RSS best priority: ${rssMin}`);

  if (ltMin < rssMin) {
    console.log('  ✅ PASS: LezoTraffic events outrank RSS events\n');
  } else {
    console.log('  ❌ FAIL: LezoTraffic events do NOT outrank RSS events\n');
  }

  return ltMin < rssMin;
}

function testScriptGeneration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 2: Script Generation (All languages)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const languages = ['fr', 'en', 'sw', 'ln'];
  let allPassed = true;

  for (const lang of languages) {
    console.log(`--- Language: ${lang} ---`);
    for (const event of LEZOTRAFFIC_EVENTS) {
      const script = generateEventScript(event, lang);
      const hasContent = script.length > 10;
      const hasProvider = script.includes('LezoTraffic');
      const hasCity = script.includes(event.city);
      const status = hasContent ? '✅' : '❌';

      console.log(`  ${status} [${event.category}/${event.subcategory}] ${script.substring(0, 120)}...`);
      if (!hasContent) allPassed = false;
    }
    console.log('');
  }

  if (allPassed) {
    console.log('  ✅ PASS: All scripts generated successfully\n');
  } else {
    console.log('  ❌ FAIL: Some scripts failed\n');
  }

  return allPassed;
}

function testBulletinIntro() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 3: Bulletin Intro Generation');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const intro = generateBulletinIntro('fr', 'Radio Lezo Kinshasa', 5);
  console.log(`  French: ${intro}`);
  const introEn = generateBulletinIntro('en', 'Radio Lezo Kinshasa', 5);
  console.log(`  English: ${introEn}`);
  console.log('');

  return intro.length > 5 && introEn.length > 5;
}

function testStationId() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 4: Station ID Text');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fr = generateStationIdText('fr', 'Radio Lezo Kinshasa');
  const en = generateStationIdText('en', 'Radio Lezo Kinshasa');
  const ln = generateStationIdText('ln', 'Radio Lezo Kinshasa');
  console.log(`  FR: ${fr}`);
  console.log(`  EN: ${en}`);
  console.log(`  LN: ${ln}`);
  console.log('');

  return fr.includes('Radio Lezo Kinshasa') && en.includes('Radio Lezo Kinshasa');
}

function testTimeAnnouncement() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 5: Time Announcement');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fr = generateTimeAnnouncement('fr', 14, 30);
  const en = generateTimeAnnouncement('en', 14, 30);
  console.log(`  FR: ${fr}`);
  console.log(`  EN: ${en}`);
  console.log('');

  return fr.includes('14') && en.includes('14:30');
}

function testCombinedScript() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 6: Combined Bulletin Script');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allEvents = [...LEZOTRAFFIC_EVENTS, ...RSS_EVENTS];
  const result = generateBroadcastScript(allEvents, 'fr');

  console.log(`  Event count: ${result.event_count}`);
  console.log(`  Combined script length: ${result.combined.length} chars`);
  console.log(`\n  Combined script:\n  ${result.combined}\n`);
  console.log(`  Per-event breakdown:`);
  for (const e of result.events) {
    console.log(`    [${e.provider}/${e.category}] ${e.script.substring(0, 100)}...`);
  }
  console.log('');

  return result.combined.length > 50;
}

// ── Run All Tests ─────────────────────────────────────────────────────────

console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   LezoTraffic Pipeline Test Suite                            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\n');

const results = {
  priority: testPriorityComputation(),
  scripts: testScriptGeneration(),
  bulletinIntro: testBulletinIntro(),
  stationId: testStationId(),
  timeAnnouncement: testTimeAnnouncement(),
  combinedScript: testCombinedScript(),
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('RESULTS SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

let allPassed = true;
for (const [test, passed] of Object.entries(results)) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} — ${test}`);
  if (!passed) allPassed = false;
}

console.log('');
if (allPassed) {
  console.log('  🎉 All tests passed! LezoTraffic pipeline is functional.\n');
  process.exit(0);
} else {
  console.log('  ⚠️  Some tests failed. Review output above.\n');
  process.exit(1);
}
