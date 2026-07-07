import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
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

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist');

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
      supabaseConfigured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
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

  return server.listen(port, () => {
    console.log(`🌐 Radiolezo API server running on http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/api/health`);
    console.log(`   RSS Proxy: http://localhost:${port}/api/rss/proxy?url=<rss-url>`);
    console.log(`   Trigger Ingestion: POST http://localhost:${port}/api/rss/ingest`);
    console.log(`   Bulletin Sync WS: ws://localhost:${port}/ws/bulletin\n`);
  });
}

// Allow running API-only via `npm run server`
const isMainModule = process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  startApiServer();
}
