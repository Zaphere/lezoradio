# Radiolezo

Radio broadcasting system for Leso Leso - RSS feed ingestion and text-to-speech radio.

## Architecture

```
RSS Feeds → Backend Service → Supabase Database → React UI → Voice Broadcast
```

## Components

### Frontend (React + TypeScript + Vite)
- Radio station selection
- News feed preview
- Live broadcasting with text-to-speech
- Alert system
- Queue management

### Backend Service (Node.js)
- RSS feed fetching and parsing
- Supabase database integration
- Automated ingestion scheduling
- Radio script generation

## Setup

### Frontend
```bash
npm install
cp .env.example .env
# Configure your Supabase credentials
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure your Supabase credentials and RSS feed URLs
npm start
```

The backend runs two things together:
- **RSS ingestion** — fetches feeds on a schedule and writes to Supabase
- **API server** (port 3001) — health check and RSS proxy used by the frontend diagnostics panel

You need **both** terminals running for RSS diagnostics to work:
1. Project root: `npm run dev` (frontend on port 5173)
2. `backend/`: `npm start` (API on port 3001)

For API-only (no scheduled ingestion): `npm run server`

## Database Tables

- `news_items` - RSS feed articles
- `radio_scripts` - Text-to-speech scripts
- `broadcast_queue` - Playback queue
- `alerts` - Emergency alerts
- `feeds` - RSS feed configurations

## Development

See [backend/README.md](backend/README.md) for backend service details.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
