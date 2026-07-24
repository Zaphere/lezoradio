// backend/engine/languageController.js
// Resolves voice ID per channel/language from station_voices and station_channels.

import { supabase } from '../supabaseClient.js';

const voiceCache = new Map();

/**
 * Load all active voice mappings from DB.
 */
export async function loadVoices() {
  const { data, error } = await supabase
    .from('station_voices')
    .select('*');

  if (error) {
    console.error(`[${new Date().toISOString()}] [languageController] Failed to load voices:`, error.message);
    return [];
  }

  voiceCache.clear();
  for (const voice of data) {
    const key = `${voice.station_id}:${voice.language}:${voice.style || 'default'}`;
    voiceCache.set(key, voice);
  }
  return data;
}

/**
 * Resolve voice for a given channel.
 * @param {string} stationId - Station UUID
 * @param {string} language - Language code (e.g. 'fr', 'ln', 'sw')
 * @param {string} style - Voice style (e.g. 'news', 'bulletin')
 * @returns {object|null} Voice config with voice_id, language, style, etc.
 */
export function resolveVoice(stationId, language, style = 'default') {
  const key = `${stationId}:${language}:${style}`;
  if (voiceCache.has(key)) return voiceCache.get(key);

  // Fallback: try default style
  const fallbackKey = `${stationId}:${language}:default`;
  if (voiceCache.has(fallbackKey)) return voiceCache.get(fallbackKey);

  // Fallback: try any style for this language
  for (const [k, v] of voiceCache) {
    if (k.startsWith(`${stationId}:${language}:`)) return v;
  }

  return null;
}

/**
 * Check if translation is cached.
 */
export async function getCachedTranslation(textHash, targetLang) {
  const { data } = await supabase
    .from('translation_cache')
    .select('translated_text')
    .eq('text_hash', textHash)
    .eq('target_language', targetLang)
    .single();

  return data?.translated_text || null;
}

/**
 * Cache a translation.
 */
export async function cacheTranslation(textHash, sourceText, translatedText, sourceLang, targetLang) {
  const { error } = await supabase
    .from('translation_cache')
    .upsert({
      text_hash: textHash,
      source_text: sourceText,
      translated_text: translatedText,
      source_language: sourceLang,
      target_language: targetLang,
    }, { onConflict: 'text_hash,source_language,target_language' });

  if (error && error.code !== '23505') {
    console.error(`[${new Date().toISOString()}] [languageController] Failed to cache translation:`, error.message);
  }
}
