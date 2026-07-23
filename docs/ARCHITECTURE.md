# LezoRadio Engine Architecture

> **Status:** FROZEN — v1.0 (2026-07-14)
> This document is the project's source of truth for architecture. Do not modify during implementation. Changes require a new architecture review cycle.

## Overview

A unified, event-driven Radio Engine that replaces the current fragmented playback system. The backend is the source of truth for all scheduling, queue generation, AI processing, and TTS. The frontend is a read-only renderer that subscribes to a "Now Playing" state via Supabase Realtime and renders audio accordingly.

**Companion document:** [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) — complete table definitions, RLS policies, indexes, seed data, and ERD.

## Core Principles

1. **Backend is Source of Truth**: Ingestion, AI script generation, queue generation, scheduling, language selection, audio asset generation/storage — all server-side
2. **Frontend is Read-Only Renderer**: Audio playback, buffering, crossfades, Media Session integration, UI rendering — zero business logic
3. **State-Driven Sync**: Frontend subscribes to `radio_station_state` via Supabase Realtime. No polling. No command protocol.
4. **Event-Driven Engine**: Provider events trigger engine reactions via `pg_notify`. Scheduled timers handle bulletins/announcements. No polling loops.
5. **DB-Driven Config**: Every timing value, template, region, channel, and schedule lives in the database. Zero hardcoded configuration.
6. **Component Reuse**: `AudioManager.ts`, `IntroAudio.ts`, `TrackAudio.ts`, `BackgroundAudio.ts` are preserved and reused
7. **Archive Before Delete**: Legacy code is moved to `src/_legacy/` for reference until new engine reaches feature parity

## "Now Playing" State Object

The central synchronization mechanism. Maps directly to the `radio_station_state` database table. The backend computes and writes this object; the frontend subscribes via Supabase Realtime.

```typescript
interface NowPlaying {
  // What's currently playing
  segmentType: 'intro' | 'track' | 'tts' | 'jingle' | 'bulletin' | 'announcement' | 'ambient' | 'silence' | 'transition';
  segmentId: string | null;

  // Audio source
  audioUrl: string | null;        // CDN/Storage URL for pre-rendered audio
  audioType: 'stream' | 'tts' | 'jingle' | 'ambient' | null;

  // Track metadata (when segmentType is 'track')
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;

  // Timing
  startedAt: string;              // ISO timestamp
  durationSeconds: number;        // Segment duration

  // Transition hint
  transitionType: 'crossfade' | 'duck' | 'cut' | 'next' | null;
  transitionDurationMs: number;
  duckVolume: number | null;      // 0.00-1.00

  // Next item preview
  nextSegmentType: string | null;
  nextAudioUrl: string | null;
  nextTitle: string | null;
  nextArtist: string | null;
  nextDurationSeconds: number | null;

  // Station context
  channelId: string;              // e.g., 'kinshasa-main'
  stationId: string;              // UUID
  language: string;
  voiceId: string | null;

  // Metadata
  version: number;                // Incremented on every state change
  generatedAt: string;            // ISO timestamp
}
```

**Database column mapping:** Every field maps 1:1 to `radio_station_state` columns (snake_case in DB, camelCase in TypeScript).

## Backend Architecture

### Event-Driven Engine

The engine reacts to three event sources instead of polling:

1. **Provider Events** — Content arrives via `pg_notify` trigger on `events` table
2. **Supabase Realtime** — Frontend subscribes to `radio_station_state` changes
3. **Scheduled Timers** — `node-cron` for bulletins, time announcements, station IDs

