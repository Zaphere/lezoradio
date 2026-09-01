import express from 'express';
import cors from 'cors';
import './env.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRSSFeed } from './rssFetcher.js';
import { ingestAllFeeds } from './ingestionService.js';
import { deleteExpiredContent } from './expiryCleanup.js';
import { getRecentLogs, getIngestionSummary } from './ingestionLogger.js';
import { startBulletinSyncServer } from './bulletinSync.js';
import registry from './providers/providerRegistry.js';
import scheduler from './providers/providerScheduler.js';
import healthMonitor from './providers/providerHealthMonitor.js';
import { supabase as serviceSupabase } from './supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist');
const CONTENT_RETENTION_MS = 72 * 60 * 60 * 1000;

function retentionCutoff() {
  return new Date(Date.now() - CONTENT_RETENTION_MS).toISOString();
}

function normalizeNewsCategory(rawCategory, preferredCategory) {
  const normalized = (rawCategory || '').toLowerCase();
  if (!normalized) return (preferredCategory || 'regional');
  if (['local', 'regional', 'global', 'traffic', 'alert'].includes(normalized)) return normalized;
  if (normalized === 'emergency') return 'alert';
  return 'regional';
}

function getCategoryQueryValues(category) {
  const ALL_CATEGORIES = ['news', 'global', 'regional', 'local', 'traffic', 'alert', 'weather', 'agriculture', 'business', 'sports', 'geo', 'security', 'emergency', 'transport', 'event', 'government', 'health', 'tourism'];
  if (!category) return ALL_CATEGORIES;
  const norm = category.toLowerCase();
  switch (norm) {
    case 'regional': return ['regional', 'local', 'news'];
    case 'global': return ['global', 'news'];
    case 'traffic': return ['traffic'];
    case 'alert': return ['alert', 'emergency'];
    case 'local': return ['local', 'regional', 'news'];
    default: return [norm];
  }
}

