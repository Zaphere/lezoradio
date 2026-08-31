// backend/engine/ttsGenerator.js
// ElevenLabs API integration + local filesystem storage for TTS audio.
// GUARDED: All API calls go through generateTTS() which checks DRY_RUN and budget.
// REGION-AWARE: Cache key includes region to prevent cross-region collisions.

import { supabase } from '../supabaseClient.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const CACHE_BUCKET = 'tts-audio';
const TTS_STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage', 'tts-audio');

// ElevenLabs pricing (per character)
const ELEVENLABS_COST_PER_CHAR = 0.00003; // ~$0.30 per 1K chars for multilingual v2

// Budget guard
const DAILY_BUDGET_USD = parseFloat(process.env.TTS_DAILY_BUDGET || '1.00');
let dailyCostAccum = 0;
let lastResetDate = new Date().toDateString();

function resetBudgetIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    console.log(`[ttsGenerator] Daily budget reset: was $${dailyCostAccum.toFixed(4)}`);
    dailyCostAccum = 0;
    lastResetDate = today;
  }
}

function canSpend(costUsd) {
  resetBudgetIfNeeded();
  if (dailyCostAccum + costUsd > DAILY_BUDGET_USD) {
    console.warn(`[ttsGenerator] BUDGET EXCEEDED: $${dailyCostAccum.toFixed(4)} + $${costUsd.toFixed(4)} > $${DAILY_BUDGET_USD} daily limit`);
    return false;
  }
  return true;
}

/**
 * Conservative spoken duration so the engine never cuts a script short.
 * ~8 chars/sec plus a 5s tail — much slower than typical TTS so the next
 * segment cannot start while the presenter is still talking.
 * IMPORTANT: This is the MINIMUM duration. Real TTS may take longer.
 */
export function estimateSpeechSeconds(text) {
  const chars = (text || '').trim().length;
  return Math.max(12, Math.ceil(chars / 8) + 5);
}

/**
 * Prefer real file length (ElevenLabs 128kbps MP3), never shorter than speech estimate.
 */
export function durationSecondsFromFile(fileSizeBytes, text) {
  const spoken = estimateSpeechSeconds(text);
  if (fileSizeBytes && fileSizeBytes > 2000) {
    const fromBitrate = Math.ceil((fileSizeBytes * 8) / 128000) + 1;
    return Math.max(spoken, fromBitrate);
  }
  return spoken;
}

function durationFromCacheRow(row, text) {
  if (row?.audio_duration_ms && Number(row.audio_duration_ms) > 0) {
    return Math.max(estimateSpeechSeconds(text), Math.ceil(Number(row.audio_duration_ms) / 1000));
  }
  return durationSecondsFromFile(row?.audio_file_size, text);
}

/**
 * Generate a deterministic hash for region + text + voice + language.
 * This is the cache identity — same inputs always produce the same hash.
 */
function textHash(text, voiceId, language, region = 'global') {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(`${region}:${text}:${voiceId}:${language}`).digest('hex');
}

/**
 * Normalize text deterministically for consistent hashing.
 * Strips whitespace, lowercases for comparison, but preserves case for TTS.
 */
export function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Check TTS audio cache in DB.
 * Cache key: region + text_hash + voice_id + language
 */