**See [DATABASE_ARCHITECTURE.md § Event-Driven Architecture](./DATABASE_ARCHITECTURE.md#event-driven-architecture) for full event flow diagrams and code examples.**

### Modules (`backend/engine/`)

#### `radioEngine.js` — Top-Level Orchestrator
- Event-driven: reacts to provider events, not polling
- Coordinates all other modules
- Manages per-channel state machines
- Writes `NowPlaying` to `radio_station_state` (frontend picks up via Realtime)

#### `eventListener.js` — Provider Event Listener
- Subscribes to `pg_notify('new_event')` from PostgreSQL trigger
- Routes events to affected channels
- Triggers queue rebuild when new content arrives

#### `eventScheduler.js` — Bulletins + Announcements
- Reads `bulletin_schedule` and `station_channels` from DB
- Uses `node-cron` for bulletin timing (timezone-aware)
- Schedules station ID jingles and time announcements per channel

#### `queueManager.js` — Queue Generation + Played Tracking
- Generates priority-based queues from `events` and `music_tracks`
- Queries `queue_played_items` to prevent repeats
- Respects `station_channels.genre_weights` and rotation rules

#### `playbackController.js` — State Machine + Segment Timing
- Determines current segment type based on time-of-day + schedule
- Computes segment start/end times
- Handles transitions between segments
- Writes state to `radio_station_state`

#### `audioManager.js` — Mix Computation
- Reads `audio_config` table for timing/volume settings
- Mirrors frontend `AudioManager.ts` architecture
- Generates mix parameters for frontend

#### `ttsGenerator.js` — ElevenLabs API + Supabase Storage
- Calls ElevenLabs API for TTS generation
- Checks `tts_audio_cache` before generating
- Stores audio in Supabase Storage, records in cache

#### `languageController.js` — Voice Resolution
- Reads `station_voices` and `station_channels.voice_config` from DB
- Resolves voice ID per channel/language/style

#### `stationController.js` — Station Config from DB
- Reads `stations`, `station_channels`, `station_schedules` from DB
- Provides station-specific configuration to all modules

#### `contentNormalizer.js` — Content Classification
- Reads `provider_taxonomy` and `normalizer_config` from DB
- Normalizes provider-specific content to unified format

#### `radioWsServer.js` — WebSocket Server
- Extends existing `bulletinSync.js` pattern
- Broadcasts state to connected clients
- Runs on same HTTP server as API

#### `utils/timezone.js` — Timezone Resolution
- `resolveTimezone(region)` → IANA timezone string

#### `utils/newsText.js` — Text Conversion
- Converts news article text to natural speech

**See [DATABASE_ARCHITECTURE.md § New Tables](./DATABASE_ARCHITECTURE.md#new-tables) for complete table definitions with all columns, indexes, and RLS policies.**

## Frontend Architecture

### Hooks

#### `useNowPlaying.ts` — Supabase Realtime Subscription
- Subscribes to `radio_station_state` changes via Supabase Realtime
- No polling — receives push updates when backend writes new state
- Manages reconnection and connection state
- Exposes: `nowPlaying`, `isConnected`

#### `useAudioExecutor.ts` — Audio Rendering
- Subscribes to `NowPlaying` from `useNowPlaying`
- Reuses `AudioManager.ts` for audio playback
- Executes transitions based on `NowPlaying.transition`
- Manages crossfading, ducking, master volume
- Exposes: `isPlaying`, `volume`, `setVolume`

### Components (Unchanged)
- `src/pages/Radio.tsx` — Main radio player page
- Existing UI components — No changes needed

### Hooks to Archive
| Hook | Lines | Replacement |
|------|-------|-------------|
| `useRadioEngine.ts` | 919 | `useNowPlaying` + `useAudioExecutor` |
| `useVoiceEngine.ts` | 142 | None (TTS moves to backend) |
| `useBroadcastFlowSupervisor.ts` | 250 | Backend `eventScheduler.js` |
| `useFrenchBulletin.ts` | 61 | Backend `eventScheduler.js` |
| `useBulletinSync.ts` | 89 | `useNowPlaying` (state is in `radio_station_state`) |

## Component Reuse Map

### Keep (Active → Reused in New System)
| File | Lines | Reused By |
|------|-------|-----------|
| `services/audio/AudioManager.ts` | 373 | `useAudioExecutor` (frontend) |
| `services/audio/IntroAudio.ts` | 162 | `AudioManager.ts` (internal) |
| `services/audio/TrackAudio.ts` | 122 | `AudioManager.ts` (internal) |
| `services/audio/BackgroundAudio.ts` | 97 | `AudioManager.ts` (internal) |
| `lib/types.ts` | 461 | Updated with `NowPlaying` type |

### Archive (Active → Moved to `src/_legacy/`)
| File | Lines | Replacement |
|------|-------|-------------|
| `hooks/useRadioEngine.ts` | 919 | `useNowPlaying` + `useAudioExecutor` |
| `hooks/useVoiceEngine.ts` | 142 | Backend `ttsGenerator.js` |
| `hooks/useBroadcastFlowSupervisor.ts` | 250 | Backend `eventScheduler.js` |
| `hooks/useFrenchBulletin.ts` | 61 | Backend `eventScheduler.js` |
| `hooks/useBulletinSync.ts` | 89 | `useNowPlaying` |
| `lib/broadcastProgress.ts` | 92 | `queue_played_items` table |
| `lib/broadcastFlowSupervisor.ts` | 73 | `engine_config` table |
| `lib/frenchBulletin.ts` | 104 | Backend `eventScheduler.js` |
| `lib/stationNewsFilter.ts` | 73 | Backend `contentNormalizer.js` |
| `lib/newsText.ts` | 98 | Backend `utils/newsText.js` |
| `services/tts/elevenlabsTTS.ts` | 273 | Backend `ttsGenerator.js` |
| `lib/timing.ts` | 20 | `audio_config` table |
| `lib/drcRegions.ts` | 72 | `regions` / `station_channels` tables |
| `lib/stationTime.ts` | 121 | `stations.timezone` column |
| `lib/channels.ts` | 61 | `station_channels` table |
| `lib/entertainmentConfig.ts` | 73 | `entertainment_tracks` table |

### Deleted in Phase 0 (Dead Code — Already Removed)
| File/Directory | Reason |
|----------------|--------|
| `src/engines/` (36 files) | V2 scaffolding, never imported |
| `src/services/radio/` (5 files) | Dead, not imported |
| `src/services/rss/` (6 files) | Dead, not imported |
| `src/services/tts/browserTTS.ts` | Dead, not imported |
| `src/services/tts/ttsProvider.ts` | Dead, not imported |
| `src/services/audio/AmbientAudio.ts` | Dead, not imported |
| `src/lib/broadcastState.ts` | Dead, not imported |
| `src/components/diagnostics/` (3 files) | Dead, not imported |

## Phased Migration Plan

### Phase 0: Dead Code Cleanup ✅ (Completed)
- Deleted all dead files with no active imports (~2000+ lines)
- `src/engines/`, `src/services/radio/`, `src/services/rss/`, `src/components/diagnostics/`
- `src/services/tts/browserTTS.ts`, `ttsProvider.ts`, `src/services/audio/AmbientAudio.ts`, `src/lib/broadcastState.ts`
- Build passes cleanly
- Commit: "chore: remove dead V2 engine scaffolding and unused services"

### Phase 1: Archive Legacy Code
- Create `src/_legacy/` directory with subdirectories (`hooks/`, `lib/`, `services/`)
- Move all files from "Archive" list above into `_legacy/`
- Add `// @deprecated — archived, replaced by [new file]` comment at top of each
- Create `src/_legacy/README.md` documenting what each archived file did
- Update any remaining imports in active code
- Verify build passes
- Commit: "chore: archive legacy hooks and lib files before new engine"

### Phase 2: Database Migration
- Create `supabase/migrations/20260714_v3_radio_engine.sql`
- 11 new tables: `radio_station_state`, `queue_played_items`, `station_channels`, `tts_audio_cache`, `content_templates`, `audio_config`, `engine_config`, `provider_taxonomy`, `normalizer_config`, `playback_history`, `entertainment_tracks`
- PostgreSQL trigger `trg_events_notify_engine` for `pg_notify`
- All RLS policies (frontend read, backend service role)
- All indexes for query performance
- Seed data: DRC channels, transition phrases, audio config, engine config, provider taxonomy
- Commit: "feat: radio engine v3 database schema with RLS and seed data"

### Phase 3: Backend Engine Core
- Create `backend/engine/` directory
- Implement `eventListener.js` — `pg_notify` listener
- Implement `queueManager.js` — queue generation from `events` + `music_tracks`
- Implement `playbackController.js` — state machine + segment timing
- Implement `audioManager.js` — mix computation from `audio_config`
- Implement `radioEngine.js` — event-driven orchestrator
- Test with manual `node backend/engine/radioEngine.js`
- Commit: "feat: backend radio engine core (event-driven, queue, playback)"

### Phase 4: TTS + Content + Scheduling
- Implement `ttsGenerator.js` — ElevenLabs + `tts_audio_cache`
- Implement `languageController.js` — voice resolution from `station_voices`
- Implement `stationController.js` — config from `station_channels`
- Implement `contentNormalizer.js` — reads `provider_taxonomy` + `normalizer_config`
- Implement `eventScheduler.js` — `node-cron` from `bulletin_schedule` + `station_channels`
- Test TTS generation and caching
- Commit: "feat: backend TTS, content normalization, and event scheduling"

### Phase 5: Frontend Migration
- Implement `useNowPlaying.ts` — Supabase Realtime subscription
- Implement `useAudioExecutor.ts` — audio rendering (reuses `AudioManager.ts`)
- Update `Radio.tsx` to use new hooks
- Move deprecated hooks to `src/_legacy/`
- Commit: "feat: frontend migration to Supabase Realtime and new hooks"

### Phase 6: WebSocket + Multi-Channel
- Implement `radioWsServer.js` — WebSocket server (extends `bulletinSync.js`)
- Test multi-channel playback (Kinshasa, Goma, Lubumbashi)
- Performance testing with multiple channels
- Commit: "feat: WebSocket server and multi-channel support"

### Phase 7: Hardening + Archive Cleanup
- Verify all legacy functionality is replicated
- Run parallel testing (old vs new)
- Delete `src/_legacy/` directory
- Remove deprecated legacy tables (`news_items`, `feeds`, `radio_scripts`, `broadcast_queue`, `alerts`)
- Final documentation update
- Commit: "chore: remove legacy archive and finalize v3 architecture"

## Expansion Readiness

Adding a new country (e.g., Kenya) requires **only database inserts** — zero code changes:

1. Insert into `stations` (name, country_code, timezone, region)
2. Insert into `station_voices` (voice_id, language, gender, style)
3. Insert into `station_channels` (channel_id, name, language, frequency, genre_weights, primary_voice_id)
4. Insert into `audio_config` (channel_id, intro_url, background_url)
5. Insert into `engine_config` (channel_id, fallback_message)
6. Insert into `content_templates` (transition, station_id, fallback messages in local language)
7. Insert into `entertainment_tracks` (local music)
8. Insert into `bulletin_schedule` (local bulletin times)
9. Optionally: insert into `provider_taxonomy` and `normalizer_config` for provider-specific mappings

The engine automatically picks up the new channel on next startup. See [DATABASE_ARCHITECTURE.md § Adding a New Country](./DATABASE_ARCHITECTURE.md#adding-a-new-country-expansion-example) for complete SQL examples.

## State Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT SOURCES                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Provider Sync ──→ INSERT INTO events ──→ pg_notify trigger    │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BACKEND ENGINE (event-driven)                           │   │
│  │                                                          │   │
│  │  eventListener.js: Receives pg_notify                   │   │
│  │    └─ Routes to affected channels                       │   │
│  │                                                          │   │
│  │  eventScheduler.js: node-cron from DB                   │   │
│  │    └─ Bulletins, station IDs, time announcements       │   │
│  │                                                          │   │
│  │  queueManager.js: Generates next content                │   │
│  │  playbackController.js: Computes NowPlaying             │   │
│  │  audioManager.js: Mix parameters from audio_config      │   │
│  │                                                          │   │
│  │  └─→ UPDATE radio_station_state (version++)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        │                                         │
│                        ▼                                         │
│  Supabase Realtime broadcast                                    │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FRONTEND (read-only renderer)                           │   │
│  │                                                          │   │
│  │  useNowPlaying.ts: Receives Realtime update             │   │
│  │    └─ Updates local state                              │   │
│  │                                                          │   │
│  │  useAudioExecutor.ts: Reacts to state change            │   │
│  │    ├─ Compares old vs new segmentType                  │   │
│  │    ├─ Executes transition (crossfade/duck/cut)          │   │
│  │    ├─ Updates AudioManager                             │   │
│  │    └─ Updates Media Session                            │   │
│  │                                                          │   │
│  │  Radio.tsx: Renders UI from NowPlaying                  │   │
│  │    ├─ Track info, progress bar                         │   │
│  │    ├─ Next item preview                                │   │
│  │    └─ User controls (play/pause, volume)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
