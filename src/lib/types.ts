export type NewsCategory = 'local' | 'regional' | 'global' | 'traffic' | 'alert';

export interface NewsItem {
  id: string;
  feed_id: string;
  provider?: string;
  title: string;
  description: string;
  content: string;
  url: string;
  region: string;
  category: NewsCategory;
  priority?: number;
  city?: string;
  province?: string;
  published_at: string;
  ingested_at: string;
  is_processed: boolean;
}

export interface RadioScript {
  id: string;
  news_item_id: string;
  script: string;
  region: string;
  category: NewsCategory;
  is_read: boolean;
  created_at: string;
}

export interface BroadcastQueueItem {
  id: string;
  script_id: string;
  region: string;
  category: NewsCategory;
  priority: number;
  is_played: boolean;
  is_interrupted: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region: string;
  is_active: boolean;
  created_at: string;
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  region: string;
  category: NewsCategory;
  is_active: boolean;
  last_fetched_at: string;
}

export interface QueueItem {
  script: RadioScript;
  priority: number;
}

export function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export interface StationRecord {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string;
  language: string;
  voice?: string;
  is_active: boolean;
  priority: number;
  image_url?: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: 'rss' | 'api' | 'manual';
  category: string;
  priority: number;
  enabled: boolean;
  health: 'healthy' | 'warning' | 'offline' | 'unknown';
  last_checked: string | null;
  last_success: string | null;
  last_failure: string | null;
  article_count: number;
  response_time: number;
  created_at: string;
  updated_at: string;
}

export interface StationSource {
  station_id: string;
  source_id: string;
  priority: number;
  enabled: boolean;
}

export type BroadcastType = 'news' | 'weather' | 'alert' | 'traffic' | 'agriculture' | 'tourism' | 'government' | 'podcast';

export interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  type: BroadcastType;
  priority: number;
  station: string;
  country?: string;
  region: string;
  language: string;
  source: string;
  publishedAt: string;
  expiresAt?: string;
  audioUrl?: string;
  metadata?: Record<string, any>;
}

export type PlaybackState = 'idle' | 'speaking' | 'paused';

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  provider: 'browser' | 'elevenlabs' | 'azure' | 'google' | 'openai';
  providerVoiceId?: string;
}

export interface ITTSProvider {
  speak(text: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setVoice(voice: VoiceOption): void;
  getVoices(): VoiceOption[];
  getState(): PlaybackState;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

// ============================================================================
// NowPlaying — maps 1:1 to `radio_station_state` table (v3)
// ============================================================================

export type SegmentType =
  | 'intro' | 'track' | 'tts' | 'jingle' | 'bulletin'
  | 'announcement' | 'ambient' | 'silence' | 'transition';

export type TransitionType = 'crossfade' | 'duck' | 'cut' | 'next';

export interface NowPlaying {
  id: string;
  channelId: string;
  stationId: string;
  segmentType: SegmentType;
  segmentId: string | null;
  audioUrl: string | null;
  audioType: 'stream' | 'tts' | 'jingle' | 'ambient' | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSeconds: number;
  startedAt: string;
  transitionType: TransitionType | null;
  transitionDurationMs: number;
  duckVolume: number | null;
  nextSegmentType: SegmentType | null;
  nextAudioUrl: string | null;
  nextTitle: string | null;
  nextArtist: string | null;
  nextDurationSeconds: number | null;
  language: string;
  voiceId: string | null;
  version: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  provider: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
}

export type FeedHealth = 'healthy' | 'warning' | 'offline' | 'unknown';

export interface DiagnosticResult {
  sourceId: string;
  feedName: string;
  url: string;
  status: number;
  ok: boolean;
  articleCount: number;
  latestTitle: string | null;
  responseTime: number;
  health: FeedHealth;
  error?: { category: string; message: string };
}

export interface DiagnosticSummary {
  results: DiagnosticResult[];
  totalArticles: number;
  successful: number;
  failed: number;
  duration: number;
  timestamp: string;
}

export interface ScriptSegment {
  speaker: string;
  text: string;
  type: 'intro' | 'story' | 'transition' | 'outro' | 'advertisement' | 'jingle';
}

export interface BroadcastScript {
  segments: ScriptSegment[];
}

export interface IScriptGenerator {
  generate(items: BroadcastItem[]): Promise<BroadcastScript>;
}

export type BroadcastMode = 'IDLE' | 'LIVE_NEWS' | 'MUSIC_FILL' | 'GLOBAL_BULLETIN' | 'EMERGENCY';

export interface StationTimeInfo {
  timezone: string;
  localTime: Date;
  localHour: number;
  localMinute: number;
  timeString: string;
  dateString: string;
}

export interface FrenchBulletinSlot {
  hour: number;
  minute: number;
  label: string;
}

export interface NextSegment {
  type: string;
  time: string;
  label: string;
}

export type BroadcastStateValue =
  | 'IDLE'
  | 'INTRO_MUSIC'
  | 'INTRO_DUCKING'
  | 'HOST_INTRO'
  | 'NEWS_SEGMENT'
  | 'TRANSITION'
  | 'ENTERTAINMENT'
  | 'STOPPING';

export interface PersistedBroadcastState {
  stationId: string;
  stationName: string;
  stationRegion: string;
  state: BroadcastStateValue;
  currentIndex: number;
  playedIds: string[];
  playlist: SerializedNewsItem[];
  timestamp: number;
  voiceRate: number;
  voiceVolume: number;
}

export interface SerializedNewsItem {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  region: string;
  category: NewsCategory;
  ingested_at: string;
}

// ============================================================================
// Generic Provider Framework Types
// ============================================================================

export interface UnifiedEvent {
  id: string;
  provider: string;
  provider_record_id: string;
  category: string;
  subcategory?: string;
  priority: number;
  title: string;
  summary?: string;
  description?: string;
  country: string;
  province?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  verified: boolean;
  language: string;
  metadata?: Record<string, any>;
  raw_payload?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  enabled: boolean;
  authenticated?: boolean;
  initialized?: boolean;
  last_sync?: string;
  last_sync_status?: string;
  items_ingested?: number;
  error_count?: number;
  latency_ms?: number;
  token_status?: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isExpired: boolean;
    isExpiring: boolean;
    timeUntilExpiry?: number;
    tokenExpiry?: string;
  };
  enabled_endpoints?: string[];
  last_sync_times?: Record<string, string>;
}
