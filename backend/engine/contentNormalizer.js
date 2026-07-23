// backend/engine/contentNormalizer.js
// Reads provider_taxonomy and normalizer_config from DB to classify/normalize content.

import { supabase } from '../supabaseClient.js';

const taxonomyCache = new Map();
const configCache = new Map();

/**
 * Load all active taxonomy mappings from DB.
 */
export async function loadTaxonomy() {
  const { data, error } = await supabase
    .from('provider_taxonomy')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error(`[${new Date().toISOString()}] [contentNormalizer] Failed to load taxonomy:`, error.message);
    return [];
  }

  taxonomyCache.clear();
  for (const tax of data) {
    const key = `${tax.taxonomy_type}:${tax.provider}:${tax.source_key}`;
    taxonomyCache.set(key, tax.target_value);
  }
  return data;
}

/**
 * Load all normalizer config from DB.
 */
export async function loadNormalizerConfig() {
  const { data, error } = await supabase
    .from('normalizer_config')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error(`[${new Date().toISOString()}] [contentNormalizer] Failed to load config:`, error.message);
    return [];
  }

  configCache.clear();
  for (const cfg of data) {
    configCache.set(`${cfg.config_key}`, cfg.config_value);
  }
  return data;
}

/**
 * Map a provider-specific category to a unified category.
 */
export function mapCategory(provider, sourceCategory) {
  const key = `category:${provider}:${sourceCategory}`;
  if (taxonomyCache.has(key)) return taxonomyCache.get(key);

  // Fallback: lowercase and clean
  return sourceCategory?.toLowerCase().replace(/\s+/g, '_') || 'uncategorized';
}

/**
 * Map a provider-specific incident type to a unified type.
 */
export function mapIncidentType(provider, sourceType) {
  const key = `incident_type:${provider}:${sourceType}`;
  if (taxonomyCache.has(key)) return taxonomyCache.get(key);
  return sourceType || 'unknown';
}

/**
 * Get a normalizer config value.
 */
export function getConfig(key) {
  return configCache.get(key) || null;
}

/**
 * Normalize a news item from a provider into unified format.
 */
export function normalizeItem(provider, rawItem) {
  return {
    provider,
    provider_record_id: rawItem.id || rawItem.provider_record_id,
    category: mapCategory(provider, rawItem.category),
    subcategory: rawItem.subcategory || null,
    priority: rawItem.priority || 5,
    title: rawItem.title || '',
    summary: rawItem.summary || rawItem.description?.substring(0, 200) || null,
    description: rawItem.description || rawItem.content || null,
    country: (rawItem.country || 'CD').toUpperCase(),
    province: rawItem.province || null,
    city: rawItem.city || null,
    latitude: rawItem.latitude || null,
    longitude: rawItem.longitude || null,
    status: rawItem.status || 'active',
    verified: rawItem.verified || false,
    language: rawItem.language || 'fr',
    metadata: rawItem.metadata || null,
    raw_payload: rawItem,
  };
}

/**
 * Refresh all caches.
 */
export async function refreshCache() {
  await Promise.all([loadTaxonomy(), loadNormalizerConfig()]);
  console.log(`[${new Date().toISOString()}] [contentNormalizer] Cache refreshed: ${taxonomyCache.size} taxonomy, ${configCache.size} config`);
}
