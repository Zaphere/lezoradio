// backend/engine/languageController.js
// Resolves voice ID per channel/language from station_voices and station_channels.
// Handles translation of event content to target language.

import { supabase } from '../supabaseClient.js';
import crypto from 'crypto';

const voiceCache = new Map();

// Supported translation languages
const SUPPORTED_LANGUAGES = new Set(['fr', 'en', 'sw', 'ln']);

// Google Translate free API endpoint
const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

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
 * Generate a hash for translation cache key.
 */
function translationHash(text, sourceLang, targetLang) {
  return crypto.createHash('sha256').update(`${text}:${sourceLang}:${targetLang}`).digest('hex');
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

/**
 * Detect the language of a text string using simple heuristics.
 * Returns a language code or null if uncertain.
 */
export function detectLanguage(text) {
  if (!text || text.length < 10) return null;
  const lower = text.toLowerCase();

  // French markers
  const frMarkers = ['le ', 'la ', 'les ', 'des ', 'une ', 'est ', 'sur ', 'pour ', 'dans ', 'avec ', 'plus ', 'aussi ', 'cette ', 'mais ', 'ou ', 'donc '];
  const frScore = frMarkers.filter(m => lower.includes(m)).length;

  // Lingala markers
  const lnMarkers = ['na ', 'ya ', 'yo ', 'oo ', 'am ', 'nzela ', 'mbula ', 'batu ', 'mwana ', 'mobali ', 'sango ', 'polisi '];
  const lnScore = lnMarkers.filter(m => lower.includes(m)).length;

  // Swahili markers
  const swMarkers = ['wa ', 'ni ', 'ya ', 'kwa ', 'na ', 'katika ', 'habari ', 'taarifa ', ' polisi ', ' barabara ', ' trafik '];
  const swScore = swMarkers.filter(m => lower.includes(m)).length;

  // English markers
  const enMarkers = ['the ', 'and ', 'is ', 'in ', 'of ', 'for ', 'with ', 'on ', 'at ', 'to ', 'from ', 'breaking ', 'news '];
  const enScore = enMarkers.filter(m => lower.includes(m)).length;

  const scores = { fr: frScore, ln: lnScore, sw: swScore, en: enScore };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (best[1] >= 2) return best[0];
  return null;
}

/**
 * Translate text using Google Translate free API.
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (fr, en, sw, ln)
 * @param {string} sourceLang - Source language code (auto-detect if null)
 * @returns {Promise<{text: string, sourceLang: string}|null>}
 */
export async function translateText(text, targetLang, sourceLang = null) {
  if (!text || !text.trim()) return null;
  if (!SUPPORTED_LANGUAGES.has(targetLang)) return null;

  try {
    const sl = sourceLang || 'auto';
    const url = `${GOOGLE_TRANSLATE_URL}?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'LezoRadio/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] [languageController] Translate API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Google Translate returns [[["translated","original",null,null,10]],null,"detected_lang"]
    if (!data || !data[0] || !data[0][0]) return null;

    const translatedText = data[0].map(seg => seg[0]).join('');
    const detectedLang = data[2] || sourceLang || 'unknown';

    return { text: translatedText, sourceLang: detectedLang };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [languageController] Translation failed:`, err.message);
    return null;
  }
}

/**
 * Translate text if needed (different language than target).
 * Checks cache first, then calls API if needed.
 * @param {string} text - Text to potentially translate
 * @param {string} targetLang - Target language code
 * @param {string} sourceLang - Source language (if known)
 * @returns {Promise<{translated: string, cached: boolean, sourceLang: string}|null>}
 */
export async function translateIfNeeded(text, targetLang, sourceLang = null) {
  if (!text || !text.trim()) return { translated: text, cached: false, sourceLang: null };

  // Detect source language if not provided
  const detectedLang = sourceLang || detectLanguage(text);

  // If already in target language, no translation needed
  if (detectedLang === targetLang) {
    return { translated: text, cached: false, sourceLang: detectedLang };
  }

  // Check cache
  const hash = translationHash(text, detectedLang || 'auto', targetLang);
  const cached = await getCachedTranslation(hash, targetLang);
  if (cached) {
    console.log(`[languageController] Translation CACHE HIT: ${detectedLang || '?'}→${targetLang} (${text.substring(0, 40)}...)`);
    return { translated: cached, cached: true, sourceLang: detectedLang };
  }

  // Call translation API
  console.log(`[languageController] Translation CACHE MISS: ${detectedLang || '?'}→${targetLang} (${text.length} chars)`);
  const result = await translateText(text, targetLang, detectedLang);
  if (!result) return { translated: text, cached: false, sourceLang: detectedLang };

  // Cache the result
  const newHash = translationHash(text, result.sourceLang, targetLang);
  await cacheTranslation(newHash, text, result.text, result.sourceLang, targetLang);

  return { translated: result.text, cached: false, sourceLang: result.sourceLang };
}
