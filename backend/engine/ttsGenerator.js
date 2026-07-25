// backend/engine/ttsGenerator.js
// ElevenLabs API integration + Supabase Storage for TTS audio.

import { supabase } from '../supabaseClient.js';
import crypto from 'crypto';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const CACHE_BUCKET = 'tts-audio';

/**
 * Generate a hash for text + voice + language combination.
 */
function textHash(text, voiceId, language) {
  return crypto.createHash('sha256').update(`${text}:${voiceId}:${language}`).digest('hex');
}

/**
 * Check TTS audio cache in DB.
 */
export async function getCachedAudio(text, voiceId, language) {
  const hash = textHash(text, voiceId, language);
  const { data, error } = await supabase
    .from('tts_audio_cache')
    .select('*')
    .eq('text_hash', hash)
    .eq('voice_id', voiceId)
    .eq('language', language)
    .single();

  if (error || !data) return null;

  // Increment hit count
  await supabase
    .from('tts_audio_cache')
    .update({ hit_count: data.hit_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

/**
 * Generate TTS audio via ElevenLabs API.
 */
export async function generateTTS(text, voiceId, language) {
  if (!ELEVENLABS_API_KEY) {
    console.error(`[${new Date().toISOString()}] [ttsGenerator] ELEVENLABS_API_KEY not set`);
    return null;
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
      console.error(`[${new Date().toISOString()}] [ttsGenerator] ElevenLabs API error:`, err.substring(0, 150));
      return null;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const hash = textHash(text, voiceId, language);
    const filename = `${hash}.mp3`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(CACHE_BUCKET)
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[${new Date().toISOString()}] [ttsGenerator] Storage upload error:`, uploadError.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(CACHE_BUCKET).getPublicUrl(filename);
    const publicUrl = urlData?.publicUrl;
    const audioUrl = publicUrl ? `/api/content/storage?bucket=tts-audio&file=${filename}` : null;

    if (!audioUrl) {
      console.error(`[${new Date().toISOString()}] [ttsGenerator] Failed to get public URL`);
      return null;
    }

    // Cache in DB
    const hash256 = hash;
    await supabase
      .from('tts_audio_cache')
      .upsert({
        text_hash: hash256,
        text_content: text,
        voice_id: voiceId,
        language,
        audio_url: audioUrl,
        audio_duration_ms: null, // Will be estimated by frontend
        model_id: ELEVENLABS_MODEL,
      }, { onConflict: 'text_hash,voice_id,language' });

    return { audioUrl, hash: hash256 };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ttsGenerator] Generation failed:`, err.message);
    return null;
  }
}

/**
 * Get or generate TTS audio.
 */
export async function getOrGenerate(text, voiceId, language) {
  // Check cache first
  const cached = await getCachedAudio(text, voiceId, language);
  if (cached) {
    return { audioUrl: cached.audio_url, cached: true };
  }

  // Generate new
  const result = await generateTTS(text, voiceId, language);
  if (result) {
    return { audioUrl: result.audioUrl, cached: false };
  }

  return null;
}
