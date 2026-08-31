#!/usr/bin/env node
// backend/scripts/cost-audit.js
// READ-ONLY cost audit for TTS pre-generation.
// Shows exactly how many API calls and characters are needed.
// ZERO spend — no ElevenLabs API calls made.

import { pool } from '../supabaseClient.js';
import crypto from 'crypto';

const ELEVENLABS_COST_PER_CHAR = 0.00003;
const TTS_STORAGE_DIR = 'storage/tts-audio';

function textHash(text, voiceId, language, region = 'global') {
  return crypto.createHash('sha256').update(`${region}:${text}:${voiceId}:${language}`).digest('hex');
}

function hasPlaceholders(text) {
  return /\{[^}]+\}/.test(text);
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TTS Pre-Generation Cost Audit');
  console.log('  (READ-ONLY — no API calls, no spend)');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load channel+voice mappings
  const { rows: channels } = await pool.query(`
    SELECT sc.channel_id, sc.region, sc.language, sc.name as channel_name,
           sv.voice_id, sv.style
    FROM station_channels sc
    JOIN station_voices sv ON sv.station_id = sc.station_id AND sv.language = sc.language
    WHERE sc.is_active = true AND sv.is_active = true
    ORDER BY sc.region
  `);

  console.log('Active Channels + Voices:');
  console.log('─────────────────────────────────────────────');
  for (const ch of channels) {
    console.log(`  ${ch.channel_id.padEnd(20)} region=${ch.region.padEnd(12)} lang=${ch.language} voice=${ch.voice_id.substring(0, 12)}...`);
  }
  console.log('');

  // 2. Load content templates
  const { rows: templates } = await pool.query(`
    SELECT id, template_type, language, text_content, length(text_content) as char_count
    FROM content_templates
    WHERE is_active = true
    ORDER BY template_type, language
  `);

  const withPlaceholders = templates.filter(t => hasPlaceholders(t.text_content));
  const withoutPlaceholders = templates.filter(t => !hasPlaceholders(t.text_content));

  console.log(`Content Templates: ${templates.length} total`);
  console.log(`  With placeholders ({...}): ${withPlaceholders.length} (skipped — dynamic)`);
  console.log(`  Without placeholders: ${withoutPlaceholders.length} (can pre-generate)`);
  console.log('');

  if (withPlaceholders.length > 0) {
    console.log('Skipped templates (placeholders):');
    for (const t of withPlaceholders) {
      console.log(`  [${t.language}] ${t.template_type}: "${t.text_content.substring(0, 60)}..."`);
    }
    console.log('');
  }

  // 3. Build generation matrix
  const regionLangMap = new Map();
  for (const ch of channels) {
    const key = `${ch.region}:${ch.language}`;
    if (!regionLangMap.has(key)) {
      regionLangMap.set(key, { region: ch.region, language: ch.language, voiceId: ch.voice_id, channelName: ch.channel_id });
    }
  }

  console.log('═══════════════════════════════════════════════');
  console.log('  Generation Matrix');
  console.log('═══════════════════════════════════════════════\n');

  let totalAssets = 0;
  let totalChars = 0;
  let totalCached = 0;
  let totalMissing = 0;
  let totalCost = 0;

  for (const [key, config] of regionLangMap) {
    const langTemplates = withoutPlaceholders.filter(t => t.language === config.language);

    console.log(`── ${config.channelName} (${config.region} / ${config.language}) ──`);
    console.log(`  Voice: ${config.voiceId}`);
    console.log(`  Templates: ${langTemplates.length}`);

    let regionChars = 0;
    let regionCached = 0;
    let regionMissing = 0;

    for (const template of langTemplates) {
      const hash = textHash(template.text_content, config.voiceId, config.language, config.region);

      // Check cache
      const { rows: cached } = await pool.query(
        'SELECT id, audio_file_size FROM tts_audio_cache WHERE text_hash = $1 AND voice_id = $2 AND language = $3 AND region = $4',
        [hash, config.voiceId, config.language, config.region]
      );

      const isCached = cached.length > 0;
      const chars = template.char_count;

      regionChars += chars;
      if (isCached) {
        regionCached++;
      } else {
        regionMissing++;
      }

      const status = isCached ? 'CACHED' : 'MISSING';
      const cost = isCached ? 0 : chars * ELEVENLABS_COST_PER_CHAR;
      console.log(`    ${status.padEnd(7)} [${template.language}] ${template.template_type.padEnd(20)} ${String(chars).padStart(4)} chars  $${cost.toFixed(4)}`);
    }

    const regionCost = regionMissing * 0; // Will calculate below
    const regionCostEstimate = regionChars * ELEVENLABS_COST_PER_CHAR * (regionMissing / langTemplates.length || 0);

    totalAssets += langTemplates.length;
    totalChars += regionChars;
    totalCached += regionCached;
    totalMissing += regionMissing;

    console.log(`  Subtotal: ${langTemplates.length} assets, ${regionChars} chars, ${regionCached} cached, ${regionMissing} missing`);
    console.log('');
  }

  // 4. Calculate actual missing chars
  let actualMissingChars = 0;
  for (const [key, config] of regionLangMap) {
    const langTemplates = withoutPlaceholders.filter(t => t.language === config.language);
    for (const template of langTemplates) {
      const hash = textHash(template.text_content, config.voiceId, config.language, config.region);
      const { rows: cached } = await pool.query(
        'SELECT id FROM tts_audio_cache WHERE text_hash = $1 AND voice_id = $2 AND language = $3 AND region = $4',
        [hash, config.voiceId, config.language, config.region]
      );
      if (cached.length === 0) {
        actualMissingChars += template.char_count;
      }
    }
  }

  totalCost = actualMissingChars * ELEVENLABS_COST_PER_CHAR;

  // 5. Summary
  console.log('═══════════════════════════════════════════════');
  console.log('  COST AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`  Total unique assets:     ${totalAssets}`);
  console.log(`  Already cached:          ${totalCached} (${totalAssets > 0 ? Math.round(totalCached / totalAssets * 100) : 0}%)`);
  console.log(`  Need generation:         ${totalMissing}`);
  console.log(`  Total characters:        ${totalChars.toLocaleString()}`);
  console.log(`  Missing characters:      ${actualMissingChars.toLocaleString()}`);
  console.log(`  Cost per char:           $${ELEVENLABS_COST_PER_CHAR}`);
  console.log(`  ───────────────────────────────────`);
  console.log(`  ESTIMATED COST:          $${totalCost.toFixed(4)}`);
  console.log(`  DAILY BUDGET:            $${process.env.TTS_DAILY_BUDGET || '1.00'}`);
  console.log(`  Budget remaining after:  $${((parseFloat(process.env.TTS_DAILY_BUDGET || '1.00')) - totalCost).toFixed(4)}`);
  console.log('');

  // 6. Existing cache stats
  const { rows: cacheStats } = await pool.query(`
    SELECT count(*) as total, sum(character_count) as chars, sum(cost_usd) as cost
    FROM tts_audio_cache
  `);
  console.log('  Existing Cache:');
  console.log(`    Entries:    ${cacheStats[0].total}`);
  console.log(`    Characters: ${(cacheStats[0].chars || 0).toLocaleString()}`);
  console.log(`    Spent:      $${parseFloat(cacheStats[0].cost || 0).toFixed(4)}`);
  console.log('');

  if (totalMissing === 0) {
    console.log('  ✅ All assets already cached — nothing to generate');
  } else {
    console.log(`  ⚠️  ${totalMissing} assets need generation — estimated cost $${totalCost.toFixed(4)}`);
  }

  console.log('\n═══════════════════════════════════════════════');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
