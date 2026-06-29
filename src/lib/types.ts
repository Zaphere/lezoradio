export type NewsCategory = 'local' | 'regional' | 'global' | 'traffic' | 'alert';

export interface NewsItem {
  id: string;
  feed_id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  region: string;
  category: NewsCategory;
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

export const TRANSITIONS = [
  "Next update coming your way…",
  "In regional news today…",
  "Moving to traffic updates…",
  "Here's what's happening now…",
  "Now for the latest reports…",
  "Continuing with today's stories…",
  "And now from our news desk…",
  "Let's look at what else is making headlines…",
];

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
