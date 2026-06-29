import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchRSSFeed } from './rssFetcher.js';
import { ingestAllFeeds } from './ingestionService.js';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', async (_req, res) => {
    let configuredFeedCount = 0;
    try {
      const { getAllFeedConfigs } = await import('./ingestionService.js');
      configuredFeedCount = (await getAllFeedConfigs()).length;
    } catch {
      configuredFeedCount = 0;
    }

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

  return app;
}

export function startApiServer(port = process.env.PORT || 3001) {
  const app = createApp();

  return app.listen(port, () => {
    console.log(`🌐 Radiolezo API server running on http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/api/health`);
    console.log(`   RSS Proxy: http://localhost:${port}/api/rss/proxy?url=<rss-url>`);
    console.log(`   Trigger Ingestion: POST http://localhost:${port}/api/rss/ingest\n`);
  });
}

// Allow running API-only via `npm run server`
const isMainModule = process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  startApiServer();
}
