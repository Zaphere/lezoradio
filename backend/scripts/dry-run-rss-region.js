#!/usr/bin/env node
// backend/scripts/dry-run-rss-region.js
// Verify RSS → Region pipeline end-to-end with ZERO live API calls.
// Tests: feed config region → normalizer region → event region → queue filter

import { pool } from '../supabaseClient.js';
import { REGIONAL_RSS_FEEDS, GLOBAL_RSS_FEEDS } from '../feeds.config.js';
import { LANGUAGE_FEEDS } from '../feeds.language.config.js';
import { normalizeRSSItem } from '../providers/rss/rssNormalizer.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  RSS → Region Pipeline Dry-Run Verification');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Verify feed config regions
  console.log('1) Feed Config Region Classification');
  const VALID_REGIONS = ['kinshasa', 'goma', 'lubumbashi', 'global'];

  for (const feed of REGIONAL_RSS_FEEDS) {
    assert(`${feed.name} → ${feed.region}`, VALID_REGIONS.includes(feed.region));
  }
  for (const feed of GLOBAL_RSS_FEEDS) {
    assert(`${feed.name} → ${feed.region}`, VALID_REGIONS.includes(feed.region));
  }
  for (const [lang, feeds] of Object.entries(LANGUAGE_FEEDS)) {
    for (const feed of feeds) {
      assert(`[${lang}] ${feed.name} → ${feed.region}`, VALID_REGIONS.includes(feed.region));
    }
  }

  // 2. Verify normalizer stamps region from feed config
  console.log('\n2) Normalizer Region Stamping');
  const mockRssItem = {
    title: 'Test: Embouteillage à Kinshasa',
    description: 'Bloxkage total sur l\'avenue Lumumba',
    link: 'https://example.com/test-1',
    pubDate: new Date().toISOString(),
    isoDate: new Date().toISOString(),
  };

  const testCases = [
    { feed: { name: 'Kinshasa Traffic', url: 'x', region: 'kinshasa', category: 'traffic', language: 'fr' }, expectedRegion: 'kinshasa' },
    { feed: { name: 'Goma Traffic', url: 'x', region: 'goma', category: 'traffic', language: 'fr' }, expectedRegion: 'goma' },
    { feed: { name: 'Lubumbashi Traffic', url: 'x', region: 'lubumbashi', category: 'traffic', language: 'fr' }, expectedRegion: 'lubumbashi' },
    { feed: { name: 'Radio Okapi', url: 'x', region: 'global', category: 'regional', language: 'fr' }, expectedRegion: 'global' },
    { feed: { name: 'Kivu Morning Post', url: 'x', region: 'goma', category: 'local', language: 'fr' }, expectedRegion: 'goma' },
  ];

  for (const tc of testCases) {
    const normalized = normalizeRSSItem(mockRssItem, tc.feed);
    assert(`Normalizer: ${tc.feed.name} → event.region = ${normalized.region}`,
      normalized.region === tc.expectedRegion,
      `got: ${normalized.region}`);
    assert(`Normalizer: ${tc.feed.name} → metadata.feed_region = ${normalized.metadata.feed_region}`,
      normalized.metadata.feed_region === tc.expectedRegion);
  }

  // 3. Verify DB schema has region column
  console.log('\n3) Database Schema');
  const { rows: eventCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'region'
  `);
  assert('events.region column exists', eventCols.length === 1);

  const { rows: channelCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'station_channels' AND column_name = 'region'
  `);
  assert('station_channels.region column exists', channelCols.length === 1);

  const { rows: cacheCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tts_audio_cache' AND column_name = 'region'
  `);
  assert('tts_audio_cache.region column exists', cacheCols.length === 1);

  // 4. Verify channel regions match feed regions
  console.log('\n4) Channel ↔ Feed Region Alignment');
  const { rows: channels } = await pool.query(
    "SELECT channel_id, region, language FROM station_channels WHERE is_active = true"
  );

  const channelRegionMap = {};
  for (const ch of channels) {
    channelRegionMap[ch.channel_id] = ch.region;
  }

  // Kinshasa traffic feed should match kinshasa-main channel
  const ksFeed = REGIONAL_RSS_FEEDS.find(f => f.name === 'Kinshasa Traffic');
  assert('Kinshasa Traffic feed.region matches kinshasa-main channel',
    ksFeed.region === channelRegionMap['kinshasa-main']);

  // Goma traffic feed should match goma-main channel
  const gmFeed = REGIONAL_RSS_FEEDS.find(f => f.name === 'Goma Traffic');
  assert('Goma Traffic feed.region matches goma-main channel',
    gmFeed.region === channelRegionMap['goma-main']);

  // Lubumbashi traffic feed should match lubumbashi-main channel
  const lbFeed = REGIONAL_RSS_FEEDS.find(f => f.name === 'Lubumbashi Traffic');
  assert('Lubumbashi Traffic feed.region matches lubumbashi-main channel',
    lbFeed.region === channelRegionMap['lubumbashi-main']);

  // National feeds should match global-main channel
  const okapiFeed = REGIONAL_RSS_FEEDS.find(f => f.name === 'Radio Okapi');
  assert('Radio Okapi feed.region matches global-main channel',
    okapiFeed.region === channelRegionMap['global-main']);

  // 5. Verify existing events have valid regions
  console.log('\n5) Existing Event Regions');
  const { rows: regionCounts } = await pool.query(
    "SELECT region, count(*) as cnt FROM events WHERE status = 'active' GROUP BY region ORDER BY region"
  );

  for (const row of regionCounts) {
    const regionName = row.region || '(empty)';
    assert(`Events region "${regionName}" is valid`, VALID_REGIONS.includes(row.region) || !row.region);
  }

  // 6. Verify ingestionService mapSourceRegion produces valid regions
  console.log('\n6) Ingestion Service mapSourceRegion');
  // Import the function
  const { mapSourceRegion } = await import('../ingestionService.js').catch(() => ({ mapSourceRegion: null }));

  if (mapSourceRegion) {
    assert('mapSourceRegion("traffic", "Kinshasa Traffic") → kinshasa',
      mapSourceRegion('traffic', 'Kinshasa Traffic') === 'kinshasa');
    assert('mapSourceRegion("traffic", "Goma Traffic") → goma',
      mapSourceRegion('traffic', 'Goma Traffic') === 'goma');
    assert('mapSourceRegion("traffic", "Lubumbashi Traffic") → lubumbashi',
      mapSourceRegion('traffic', 'Lubumbashi Traffic') === 'lubumbashi');
    assert('mapSourceRegion("regional", "Radio Okapi") → global',
      mapSourceRegion('regional', 'Radio Okapi') === 'global');
    assert('mapSourceRegion("global", "BBC Africa") → global',
      mapSourceRegion('global', 'BBC Africa') === 'global');
  } else {
    console.log('  ⚠️  Could not import mapSourceRegion (may be non-exported)');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  Some checks failed — review above');
    process.exit(1);
  } else {
    console.log('\n✅ RSS → Region pipeline verified');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
