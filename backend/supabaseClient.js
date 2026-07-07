import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

// ============================================================================
// Schema capability detection (cached)
// Probes which optional columns exist on key tables so we can avoid
// inserting fields that haven't been migrated yet.
// ============================================================================
const schemaCapabilities = {
  newsItemsHasLanguage: null,
  newsItemsHasIsTranslated: null,
  newsItemsHasTranslationRequired: null,
  feedsHasLanguage: null,
  ingestionLogsHasDurationMs: null,
};

async function detectSchemaCapabilities() {
  // Probe news_items
  const { data: ni } = await supabase.from('news_items').select('language').limit(1);
  schemaCapabilities.newsItemsHasLanguage = ni !== null;

  const { data: ni2 } = await supabase.from('news_items').select('is_translated').limit(1);
  schemaCapabilities.newsItemsHasIsTranslated = ni2 !== null;

  const { data: ni3 } = await supabase.from('news_items').select('translation_required').limit(1);
  schemaCapabilities.newsItemsHasTranslationRequired = ni3 !== null;

  const { data: f } = await supabase.from('feeds').select('language').limit(1);
  schemaCapabilities.feedsHasLanguage = f !== null;

  const { data: il } = await supabase.from('ingestion_logs').select('duration_ms').limit(1);
  schemaCapabilities.ingestionLogsHasDurationMs = il !== null;

  console.log('[supabaseClient] Schema capabilities detected:', schemaCapabilities);
  if (!schemaCapabilities.newsItemsHasLanguage) {
    console.warn('[supabaseClient] ⚠️  Missing column: news_items.language — run pending migrations in Supabase SQL editor');
  }
  if (!schemaCapabilities.newsItemsHasIsTranslated) {
    console.warn('[supabaseClient] ⚠️  Missing column: news_items.is_translated — run pending migrations in Supabase SQL editor');
  }
  if (!schemaCapabilities.feedsHasLanguage) {
    console.warn('[supabaseClient] ⚠️  Missing column: feeds.language — run pending migrations in Supabase SQL editor');
  }
  if (!schemaCapabilities.ingestionLogsHasDurationMs) {
    console.warn('[supabaseClient] ⚠️  Missing column: ingestion_logs.duration_ms — run pending migrations in Supabase SQL editor');
  }
}

// Run detection once at startup (fire-and-forget, non-blocking)
detectSchemaCapabilities().catch(err => {
  console.warn('[supabaseClient] Schema detection failed:', err.message);
});

export async function insertNewsItem(item, feedId, region, category, language = null) {
  try {
    // Dedup by URL
    if (item.url) {
      const { data: existing } = await supabase
        .from('news_items')
        .select('id')
        .eq('url', item.url)
        .maybeSingle();

      if (existing) {
        return null;
      }
    }

    // Dedup by title + published_at window
    if (item.title && item.published_at) {
      const pubDate = new Date(item.published_at).toISOString().substring(0, 16);
      const { data: existingByTitle } = await supabase
        .from('news_items')
        .select('id')
        .eq('title', item.title.substring(0, 200))
        .gte('published_at', pubDate)
        .lte('published_at', new Date(new Date(item.published_at).getTime() + 60000).toISOString())
        .maybeSingle();

      if (existingByTitle) {
        return null;
      }
    }

    const insertData = {
      feed_id: feedId,
      title: item.title,
      description: item.description,
      content: item.content,
      url: item.url,
      region: region,
      category: category,
      published_at: item.published_at,
      ingested_at: new Date().toISOString(),
      is_processed: false,
    };

    // Only include columns that exist in the current DB schema
    if (schemaCapabilities.newsItemsHasLanguage !== false) {
      insertData.language = language || 'fr';
    }
    if (schemaCapabilities.newsItemsHasIsTranslated !== false) {
      insertData.is_translated = false;
    }
    if (schemaCapabilities.newsItemsHasTranslationRequired !== false) {
      insertData.translation_required = false;
    }

    const { data, error } = await supabase
      .from('news_items')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error.code === '23505') {
      return null;
    }
    console.error('Error inserting news item:', error.message.substring(0, 150));
    return null;
  }
}

export async function getOrCreateFeed(name, url, region, category, language = null) {
  try {
    const { data: existing } = await supabase
      .from('feeds')
      .select('id')
      .eq('url', url)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const insertData = {
      name,
      url,
      region: region || 'global',
      category: category || 'global',
      type: 'rss',
      is_active: true,
      last_fetched_at: new Date().toISOString(),
    };
    // Only include language column if the DB has it
    if (language && schemaCapabilities.feedsHasLanguage !== false) {
      insertData.language = language;
    }

    const { data, error } = await supabase
      .from('feeds')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    console.log(`Created new feed: ${name}`);
    return data.id;
  } catch (error) {
    console.error('Error getting/creating feed:', error.message);
    return null;
  }
}

export async function updateFeedLastFetched(feedId) {
  try {
    const { error } = await supabase
      .from('feeds')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', feedId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating feed last fetched:', error.message);
  }
}

export async function fetchActiveContentSources() {
  try {
    const { data, error } = await supabase
      .from('content_sources')
      .select('*')
      .eq('enabled', true)
      .order('priority');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching content sources:', error.message);
    return [];
  }
}

