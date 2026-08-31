# Radiolezo Backend Service

RSS feed ingestion service and API for the Radiolezo radio system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=radiolezo
DB_USER=postgres
DB_PASSWORD=your-db-password

RSS_FEEDS_ESWATINI=https://example.com/eswatini-feed.xml
RSS_FEEDS_SOUTH_AFRICA=https://example.com/south-africa-feed.xml
RSS_FEEDS_CONGO=https://example.com/congo-feed.xml
RSS_FEEDS_TRAFFIC=https://example.com/traffic-feed.xml
RSS_FEEDS_TECH=https://example.com/tech-feed.xml

INGESTION_SCHEDULE=*/15 * * * *
PORT=3001
```

## Running

**Full backend** (ingestion + API server — recommended):
```bash
npm start
```

Development mode with auto-restart:
```bash
npm run dev
```

**API server only** (RSS proxy + health check, no scheduled ingestion):
```bash
npm run server
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check and config status |
| GET | `/api/rss/proxy?url=...` | Fetch RSS feed (bypasses browser CORS) |
| POST | `/api/rss/ingest` | Trigger manual feed ingestion |

The frontend dev server proxies `/api/*` to `http://localhost:3001`. Both must be running for RSS Diagnostics in the UI to work.

## How It Works

1. Fetches RSS feeds from configured URLs
2. Parses feed items (title, description, content, URL)
3. Inserts new items into Supabase `news_items` table
4. Automatically creates radio scripts in `radio_scripts` table
5. Updates feed metadata in `feeds` table
6. Runs on a configurable schedule (default: every 15 minutes)
7. Serves an Express API on port 3001 for frontend RSS proxy requests

## Database Tables Required

- `news_items` - stores RSS feed articles
- `radio_scripts` - text-to-speech friendly scripts
- `feeds` - RSS feed configurations
- `broadcast_queue` - playback queue (managed by frontend)
- `alerts` - emergency alerts (managed by frontend)
- `content_sources` - feed URLs shown in RSS Diagnostics (managed via Supabase)

## Features

- Duplicate detection (by URL)
- Automatic script generation for TTS
- Feed health monitoring
- Scheduled ingestion
- RSS proxy API for browser diagnostics
- Graceful shutdown
- Error handling and logging
