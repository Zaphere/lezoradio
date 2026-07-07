export const BFS_CONFIG = {
  SILENCE_THRESHOLD_MS: 8000,
  CHECK_INTERVAL_MS: 2000,
  BRIDGE_CHECK_INTERVAL_MS: 30000,
  MIN_BRIDGE_DURATION_MS: 20000,
  MAX_TRANSITION_LENGTH: 200,
} as const;

export const TRANSITIONS: string[] = [
  'We now continue with the latest updates.',
  'We continue shortly with more news.',
  'Now moving to the next segment.',
  'Up next, developments from the region.',
  'We now move to the latest reports.',
  'Continuing with today\'s stories.',
  'Here\'s what else is happening.',
];

export const STATION_IDS: string[] = [
  'You\'re listening to {station}. Stay tuned.',
  'This is {station}. We\'ll be right back with more.',
  'You\'re with {station}. More news coming up.',
  'Live from {station}. We continue in a moment.',
];

export const BRIDGE_INTROS: string[] = [
  'Up next, music selection on {station}.',
  'Taking a short music break on {station}.',
  'Enjoy this track while we prepare the latest updates.',
  'A brief musical interlude on {station}.',
];

export function pickLine(lines: string[], stationName: string): string {
  return lines[Math.floor(Math.random() * lines.length)].replace('{station}', stationName);
}

export const RECOVERY_ORDER = [
  'check_alerts',
  'check_breaking_news',
  'check_scheduled_bulletins',
  'check_pending_rss',
  'check_cached_scripts',
  'activate_bridge',
] as const;

export type RecoveryStep = typeof RECOVERY_ORDER[number];