async function getNewsContent(region, category) {
  const categoriesToQuery = getCategoryQueryValues(category);

  const eventsPromise = (async () => {
    let q = serviceSupabase
      .from('events')
      .select('id, provider, title, summary, description, metadata, province, country, category, priority, city, occurred_at, created_at, status')
      .gte('created_at', retentionCutoff())
      .in('category', categoriesToQuery)
      .order('created_at', { ascending: false })
      .limit(50);
    if (region) q = q.eq('province', region);
    const { data, error } = await q;
    if (error) {
      console.warn('[getNewsContent] events query failed:', error.message);
      return [];
    }
    return (data || []).map((event) => ({
      id: event.id,
      feed_id: event.provider,
      provider: event.provider,
      title: event.title,
      description: event.summary || '',
      content: event.description || '',
      url: event.metadata?.url || '',
      region: event.province || event.country || 'global',
      category: normalizeNewsCategory(event.category, category),
      priority: event.priority,
      city: event.city || event.metadata?.city,
      province: event.province,
      published_at: event.occurred_at || event.created_at,
      ingested_at: event.created_at,
      is_processed: event.status !== 'active',
    }));
  })();

  const newsPromise = (async () => {
    let q = serviceSupabase
      .from('news_items')
      .select('id, feed_id, title, description, content, url, region, category, published_at, ingested_at, is_processed')
      .gte('ingested_at', retentionCutoff())
      .in('category', categoriesToQuery)
      .order('ingested_at', { ascending: false })
      .limit(50);
    if (region) {
      const isDrcRegion = ['kinshasa', 'goma', 'lubumbashi'].includes(region);
      if (isDrcRegion) {
        q = q.in('region', [region, 'congo']);
      } else {
        q = q.eq('region', region);
      }
    }
    const { data, error } = await q;
    if (error) {
      console.warn('[getNewsContent] news_items query failed:', error.message);
      return [];
    }
    return (data || []).map((item) => ({
      id: item.id,
      feed_id: item.feed_id,
      title: item.title,
      description: item.description || '',
      content: item.content || '',
      url: item.url || '',
      region: item.region || 'global',
      category: normalizeNewsCategory(item.category, category),
      published_at: item.published_at || item.ingested_at,
      ingested_at: item.ingested_at,
      is_processed: item.is_processed || false,
    }));
  })();

  const [mapped, mappedNews] = await Promise.all([eventsPromise, newsPromise]);

  const seen = new Set();
  const merged = [...mappedNews];
  for (const item of merged) seen.add(item.title?.substring(0, 100) || item.id);
  for (const item of mapped) {
    const key = item.title?.substring(0, 100) || item.id;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged.sort((a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime());
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve built frontend static files
  app.use(express.static(distPath));

  // Health check
  app.get('/api/health', async (_req, res) => {
    let configuredFeedCount = 0;
    try {
      const { getAllFeedConfigs } = await import('./ingestionService.js');
      configuredFeedCount = (await getAllFeedConfigs()).length;
    } catch {
      configuredFeedCount = 0;
    }

    const providerFrameworkEnabled = process.env.USE_PROVIDER_FRAMEWORK === 'true';
    const providers = providerFrameworkEnabled ? registry.getAll() : [];

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbConfigured: !!process.env.DB_HOST,
      configuredFeedCount,
      feedsConfigured: {
        eswatini: !!process.env.RSS_FEEDS_ESWATINI,
        southAfrica: !!process.env.RSS_FEEDS_SOUTH_AFRICA,
        congo: !!process.env.RSS_FEEDS_CONGO,
        traffic: !!process.env.RSS_FEEDS_TRAFFIC,
        tech: !!process.env.RSS_FEEDS_TECH,
      },
      schedule: process.env.INGESTION_SCHEDULE || '*/15 * * * *',
      providerFramework: {
        enabled: providerFrameworkEnabled,
        providers: providers.map(p => ({
          id: p.providerId,
          enabled: p.enabled,
          initialized: p.initialized,
          authenticated: p.authenticated,
          capabilities: typeof p.getCapabilities === 'function' ? p.getCapabilities() : null,
        })),
      },
    });
  });

  app.get('/api/content/news', async (req, res) => {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const since = typeof req.query.since === 'string' ? req.query.since : undefined;

      if (since) {
        // Polling endpoint — return items newer than `since`
        const cutoff = new Date(since);
        if (isNaN(cutoff.getTime())) {
          return res.status(400).json({ error: 'Invalid since parameter' });
        }
        const { data, error } = await serviceSupabase
          .from('events')
          .select('*')
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json(data || []);
      }

      const items = await getNewsContent(region, category);
      res.json(items);
    } catch (err) {
      console.error('Failed to load content proxy news:', err);
      res.status(500).json({ error: err.message || 'Failed to load news items' });
    }
  });

  // Storage proxy — serves local files from the storage directory
  const LOCAL_STORAGE_DIR = path.resolve(__dirname, '..', 'storage');

  app.get('/api/content/storage', async (req, res) => {
    try {
      const file = typeof req.query.file === 'string' ? req.query.file : '';
      const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : 'tts-audio';
      const dir = typeof req.query.dir === 'string' ? req.query.dir : bucket;
      if (!file) return res.status(400).json({ error: 'Missing file parameter' });

      // Try local file first — check both dir and bucket subdirectories
      const candidates = [
        path.join(LOCAL_STORAGE_DIR, dir, file),
        path.join(LOCAL_STORAGE_DIR, bucket, file),
      ];
      for (const localPath of candidates) {
        if (fs.existsSync(localPath)) {
          const ext = path.extname(file).toLowerCase();
          const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.flac': 'audio/flac',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return fs.createReadStream(localPath).pipe(res);
        }
      }

      return res.status(404).json({ error: 'File not found' });
    } catch (err) {
      console.error('Failed to proxy storage file:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch file' });
    }
  });

  app.get('/api/content/stations', async (_req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
        .order('priority')
        .order('name');

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('Failed to load content proxy stations:', err);
      res.status(500).json({ error: err.message || 'Failed to load stations' });
    }
  });

  // Now-playing proxy — bypasses RLS by using service-role key
  app.get('/api/content/now-playing', async (req, res) => {
    try {
      const channelId = typeof req.query.channel_id === 'string' ? req.query.channel_id : undefined;
      if (!channelId) {
        return res.status(400).json({ error: 'Missing channel_id query parameter' });
      }

      const { data, error } = await serviceSupabase
        .from('radio_station_state')
        .select('*')
        .eq('channel_id', channelId)
        .maybeSingle();

      if (error) throw error;

      let payload = data || null;
      try {
        const { getEngine } = await import('./engine/radioEngine.js');
        const engine = getEngine();
        const bed = engine?.channels?.get(channelId)?.backgroundUrl;
        if (payload && bed) {
          payload = { ...payload, background_audio_url: bed };
        }
      } catch {
        // Engine not loaded yet — return DB row as-is
      }

      console.log(`[now-playing] channel_id=${channelId} → ${payload ? 'FOUND (type=' + payload.segment_type + ', title=' + (payload.title || '').substring(0, 40) + ')' : 'NULL'}`);
      res.json(payload);
    } catch (err) {
      console.error('Failed to load now-playing state:', err);
      res.status(500).json({ error: err.message || 'Failed to load now-playing state' });
    }
  });

  // Skip to next content — triggers engine dispatch for a channel
  app.post('/api/radio/skip', async (req, res) => {
    try {
      const channelId = req.body?.channel_id || req.query.channel_id;
      if (!channelId) {
        return res.status(400).json({ error: 'Missing channel_id' });
      }

      const { getEngine } = await import('./engine/radioEngine.js');
      const engine = getEngine();
      if (!engine || !engine.running) {
        return res.status(503).json({ error: 'Engine not running' });
      }

      // Cancel any pending natural-end timer and dispatch immediately
      const existing = engine.pendingTimers.get(channelId);
      if (existing) clearTimeout(existing);
      engine.pendingTimers.delete(channelId);

      engine.dispatchNextContent(channelId, false).catch(err => {
        console.error(`[skip] dispatchNextContent failed for ${channelId}:`, err.message);
      });

      res.json({ ok: true, channel_id: channelId });
    } catch (err) {
      console.error('Skip failed:', err);
      res.status(500).json({ error: err.message || 'Skip failed' });
    }
  });

  // Diagnostic: list all rows in radio_station_state
  app.get('/api/debug/radio-state', async (_req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('radio_station_state')
        .select('channel_id, segment_type, title, version, started_at');
      if (error) throw error;
      res.json({ rows: data || [], count: (data || []).length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Diagnostic: list station_channels
  app.get('/api/debug/channels', async (_req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('station_channels')
        .select('id, station_id, channel_id, name, language, is_active, frequency');
      if (error) throw error;
      res.json({ rows: data || [], count: (data || []).length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Seed station_channels + voices + clean stale radio_station_state data
  app.post('/api/debug/seed', async (_req, res) => {
    try {
      // Step 1: Find DR Congo station
      const { data: station, error: stErr } = await serviceSupabase
        .from('stations')
        .select('id, name, country_code')
        .eq('country_code', 'CD')
        .eq('name', 'DR Congo')
        .maybeSingle();
      if (stErr) throw stErr;
      if (!station) return res.status(404).json({ error: 'DR Congo station not found in stations table' });

      // Step 2: Seed voices into station_voices
      const voices = [
        { voice_id: 'uTB2ynnsQgtJDou6IulW', language: 'ln', gender: 'male', style: 'formal', is_primary: true, desc: 'Lingala — Kinshasa' },
        { voice_id: '2tSJpap7gXlgDV2bauu0', language: 'sw', gender: 'female', style: 'formal', is_primary: true, desc: 'Swahili Female — Goma / Lubumbashi' },
        { voice_id: '3IyGWZwOTNraZr1Tz0fI', language: 'fr', gender: 'male', style: 'bulletin', is_primary: true, desc: 'Adam French — News bulletins' },
        { voice_id: '3IyGWZwOTNraZr1Tz0fI', language: 'fr', gender: 'male', style: 'alert', is_primary: true, desc: 'Adam French — Alerts' },
      ];
      let voicesInserted = 0;
      for (const v of voices) {
        const { error: insErr } = await serviceSupabase
          .from('station_voices')
          .upsert({
            station_id: station.id,
            voice_id: v.voice_id,
            language: v.language,
            gender: v.gender,
            style: v.style,
            is_primary: v.is_primary,
          }, { onConflict: 'station_id,language,voice_id' });
        if (insErr) {
          console.error(`[seed] Failed to upsert voice ${v.voice_id}:`, insErr.message);
        } else {
          voicesInserted++;
        }
      }

      // Step 3: Check if station_channels already has DRC data
      const { data: existing } = await serviceSupabase
        .from('station_channels')
        .select('channel_id')
        .in('channel_id', ['kinshasa-main', 'goma-main', 'lubumbashi-main', 'global-main']);
      const existingIds = new Set((existing || []).map(r => r.channel_id));

      // Build voice map: language -> voice_id
      const voiceMap = {};
      for (const v of voices) {
        voiceMap[v.language] = v.voice_id;
      }

      const channels = [
        { channel_id: 'kinshasa-main', name: 'Kinshasa Main', lang: 'ln', freq: 88.1, emoji: '🇨🇩', desc: 'Primary Kinshasa broadcast channel in Lingala', priority: 1 },
        { channel_id: 'goma-main', name: 'Goma Main', lang: 'sw', freq: 92.5, emoji: '🌋', desc: 'Primary Goma broadcast channel in Swahili', priority: 1 },
        { channel_id: 'lubumbashi-main', name: 'Lubumbashi Main', lang: 'sw', freq: 95.3, emoji: '⛏️', desc: 'Primary Lubumbashi broadcast channel in Swahili', priority: 1 },
        { channel_id: 'global-main', name: 'Global Main', lang: 'fr', freq: 94.1, emoji: '🌍', desc: 'Global news and entertainment channel', priority: 1 },
      ];

      let inserted = 0;
      for (const ch of channels) {
        if (existingIds.has(ch.channel_id)) continue;
        const { error: insErr } = await serviceSupabase
          .from('station_channels')
          .insert({
            station_id: station.id,
            channel_id: ch.channel_id,
            name: ch.name,
            description: ch.desc,
            frequency: ch.freq,
            emoji: ch.emoji,
            language: ch.lang,
            primary_voice_id: voiceMap[ch.lang] || null,
            is_active: true,
            priority: ch.priority,
          });
        if (insErr) {
          console.error(`[seed] Failed to insert ${ch.channel_id}:`, insErr.message);
        } else {
          inserted++;
        }
      }

      // Step 4: Clean stale UUID-based radio_station_state rows
      const { data: staleRows } = await serviceSupabase
        .from('radio_station_state')
        .select('channel_id');
      const validIds = new Set(['kinshasa-main', 'goma-main', 'lubumbashi-main', 'global-main']);
      const staleIds = (staleRows || []).filter(r => !validIds.has(r.channel_id)).map(r => r.channel_id);
      let deleted = 0;
      if (staleIds.length > 0) {
        for (let i = 0; i < staleIds.length; i += 50) {
          const batch = staleRows.slice(i, i + 50);
          const { error: delErr } = await serviceSupabase
            .from('radio_station_state')
            .delete()
            .in('channel_id', batch.map(r => r.channel_id));
          if (!delErr) deleted += batch.length;
        }
      }

      res.json({ station: station.name, station_id: station.id, voices_inserted: voicesInserted, channels_inserted: inserted, stale_deleted: deleted, voice_map: voiceMap });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger manual ingestion
  app.post('/api/rss/ingest', async (_req, res) => {
    try {
      console.log('\n🔄 Manual ingestion triggered via API');
      const results = await ingestAllFeeds();
      res.json({ success: true, results });
    } catch (err) {
      console.error('Manual ingestion failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Manual expiry trigger
  app.post('/api/content/expire', async (_req, res) => {
    try {
      const dryRun = _req.query.dry === 'true';
      const results = await deleteExpiredContent(dryRun);
      res.json({ success: true, dryRun, ...results });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Ingestion logs
  app.get('/api/ingestion/logs', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || null;
    const logs = await getRecentLogs(limit, status);
    res.json({ logs, count: logs.length });
  });

  // Ingestion summary
  app.get('/api/ingestion/summary', async (_req, res) => {
    const summary = await getIngestionSummary();
    res.json(summary);
  });

  // RSS proxy — fetches a feed and returns parsed items (no CORS)
  app.get('/api/rss/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing "url" query parameter' });
      return;
    }

    try {
      const items = await fetchRSSFeed(url);

      res.json({
        ok: true,
        status: 200,
        items,
        itemCount: items.length,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        status: 502,
        error: err.message || 'Failed to fetch RSS feed',
      });
    }
  });

  // Provider health endpoint
  app.get('/api/providers', async (_req, res) => {
    try {
      const healthStatus = await registry.getHealthStatus();
      res.json(healthStatus);
    } catch (err) {
      console.error('Failed to get provider health:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Manual provider sync endpoint
  app.post('/api/providers/:providerId/sync', async (req, res) => {
    const { providerId } = req.params;
    
    try {
      console.log(`\n🔄 Manual sync triggered for provider: ${providerId}`);
      const result = await scheduler.manualSync(providerId);
      res.json({ success: true, result });
    } catch (err) {
      console.error(`Manual sync failed for ${providerId}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sync all providers endpoint
  app.post('/api/providers/sync', async (_req, res) => {
    try {
      console.log('\n🔄 Manual sync triggered for all providers');
      const results = await scheduler.syncAll();
      res.json({ success: true, results });
    } catch (err) {
      console.error('Manual sync failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Provider configuration endpoint
  app.get('/api/providers/:providerId/config', async (req, res) => {
    const { providerId } = req.params;
    
    try {
      const provider = registry.get(providerId);
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      
      res.json({
        provider: provider.providerId,
        enabled: provider.enabled,
        config: provider.config,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provider sync logs endpoint
  app.get('/api/providers/:providerId/logs', async (req, res) => {
    const { providerId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    try {
      const { getProviderSyncLogs } = await import('./supabaseClient.js');
      const logs = await getProviderSyncLogs(providerId, limit);
      res.json({ logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provider events endpoint
  app.get('/api/providers/:providerId/events', async (req, res) => {
    const { providerId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    try {
      const { getProviderEvents } = await import('./supabaseClient.js');
      const events = await getProviderEvents(providerId, limit);
      res.json({ events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provider capabilities endpoint
  app.get('/api/providers/capabilities', async (_req, res) => {
    try {
      const capabilities = registry.getAllCapabilities();
      res.json(capabilities);
    } catch (err) {
      console.error('Failed to get provider capabilities:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Single provider capabilities endpoint
  app.get('/api/providers/:providerId/capabilities', async (req, res) => {
    const { providerId } = req.params;

    try {
      const capabilities = registry.getCapabilities(providerId);
      if (!capabilities) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      res.json(capabilities);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Aggregated provider health endpoint
  app.get('/api/providers/health/aggregate', async (_req, res) => {
    try {
      const aggregatedHealth = await healthMonitor.getAggregatedHealth();
      res.json(aggregatedHealth);
    } catch (err) {
      console.error('Failed to get aggregated health:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Frontend Data API Endpoints ─────────────────────────────────────────

  // Radio scripts
  app.get('/api/content/radio-scripts', async (req, res) => {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      let q = serviceSupabase
        .from('radio_scripts')
        .select('*')
        .eq('is_read', false)
        .gte('created_at', retentionCutoff())
        .order('created_at', { ascending: true })
        .limit(50);
      if (region) q = q.eq('region', region);
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      res.json((data || []).map(row => ({ ...row, script: row.script || row.script_text || '' })));
    } catch (err) {
      console.error('Failed to load radio scripts:', err);
      res.status(500).json({ error: err.message || 'Failed to load radio scripts' });
    }
  });

  // Broadcast queue
  app.get('/api/content/broadcast-queue', async (req, res) => {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      let q = serviceSupabase
        .from('broadcast_queue')
        .select('*')
        .eq('is_played', false)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (region) q = q.eq('region', region);
      const { data, error } = await q;
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('Failed to load broadcast queue:', err);
      res.status(500).json({ error: err.message || 'Failed to load broadcast queue' });
    }
  });

  // Alerts
  app.get('/api/content/alerts', async (req, res) => {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      let q = serviceSupabase
        .from('alerts')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', retentionCutoff())
        .order('created_at', { ascending: false });
      if (region) q = q.eq('region', region);
      const { data, error } = await q;
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      res.status(500).json({ error: err.message || 'Failed to load alerts' });
    }
  });

  // Feeds
  app.get('/api/content/feeds', async (_req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('feeds')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('Failed to load feeds:', err);
      res.status(500).json({ error: err.message || 'Failed to load feeds' });
    }
  });

  // Content sources
  app.get('/api/content/sources', async (_req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('content_sources')
        .select('*')
        .eq('enabled', true)
        .order('priority');
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('Failed to load content sources:', err);
      res.status(500).json({ error: err.message || 'Failed to load content sources' });
    }
  });

  // TTS cache check — for browser TTS to check before calling ElevenLabs
  app.get('/api/tts/cache-check', async (req, res) => {
    try {
      const { text, voice_id, language } = req.query;
      if (!text || !voice_id || !language) {
        return res.json({ cached: false });
      }

      const crypto = await import('crypto');
      const hash = crypto.default.createHash('sha256').update(`${text}:${voice_id}:${language}`).digest('hex');

      const { data, error } = await serviceSupabase
        .from('tts_audio_cache')
        .select('audio_url')
        .eq('text_hash', hash)
        .eq('voice_id', voice_id)
        .eq('language', language)
        .single();

      if (error || !data) {
        return res.json({ cached: false });
      }

      // Verify file exists on disk
      const fs = await import('fs');
      const path = await import('path');
      const audioPath = path.default.join(process.cwd(), 'storage', 'tts-audio', `${hash}.mp3`);
      if (!fs.default.existsSync(audioPath)) {
        return res.json({ cached: false });
      }

      res.json({ cached: true, audioUrl: data.audio_url });
    } catch (err) {
      res.json({ cached: false });
    }
  });

  // Station sources (with join)
  app.get('/api/content/station-sources', async (req, res) => {
    try {
      const stationId = typeof req.query.station_id === 'string' ? req.query.station_id : undefined;
      if (!stationId) return res.json([]);
      const { data, error } = await serviceSupabase
        .from('station_sources')
        .select('priority, content_sources(*)')
        .eq('station_id', stationId)
        .eq('enabled', true)
        .order('priority');
      if (error) throw error;
      const results = [];
      for (const row of data || []) {
        const joined = row.content_sources;
        const source = (Array.isArray(joined) ? joined[0] : joined);
        if (source) results.push({ ...source, priority: row.priority ?? source.priority });
      }
      res.json(results);
    } catch (err) {
      console.error('Failed to load station sources:', err);
      res.status(500).json({ error: err.message || 'Failed to load station sources' });
    }
  });

  // Station by ID
  app.get('/api/content/stations/:id', async (req, res) => {
    try {
      const { data, error } = await serviceSupabase
        .from('stations')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Station not found' });
      res.json(data);
    } catch (err) {
      console.error('Failed to load station:', err);
      res.status(500).json({ error: err.message || 'Failed to load station' });
    }
  });

  // Mark news item as processed
  app.post('/api/content/mark-processed', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await serviceSupabase
        .from('events')
        .update({ status: 'processed' })
        .eq('id', id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to mark processed:', err);
      res.status(500).json({ error: err.message || 'Failed to mark processed' });
    }
  });

  // Mark script as read
  app.post('/api/content/mark-script-read', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await serviceSupabase
        .from('radio_scripts')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to mark script read:', err);
      res.status(500).json({ error: err.message || 'Failed to mark script read' });
    }
  });

  // Update source health
  app.post('/api/content/source-health', async (req, res) => {
    try {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await serviceSupabase
        .from('content_sources')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to update source health:', err);
      res.status(500).json({ error: err.message || 'Failed to update source health' });
    }
  });

  // SPA catch-all — serve index.html for all non-API/WS routes
  app.get('*path', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return;
    res.sendFile(path.join(distPath, 'index.html'));
  });

  return app;
}

export function startApiServer(port = process.env.PORT || 3001) {
  const app = createApp();
  const server = http.createServer(app);

  startBulletinSyncServer(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${port} is already in use — API server skipped (another instance is running).\n`);
      // Don't crash — the existing server process will handle API requests.
    } else {
      console.error(`[server] Unexpected error:`, err.message);
    }
  });

  server.listen(port, () => {
    console.log(`🌐 Radiolezo API server running on http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/api/health`);
    console.log(`   RSS Proxy: http://localhost:${port}/api/rss/proxy?url=<rss-url>`);
    console.log(`   Trigger Ingestion: POST http://localhost:${port}/api/rss/ingest`);
    console.log(`   Bulletin Sync WS: ws://localhost:${port}/ws/bulletin\n`);
  });

  return server;
}

// Allow running API-only via `npm run server`
const isMainModule = process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  startApiServer();
}
