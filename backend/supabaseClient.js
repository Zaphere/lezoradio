import pg from 'pg';
import './env.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lezoradio',
  user: process.env.DB_USER || 'lezoradio_app',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

// ============================================================================
// Query Builder — mimics Supabase JS client API
// ============================================================================

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._selectColumns = '*';
    this._conditions = [];
    this._params = [];
    this._paramIndex = 1;
    this._orderBy = [];
    this._limitVal = null;
    this._offsetVal = null;
    this._single = false;
    this._maybeSingle = false;
    this._insertData = null;
    this._updateData = null;
    this._deleteMode = false;
    this._countOnly = false;
    this._countHead = false;
    this._inConditions = [];
    this._orConditions = [];
    this._isNotNull = null;
    this._isNull = null;
    this._notEqConditions = [];
  }

  select(columns = '*', options = {}) {
    this._selectColumns = columns;
    if (options.count === 'exact') {
      this._countOnly = true;
      this._countHead = options.head === true;
    }
    return this;
  }

  eq(column, value) {
    this._conditions.push(`${column} = $${this._paramIndex}`);
    this._params.push(value);
    this._paramIndex++;
    return this;
  }

  neq(column, value) {
    this._notEqConditions.push({ column, value });
    return this;
  }

  gt(column, value) {
    this._conditions.push(`${column} > $${this._paramIndex}`);
    this._params.push(value);
    this._paramIndex++;
    return this;
  }

  gte(column, value) {
    this._conditions.push(`${column} >= $${this._paramIndex}`);
    this._params.push(value);
    this._paramIndex++;
    return this;
  }

  lt(column, value) {
    this._conditions.push(`${column} < $${this._paramIndex}`);
    this._params.push(value);
    this._paramIndex++;
    return this;
  }

  lte(column, value) {
    this._conditions.push(`${column} <= $${this._paramIndex}`);
    this._params.push(value);
    this._paramIndex++;
    return this;
  }

  in(column, values) {
    if (!values || values.length === 0) {
      this._conditions.push('FALSE');
      return this;
    }
    const placeholders = values.map((v, i) => {
      this._params.push(v);
      return `$${this._paramIndex++}`;
    });
    this._conditions.push(`${column} IN (${placeholders.join(', ')})`);
    return this;
  }

  ilike(column, pattern) {
    this._conditions.push(`${column} ILIKE $${this._paramIndex}`);
    this._params.push(pattern);
    this._paramIndex++;
    return this;
  }

  or(condition) {
    // Simple OR support: "col.is.null,col.eq.value"
    const parts = condition.split(',').map(p => p.trim());
    const orParts = [];
    for (const part of parts) {
      const match = part.match(/^(\w+)\.is\.(null)$/);
      if (match) {
        orParts.push(`${match[1]} IS NULL`);
        continue;
      }
      const eqMatch = part.match(/^(\w+)\.eq\.(.+)$/);
      if (eqMatch) {
        this._params.push(eqMatch[2]);
        orParts.push(`${eqMatch[1]} = $${this._paramIndex++}`);
        continue;
      }
    }
    if (orParts.length > 0) {
      this._orConditions.push(`(${orParts.join(' OR ')})`);
    }
    return this;
  }

  is(column, value) {
    if (value === null) {
      this._conditions.push(`${column} IS NULL`);
    } else {
      this._conditions.push(`${column} IS NOT NULL`);
    }
    return this;
  }

  order(column, options = {}) {
    const dir = options.ascending === false ? 'DESC' : 'ASC';
    this._orderBy.push(`${column} ${dir}`);
    return this;
  }

  limit(count) {
    this._limitVal = count;
    return this;
  }

  range(from, to) {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  single() {
    this._single = true;
    this._limitVal = 1;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    this._limitVal = 1;
    return this;
  }

  insert(data) {
    this._insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this._updateData = data;
    return this;
  }

  delete() {
    this._deleteMode = true;
    return this;
  }

  upsert(data, options = {}) {
    this._insertData = Array.isArray(data) ? data : [data];
    this._upsertMode = true;
    this._onConflict = options.onConflict || null;
    return this;
  }

  // Execute the query
  async then(resolve, reject) {
    try {
      const result = await this._execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }

  async _execute() {
    if (this._insertData) return this._executeInsert();
    if (this._updateData) return this._executeUpdate();
    if (this._deleteMode) return this._executeDelete();
    return this._executeSelect();
  }

  _buildWhereClause() {
    const conditions = [...this._conditions];
    if (this._orConditions.length > 0) {
      conditions.push(`(${this._orConditions.join(' OR ')})`);
    }
    if (this._notEqConditions.length > 0) {
      for (const { column, value } of this._notEqConditions) {
        conditions.push(`${column} != $${this._paramIndex}`);
        this._params.push(value);
        this._paramIndex++;
      }
    }
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  async _executeSelect() {
    const where = this._buildWhereClause();
    const orderClause = this._orderBy.length > 0 ? `ORDER BY ${this._orderBy.join(', ')}` : '';
    const limitClause = this._limitVal ? `LIMIT ${this._limitVal}` : '';
    const offsetClause = this._offsetVal ? `OFFSET ${this._offsetVal}` : '';

    if (this._countOnly) {
      const sql = `SELECT COUNT(*) as count FROM ${this._table} ${where}`;
      const result = await pool.query(sql, this._params);
      const count = parseInt(result.rows[0].count);
      if (this._countHead) {
        return { data: null, error: null, count };
      }
      return { data: null, error: null, count };
    }

    // Handle column selections with joins (e.g., "priority, content_sources(*)")
    const selectCols = this._selectColumns;
    let sql;
    let data;

    if (selectCols.includes('(*)')) {
      // Handle join-style selects (simplified: just select from main table)
      sql = `SELECT * FROM ${this._table} ${where} ${orderClause} ${limitClause} ${offsetClause}`;
      const result = await pool.query(sql, this._params);
      data = result.rows;
    } else {
      sql = `SELECT ${selectCols} FROM ${this._table} ${where} ${orderClause} ${limitClause} ${offsetClause}`;
      const result = await pool.query(sql, this._params);
      data = result.rows;
    }

    if (this._single) {
      if (data.length === 0) return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
      return { data: data[0], error: null };
    }
    if (this._maybeSingle) {
      return { data: data.length > 0 ? data[0] : null, error: null };
    }
    return { data, error: null };
  }

  async _executeInsert() {
    const rows = this._insertData;
    if (!rows || rows.length === 0) return { data: null, error: null };

    const results = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const placeholders = keys.map((_, i) => `$${i + 1}`);

      let sql;
      if (this._upsertMode && this._onConflict) {
        // Build ON CONFLICT clause
        const conflictCols = this._onConflict.split(',').map(c => c.trim());
        const updateCols = keys.filter(k => !conflictCols.includes(k));
        const updateClause = updateCols.length > 0
          ? `ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`
          : `ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`;
        sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) ${updateClause} RETURNING *`;
      } else {
        sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      }

      try {
        const result = await pool.query(sql, values);
        results.push(result.rows[0] || null);
      } catch (err) {
        if (err.code === '23505') {
          // Unique constraint violation
          return { data: null, error: { code: '23505', message: err.detail || err.message } };
        }
        return { data: null, error: { code: err.code, message: err.message } };
      }
    }

    if (this._single || this._maybeSingle) {
      return { data: results[0] || null, error: null };
    }
    return { data: results, error: null };
  }

  async _executeUpdate() {
    const data = this._updateData;
    const keys = Object.keys(data);
    const values = Object.values(data);
    // SET placeholders use $1..$k. The WHERE placeholders were baked by the
    // builder as $1..$n, so shift them forward by the number of SET columns to
    // keep them in sync with the final [...values, ...this._params] parameter order.
    const offset = keys.length;
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const where = this._buildWhereClause().replace(/\$(\d+)/g, (m, d) => `$${parseInt(d, 10) + offset}`);

    const sql = `UPDATE ${this._table} SET ${setClause} ${where} RETURNING *`;
    const result = await pool.query(sql, [...values, ...this._params]);

    if (this._single || this._maybeSingle) {
      return { data: result.rows[0] || null, error: null };
    }
    return { data: result.rows, error: null };
  }

  async _executeDelete() {
    const where = this._buildWhereClause();
    const sql = `DELETE FROM ${this._table} ${where} RETURNING *`;
    const result = await pool.query(sql, this._params);
    return { data: result.rows, error: null };
  }
}

// ============================================================================
// Storage mock — local filesystem storage for dev
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_ROOT = path.resolve(__dirname, '..', 'storage');

class StorageBucket {
  constructor(bucketName) {
    this._bucket = bucketName;
    this._dir = path.join(STORAGE_ROOT, bucketName);
  }

  async list(filePath = '', options = {}) {
    try {
      if (!fs.existsSync(this._dir)) return { data: [], error: null };
      const entries = fs.readdirSync(this._dir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith('.'))
        .map(e => {
          const stat = fs.statSync(path.join(this._dir, e.name));
          return { name: e.name, created_at: stat.mtime.toISOString(), metadata: {} };
        });
      return { data: files, error: null };
    } catch (err) {
      console.warn(`[storage] List ${this._bucket} error:`, err.message);
      return { data: [], error: null };
    }
  }

  async upload(filePath, data, options = {}) {
    try {
      const dir = path.dirname(path.join(this._dir, filePath));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      fs.writeFileSync(path.join(this._dir, filePath), buffer);
      console.log(`[storage] Saved ${this._bucket}/${filePath} (${buffer.length} bytes)`);
      return { data: { path: filePath }, error: null };
    } catch (err) {
      console.error(`[storage] Upload ${this._bucket}/${filePath} failed:`, err.message);
      return { data: null, error: { message: err.message } };
    }
  }

  getPublicUrl(filePath) {
    const url = `/api/content/storage?bucket=${this._bucket}&file=${encodeURIComponent(filePath)}`;
    return { data: { publicUrl: url } };
  }
}

class Storage {
  from(bucket) {
    return new StorageBucket(bucket);
  }
}

// ============================================================================
// Channel mock — for Supabase Realtime compatibility
// ============================================================================

class RealtimeChannel {
  constructor() {
    this._listeners = [];
  }

  on(event, filter, callback) {
    // Realtime not implemented with pg — log and continue
    console.warn(`[realtime] Channel subscription skipped (local dev): ${filter.table}`);
    return this;
  }

  subscribe(callback) {
    if (callback) callback('SUBSCRIBED');
    return this;
  }
}

class Realtime {
  channel(name) {
    return new RealtimeChannel();
  }

  removeChannel(channel) {
    return Promise.resolve();
  }
}

// ============================================================================
// Main Supabase-compatible client
// ============================================================================

export const supabase = {
  from(table) {
    return new QueryBuilder(table);
  },
  storage: new Storage(),
  channel(name) {
    return new RealtimeChannel();
  },
  removeChannel(channel) {
    return Promise.resolve();
  },
};

// ============================================================================
// Export pool for direct queries
// ============================================================================

export { pool };

/**
 * Execute a raw SQL query.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Test the database connection.
 */
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now');
    console.log('[db] Connected to PostgreSQL at:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    return false;
  }
}

// ============================================================================
// Schema capability detection (cached)
// ============================================================================
const schemaCapabilities = {
  newsItemsHasLanguage: true,
  newsItemsHasIsTranslated: true,
  newsItemsHasTranslationRequired: true,
  feedsHasLanguage: true,
  ingestionLogsHasDurationMs: true,
};

// All columns exist in our local schema — skip detection
console.log('[supabaseClient] Using local PostgreSQL — schema capabilities all TRUE');

// ============================================================================
// Data access functions (unchanged API — now using pg under the hood)
// ============================================================================

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
      language: language || 'fr',
      is_translated: false,
      translation_required: false,
    };

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
    if (language) {
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
    if (!feedId) {
      console.warn('Skipping feed last_fetched update: feedId is null/undefined');
      return;
    }
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('feeds')
      .update({ last_fetched_at: timestamp })
      .eq('id', feedId);

    if (error) {
      console.error('Error updating feed last fetched:', error.message);
      console.error('Feed ID:', feedId, 'Timestamp:', timestamp);
    }
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
    console.error('Error inserting radio script:', error.message?.substring(0, 200));
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
    console.error('Error inserting content source:', error.message?.substring(0, 200));
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

function safeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

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
      region: event.region || 'global',
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
      occurred_at: safeTimestamp(event.occurred_at || event.created_at),
      expires_at: safeTimestamp(event.expires_at),
      created_at: event.created_at || new Date().toISOString(),
      updated_at: event.updated_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('events')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return null;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.code === '23505') return null;
    console.error('Error inserting event:', error.message.substring(0, 100));
    return null;
  }
}

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

export async function logProviderSync(syncData) {
  try {
    const payload = {
      provider: syncData.provider,
      endpoint: syncData.endpoint || null,
      status: syncData.status,
      items_fetched: syncData.items_fetched || 0,
      items_inserted: syncData.items_inserted || 0,
      items_updated: syncData.items_updated || 0,
      items_skipped: syncData.items_skipped || 0,
      duration_ms: syncData.duration_ms || 0,
      errors: syncData.errors ? String(syncData.errors).substring(0, 2000) : null,
    };

    const { error } = await supabase.from('provider_sync_logs').insert(payload);

    if (error) {
      console.error('Error logging provider sync:', error.message);
    }
  } catch (err) {
    console.error('Error logging provider sync:', err.message);
  }
}

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
