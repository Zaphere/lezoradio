import type { NewsCategory } from './types';

export interface Channel {
  frequency: string;
  name: string;
  emoji: string;
  description: string;
  newsCategory?: NewsCategory;
  isMusic: boolean;
  isGlobal?: boolean;
}

export const CHANNELS: Channel[] = [
  { frequency: "88.1", name: "Headlines", emoji: "🇿🇦", description: "Today's top stories", isMusic: false },
  { frequency: "89.3", name: "Traffic", emoji: "🚦", description: "Traffic & road alerts", newsCategory: "traffic", isMusic: false },
  { frequency: "90.5", name: "Weather", emoji: "🌦", description: "Weather forecasts", isMusic: false },
  { frequency: "91.7", name: "Business", emoji: "💼", description: "Business & finance", isMusic: false },
  { frequency: "92.9", name: "Sports", emoji: "⚽", description: "Sports news & scores", isMusic: false },
  { frequency: "94.1", name: "Africa News", emoji: "🌍", description: "Across the continent", newsCategory: "regional", isMusic: false, isGlobal: true },
  { frequency: "95.3", name: "World News", emoji: "🌎", description: "International headlines", newsCategory: "global", isMusic: false, isGlobal: true },
  { frequency: "96.5", name: "Emergency", emoji: "🚨", description: "Emergency alerts", newsCategory: "alert", isMusic: false },
  { frequency: "97.7", name: "Agriculture", emoji: "🌱", description: "Farming & agriculture", isMusic: false },
  { frequency: "98.9", name: "Ambient", emoji: "🎵", description: "Continuous ambient music", isMusic: true, isGlobal: true },
];

export const GLOBAL_CHANNELS = CHANNELS.filter(c => c.isGlobal);

export const FREQUENCIES = CHANNELS.map(c => parseFloat(c.frequency)).sort((a, b) => a - b);
export const FREQ_MAP = new Map<string, Channel>(CHANNELS.map(c => [c.frequency, c]));

export const MIN_FREQ = 87.0;
export const MAX_FREQ = 100.0;

export function snapFrequency(raw: number): string {
  let closest = FREQUENCIES[0];
  let minDiff = Math.abs(raw - closest);
  for (const f of FREQUENCIES) {
    const d = Math.abs(raw - f);
    if (d < minDiff) {
      minDiff = d;
      closest = f;
    }
  }
  return closest.toFixed(1);
}

export function getChannel(freq: string): Channel | undefined {
  return FREQ_MAP.get(freq);
}

export function newsCategoryForChannel(channel: Channel): NewsCategory | undefined {
  return channel.newsCategory;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function getGlobalChannelBySlug(slug: string): Channel | undefined {
  return GLOBAL_CHANNELS.find(c => slugify(c.name) === slug);
}
