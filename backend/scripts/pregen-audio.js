#!/usr/bin/env node
// backend/scripts/pregen-audio.js
// Pre-generate TTS audio for content templates, station IDs, and transitions.
// Supports regional pre-generation: each region+language gets its own audio.
//
// Run: node backend/scripts/pregen-audio.js
// With region: node backend/scripts/pregen-audio.js --region=kinshasa
// Dry run: TTS_DRY_RUN=true node backend/scripts/pregen-audio.js

import { pool } from '../supabaseClient.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const TTS_STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage', 'tts-audio');
const AUDIO_DIR = path.resolve(__dirname, '..', '..', 'storage', 'audio');
const ELEVENLABS_COST_PER_CHAR = 0.00003;

// Parse CLI args
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v || true];
}));

function textHash(text, voiceId, language, region = 'global') {
  return crypto.createHash('sha256').update(`${region}:${text}:${voiceId}:${language}`).digest('hex');
}

async function isCached(text, voiceId, language, region = 'global') {
  const hash = textHash(text, voiceId, language, region);
  const { rows } = await pool.query(
    'SELECT id FROM tts_audio_cache WHERE text_hash = $1 AND voice_id = $2 AND language = $3 AND region = $4',
    [hash, voiceId, language, region]
  );
  if (rows.length === 0) return false;

  // Also check file exists on disk
  const audioPath = path.join(TTS_STORAGE_DIR, `${hash}.mp3`);
  return fs.existsSync(audioPath);
}

async function generateAndSave(text, voiceId, language, region = 'global', contentType = 'template') {
  if (!ELEVENLABS_API_KEY) {
    console.error('  ELEVENLABS_API_KEY not set — cannot generate');
    return false;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        output_format: 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`  API error: ${err.substring(0, 100)}`);
      return false;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const hash = textHash(text, voiceId, language, region);
    const filename = `${hash}.mp3`;

    if (!fs.existsSync(TTS_STORAGE_DIR)) {
      fs.mkdirSync(TTS_STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(TTS_STORAGE_DIR, filename), audioBuffer);

    const audioUrl = `/api/content/storage?bucket=tts-audio&file=${filename}`;
    const costUsd = text.length * ELEVENLABS_COST_PER_CHAR;

    await pool.query(
      `INSERT INTO tts_audio_cache (text_hash, text_content, voice_id, language, region, audio_url, audio_file_size, model_id, character_count, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (region, text_hash, voice_id, language) DO UPDATE SET
         audio_url = EXCLUDED.audio_url,
         audio_file_size = EXCLUDED.audio_file_size,
         hit_count = 0`,
      [hash, text, voiceId, language, region, audioUrl, audioBuffer.length, ELEVENLABS_MODEL, text.length, costUsd]
    );

    console.log(`  Generated: ${filename} (${audioBuffer.length} bytes, $${costUsd.toFixed(4)})`);
    return true;
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  LezoRadio TTS Pre-Generation Library');
  console.log('═══════════════════════════════════════════════\n');

  if (process.env.TTS_DRY_RUN === 'true') {
    console.log('⚠️  TTS_DRY_RUN is enabled — will check cache only, no generation\n');
  }

  // 1. Load voice mappings with region info
  const { rows: channels } = await pool.query(
    "SELECT sc.channel_id, sc.language, sc.region, sc.name, sv.voice_id, sv.style FROM station_channels sc JOIN station_voices sv ON sv.station_id = sc.station_id AND sv.language = sc.language WHERE sc.is_active = true AND sv.is_active = true"
  );
  console.log(`Found ${channels.length} active channel+voice mappings\n`);

  // 2. Load content templates
  const { rows: templates } = await pool.query(
    "SELECT * FROM content_templates WHERE is_active = true ORDER BY template_type, language"
  );
  console.log(`Found ${templates.length} active content templates\n`);

  // 3. Pre-gen for each region+language combination
  let totalGenerated = 0;
  let totalCached = 0;
  let totalFailed = 0;

  // Group channels by region+language
  const regionLangMap = new Map();
  for (const ch of channels) {
    const key = `${ch.region || 'global'}:${ch.language}`;
    if (!regionLangMap.has(key)) {
      regionLangMap.set(key, { region: ch.region || 'global', language: ch.language, voiceId: ch.voice_id });
    }
  }

  for (const [key, config] of regionLangMap) {
    if (args.region && config.region !== args.region) continue;

    console.log(`── Region: ${config.region} / Language: ${config.language} ──`);

    const relevantTemplates = templates.filter(t => t.language === config.language);

    for (const template of relevantTemplates) {
      const text = template.text_content;
      if (!text || text.length < 3) continue;
      if (/\{[^}]+\}/.test(text)) continue; // Skip templates with placeholders (dynamic)

      const alreadyCached = await isCached(text, config.voiceId, config.language, config.region);
      if (alreadyCached) {
        totalCached++;
        continue;
      }

      if (process.env.TTS_DRY_RUN === 'true') {
        console.log(`  [DRY RUN] Would generate: ${template.template_type} (${text.length} chars)`);
        totalCached++;
        continue;
      }

      console.log(`  Generating: ${template.template_type} (${text.length} chars)`);
      const ok = await generateAndSave(text, config.voiceId, config.language, config.region, template.template_type);
      if (ok) totalGenerated++;
      else totalFailed++;

      // Rate limit: 200ms between API calls
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('');
  }

  console.log(`── Summary ──`);
  console.log(`  Channels: ${channels.length}`);
  console.log(`  Region+Language combos: ${regionLangMap.size}`);
  console.log(`  Templates: ${templates.length}`);
  console.log(`  Already cached: ${totalCached}`);
  console.log(`  Generated: ${totalGenerated}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`\n  Estimated cost: $${(totalGenerated * 50 * ELEVENLABS_COST_PER_CHAR).toFixed(4)} (avg ~50 chars/template)`);

  await pool.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