export async function getCachedAudio(text, voiceId, language, region = 'global') {
  const hash = textHash(text, voiceId, language, region);
  const { data, error } = await supabase
    .from('tts_audio_cache')
    .select('*')
    .eq('text_hash', hash)
    .eq('voice_id', voiceId)
    .eq('language', language)
    .eq('region', region)
    .single();

  if (error || !data) {
    console.log(`[ttsGenerator] CACHE MISS [${region}/${language}] — would call API: ${hash.substring(0,8)}... (${text.length} chars)`);
    return null;
  }

  // Dry-run WAV mocks must not be reused when we are generating real ElevenLabs audio.
  if (process.env.TTS_DRY_RUN !== 'true' && (data.model_id === 'dry-run-mock' || (data.audio_url || '').endsWith('.wav'))) {
    console.log(`[ttsGenerator] CACHE SKIP (dry-run mock) [${region}/${language}] — will call ElevenLabs: ${hash.substring(0,8)}...`);
    return null;
  }

  // Verify the audio file actually exists on disk. The file extension can be
  // .mp3 (real ElevenLabs) or .wav (dry-run mock), so check any file with the
  // hash as its base name.
  if (!fs.existsSync(TTS_STORAGE_DIR)) {
    console.log(`[ttsGenerator] CACHE MISS (dir missing) [${region}/${language}] — would call API: ${hash.substring(0,8)}...`);
    return null;
  }
  const audioFile = fs.readdirSync(TTS_STORAGE_DIR)
    .find(f => f.startsWith(`${hash}.`));
  if (!audioFile) {
    console.warn(`[ttsGenerator] Cache hit but file missing on disk for ${hash}`);
    console.log(`[ttsGenerator] CACHE MISS (file missing) [${region}/${language}] — would call API: ${hash.substring(0,8)}...`);
    return null;
  }

  console.log(`[ttsGenerator] CACHE HIT [${region}/${language}] — would call API: ${hash.substring(0,8)}... (saved ${text.length} chars, file=${audioFile})`);

  // Increment hit count
  try {
    const currentHitCount = typeof data.hit_count === 'number' ? data.hit_count : 0;
    await supabase
      .from('tts_audio_cache')
      .update({ hit_count: currentHitCount + 1, last_used_at: new Date().toISOString() })
      .eq('id', data.id);
  } catch (err) {
    console.warn(`[ttsGenerator] Failed to increment hit count:`, err.message);
  }

  return data;
}

/**
 * Generate a tiny mono WAV file (16-bit PCM) — used ONLY in dry-run mode so the
 * presenter pipeline (translate -> script -> TTS -> cache -> play) is fully
 * verifiable end-to-end without spending ElevenLabs credits.
 *
 * Instead of a harsh 440Hz sine wave, generates a soft, warm tone that sounds
 * more like a gentle notification chime. The tone fades in and out smoothly.
 * @param {string} filename - Target file name (e.g. "<hash>.wav")
 * @param {number} durationSeconds - Approximate playback duration
 */
function writeDryRunWav(filename, durationSeconds) {
  const sampleRate = 8000;
  const durationSamples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = durationSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Soft, warm tone with smooth envelope — sounds like a gentle chime
  // Uses a lower frequency (330Hz = E4 note) for a warmer, less harsh sound
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (0.08 * sampleRate));  // 80ms attack
    const release = Math.min(1, (durationSamples - i) / (0.15 * sampleRate)); // 150ms release
    const envelope = attack * release;
    // Mix two sine waves for a richer, warmer tone
    const sample = 0.25 * envelope * (
      Math.sin(2 * Math.PI * 330 * t) +  // E4 fundamental
      0.3 * Math.sin(2 * Math.PI * 660 * t)  // E5 harmonic (softer)
    );
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * blockAlign);
  }

  fs.writeFileSync(path.join(TTS_STORAGE_DIR, filename), buffer);
}

/**
 * Generate TTS audio via ElevenLabs API.
 * THIS IS THE ONLY FUNCTION THAT SHOULD CALL THE ELEVENLABS API.
 * All other code must go through getOrGenerate() which checks cache first.
 */
