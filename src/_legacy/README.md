# Archived Legacy Code (Phase 1 — 2026-07-14)

These files were archived during Phase 1 of the Radio Engine rewrite. They are kept for reference until the new engine reaches full feature parity.

## Archive Contents

### `hooks/`
| File | Purpose | Replaced By |
|------|---------|-------------|
| `useBulletinSync.ts` | WebSocket cross-tab bulletin sync | `useNowPlaying` (frontend) + Supabase Realtime |

### `lib/`
| File | Purpose | Replaced By |
|------|---------|-------------|
| `types.ts` | Re-exports all TypeScript types from `src/lib/types.ts` | Types remain in `src/lib/types.ts` |
| `transitions.ts` | 133 transition phrases + 20 teaser phrases | `content_templates` table |
| `broadcastFlowSupervisor.ts` | BFS config, station IDs, bridge intros, recovery order | `engine_config` + `content_templates` tables |
| `broadcastProgress.ts` | localStorage-based played tracking | `queue_played_items` table |
| `frenchBulletin.ts` | Bulletin scheduling logic | `bulletin_schedule` + `station_channels` tables |
| `stationNewsFilter.ts` | Region-based news filtering | `contentNormalizer.js` (backend) |
| `newsText.ts` | Text-to-speech conversion utilities | `utils/newsText.js` (backend) |
| `channels.ts` | Channel definitions (10 channels) | `station_channels` table |
| `drcRegions.ts` | DRC region definitions | `station_channels` + `stations` tables |
| `stationTime.ts` | Timezone resolution utilities | `stations.timezone` column |
| `entertainmentConfig.ts` | Entertainment track config | `entertainment_tracks` table |
| `timing.ts` | Audio timing constants | `audio_config` table |

### `services/tts/`
| File | Purpose | Replaced By |
|------|---------|-------------|
| `elevenlabsTTS.ts` | ElevenLabs TTS API client | `ttsGenerator.js` (backend) |

## Adapter Pattern

Active code still imports from the original paths via thin adapter files in `src/lib/` and `src/hooks/` that re-export from `_legacy/`. These adapters will be removed once the new engine is complete.

## Notes

- `src/_legacy/` is excluded from TypeScript compilation via `tsconfig.app.json`
- No production code depends on these files directly
- Do NOT add new code here — this directory is read-only