export async function insertRadioScript(newsItemId, scriptText, region, category) {
  try {
    const { data, error } = await supabase
      .from('radio_scripts')
      .insert({
        news_item_id: newsItemId,
        script: scriptText,
        script_text: scriptText,
        type: 'news',
        region: region || 'global',
        category: category || 'global',
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error.code === '23505') return null;
    return null;
  }
}

export async function insertContentSource(source) {
  try {
    const { data, error } = await supabase
      .from('content_sources')
      .insert({
        name: source.name,
        url: source.url,
        type: 'rss',
        category: source.category || 'news',
        priority: source.priority || 5,
        enabled: source.active !== false,
        translation_required: source.translation_required || false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error.code === '23505') return null;
    return null;
  }
}

export async function backfillMissingRadioScripts(buildScript) {
  try {
    const { data: newsItems, error } = await supabase
      .from('news_items')
      .select('id, title, description, content, region, category')
      .order('ingested_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    let count = 0;
    for (const item of newsItems || []) {
      const { data: existing } = await supabase
        .from('radio_scripts')
        .select('id')
        .eq('news_item_id', item.id)
        .maybeSingle();

      if (existing) continue;

      const scriptText = buildScript(item);
      const created = await insertRadioScript(
        item.id,
        scriptText,
        item.region || 'global',
        item.category || 'global'
      );
      if (created) count++;
    }

    if (count > 0) {
      console.log(`Backfilled ${count} missing radio scripts`);
    }
    return count;
  } catch (error) {
    console.error('Error backfilling radio scripts:', error.message);
    return 0;
  }
}

// ============================================================================
// Generic Provider Framework Functions
// ============================================================================

/**
 * Insert a unified event from any provider
 * Handles deduplication using provider + provider_record_id unique constraint
 * @param {Object} event - Normalized event object
 * @returns {Promise<Object|null>} Inserted event data or null if duplicate
 */
export async function insertEvent(event) {
  try {
    const insertData = {
      provider: event.provider,
      provider_record_id: event.provider_record_id || event.provider_event_id,
      provider_type: event.provider_type || null,
      category: event.category || 'news',
      subcategory: event.subcategory || null,
      priority: event.priority != null ? event.priority : 5,
      title: event.title,
      summary: event.summary || null,
      description: event.description || null,
      country: event.country || 'CD',
      province: event.province || null,
      city: event.city || null,
      latitude: event.latitude || null,
      longitude: event.longitude || null,
      status: event.status || 'active',
      verified: event.verified || false,
      language: event.language || 'fr',
      metadata: event.metadata || {},
      raw_payload: event.raw_payload || {},
      raw_payload_version: event.raw_payload_version != null ? event.raw_payload_version : 1,
      api_version: event.api_version || null,
      occurred_at: event.occurred_at || event.created_at || null,
      expires_at: event.expires_at || null,
      created_at: event.created_at || new Date().toISOString(),
      updated_at: event.updated_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('events')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - event already exists
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (error.code === '23505') {
      return null;
    }
    console.error('Error inserting event:', error.message.substring(0, 100));
    return null;
  }
}

/**
 * Update an existing event
 * @param {string} eventId - Event UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated event data or null
 */
export async function updateEvent(eventId, updates) {
  try {
    const { data, error } = await supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating event:', error.message.substring(0, 100));
    return null;
  }
}

/**
 * Get or create provider configuration
 * @param {string} providerId - Provider identifier
 * @returns {Promise<Object|null>} Provider config or null
 */
export async function getProviderConfig(providerId) {
  try {
    const { data, error } = await supabase
      .from('provider_configs')
      .select('*')
      .eq('provider', providerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting provider config:', error.message);
    return null;
  }
}

/**
 * Update provider configuration
 * @param {string} providerId - Provider identifier
 * @param {Object} config - Configuration updates
 * @returns {Promise<Object|null>} Updated config or null
 */
export async function updateProviderConfig(providerId, config) {
  try {
    const { data, error } = await supabase
      .from('provider_configs')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('provider', providerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating provider config:', error.message);
    return null;
  }
}

/**
 * Log a provider sync operation
 * @param {Object} syncData - Sync operation data
 * @returns {Promise<void>}
 */
export async function logProviderSync(syncData) {
  try {
    const { error } = await supabase.from('provider_sync_logs').insert({
      provider: syncData.provider,
      endpoint: syncData.endpoint || null,
      status: syncData.status,
      items_fetched: syncData.items_fetched || 0,
      items_inserted: syncData.items_inserted || 0,
      items_updated: syncData.items_updated || 0,
      items_skipped: syncData.items_skipped || 0,
      duration_ms: syncData.duration_ms || 0,
      errors: syncData.errors ? String(syncData.errors).substring(0, 2000) : null,
    });

    if (error) {
      console.error('Error logging provider sync:', error.message);
    }
  } catch (err) {
    console.error('Error logging provider sync:', err.message);
  }
}

/**
 * Get recent sync logs for a provider
 * @param {string} providerId - Provider identifier
 * @param {number} limit - Number of logs to retrieve
 * @returns {Promise<Array>} Array of sync logs
 */
export async function getProviderSyncLogs(providerId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('provider_sync_logs')
      .select('*')
      .eq('provider', providerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting provider sync logs:', error.message);
    return [];
  }
}

/**
 * Get recent events from a provider
 * @param {string} providerId - Provider identifier
 * @param {number} limit - Number of events to retrieve
 * @returns {Promise<Array>} Array of events
 */
export async function getProviderEvents(providerId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('provider', providerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting provider events:', error.message);
    return [];
  }
}