export async function generateTTS(text, voiceId, language, region = 'global') {
  // DRY RUN CHECK — never call API when dry run is enabled.
  // Instead generate a cached, playable mock WAV so the full presenter pipeline
  // (cache miss -> generate -> save -> cache -> play) works end-to-end offline.
  if (process.env.TTS_DRY_RUN === 'true') {
    const hash = textHash(text, voiceId, language, region);
    const filename = `${hash}.wav`;
    if (!fs.existsSync(TTS_STORAGE_DIR)) {
      fs.mkdirSync(TTS_STORAGE_DIR, { recursive: true });
    }

    const durationSeconds = estimateSpeechSeconds(text);
    writeDryRunWav(filename, durationSeconds);

    const audioUrl = `/api/content/storage?bucket=tts-audio&file=${filename}`;
    const characterCount = text.length;
    const costUsd = 0; // mock — no real spend

    // Store the script text so frontend can display what would have been spoken
    await supabase
      .from('tts_audio_cache')
      .upsert({
        text_hash: hash,
        text_content: text,
        voice_id: voiceId,
        language,
        region,
        audio_url: audioUrl,
        audio_duration_ms: durationSeconds * 1000,
        audio_file_size: fs.statSync(path.join(TTS_STORAGE_DIR, filename)).size,
        model_id: 'dry-run-mock',
        character_count: characterCount,
        cost_usd: costUsd,
      }, { onConflict: 'region,text_hash,voice_id,language' });

    console.log(`[ttsGenerator] [DRY RUN] Mock voiceover ${filename} (${durationSeconds}s, ${text.length} chars, ${language})`);
    console.log(`[ttsGenerator] [DRY RUN] Script: "${text.substring(0, 120)}${text.length > 120 ? '...' : ''}"`);

    return { audioUrl, hash, durationSeconds };
  }

  if (!ELEVENLABS_API_KEY) {
    console.warn(`[ttsGenerator] ELEVENLABS_API_KEY not set — using dry-run mock for ${text.length} chars`);
    // Auto-enable dry-run mode when API key is missing
    // This ensures the pipeline works end-to-end even without ElevenLabs
    const originalDryRun = process.env.TTS_DRY_RUN;
    process.env.TTS_DRY_RUN = 'true';
    const result = await generateTTS(text, voiceId, language, region);
    process.env.TTS_DRY_RUN = originalDryRun;
    return result;
  }

  // Budget check
  const estimatedCost = text.length * ELEVENLABS_COST_PER_CHAR;
  if (!canSpend(estimatedCost)) {
    console.error(`[${new Date().toISOString()}] [ttsGenerator] Daily budget exceeded, skipping generation`);
    return null;
  }

  try {
    console.log(`[ttsGenerator] CALLING ELEVENLABS API [${region}/${language}]: ${text.length} chars, voice ${voiceId}`);
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
      console.error(`[${new Date().toISOString()}] [ttsGenerator] ElevenLabs API error:`, err.substring(0, 150));
      return null;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const hash = textHash(text, voiceId, language, region);
    const filename = `${hash}.mp3`;

    // Save to local filesystem
    if (!fs.existsSync(TTS_STORAGE_DIR)) {
      fs.mkdirSync(TTS_STORAGE_DIR, { recursive: true });
    }
    const audioPath = path.join(TTS_STORAGE_DIR, filename);
    fs.writeFileSync(audioPath, audioBuffer);
    console.log(`[ttsGenerator] Saved TTS audio: ${filename} (${audioBuffer.length} bytes)`);

    // Get public URL via local proxy
    const audioUrl = `/api/content/storage?bucket=tts-audio&file=${filename}`;

    // Calculate cost tracking
    const characterCount = text.length;
    const costUsd = characterCount * ELEVENLABS_COST_PER_CHAR;
    dailyCostAccum += costUsd;

    const durationSeconds = durationSecondsFromFile(audioBuffer.length, text);

    // Cache in DB with region and cost tracking
    await supabase
      .from('tts_audio_cache')
      .upsert({
        text_hash: hash,
        text_content: text,
        voice_id: voiceId,
        language,
        region,
        audio_url: audioUrl,
        audio_duration_ms: durationSeconds * 1000,
        audio_file_size: audioBuffer.length,
        model_id: ELEVENLABS_MODEL,
        character_count: characterCount,
        cost_usd: costUsd,
      }, { onConflict: 'region,text_hash,voice_id,language' });

    console.log(`[ttsGenerator] Generated TTS [${region}/${language}]: ${characterCount} chars, $${costUsd.toFixed(4)} (~${durationSeconds}s, daily total: $${dailyCostAccum.toFixed(4)}/$${DAILY_BUDGET_USD})`);

    return { audioUrl, hash, durationSeconds };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ttsGenerator] Generation failed:`, err.message);
    return null;
  }
}

/**
 * Get or generate TTS audio.
 * ALWAYS check cache first — only calls generateTTS() on cache miss.
 * Cache key: region + text_hash + voice_id + language
 */
export async function getOrGenerate(text, voiceId, language, region = 'global') {
  // Check cache first
  const cached = await getCachedAudio(text, voiceId, language, region);
  if (cached) {
    return {
      audioUrl: cached.audio_url,
      cached: true,
      durationSeconds: durationFromCacheRow(cached, text),
    };
  }

  // Generate new (goes through budget + dry-run guards)
  const result = await generateTTS(text, voiceId, language, region);
  if (result) {
    return {
      audioUrl: result.audioUrl,
      cached: false,
      durationSeconds: result.durationSeconds || estimateSpeechSeconds(text),
    };
  }

  return null;
}

/**
 * Generate a content hash for change detection.
 * Used to compare normalized bulletin content against previous generation.
 * Returns a stable hash of the sorted, normalized content.
 */
export function contentHash(region, language, eventIds) {
  const sorted = [...eventIds].sort();
  return crypto.createHash('sha256').update(`${region}:${language}:${sorted.join(',')}`).digest('hex');
}
