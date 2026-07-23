// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
export const BFS_CONFIG = {
  SILENCE_THRESHOLD_MS: 3500,
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
  'This is {station}, your source for the latest updates.',
  'You\'re tuned into {station}. Thanks for listening.',
  'Broadcasting live from {station}. We\'ll be back shortly.',
  'This is {station} radio. Stay with us.',
  'You\'re listening to {station}. More content coming up.',
  'From {station}, we\'ll return with more news.',
  'This is {station}. Your news, your way.',
  'Live on {station}. We continue our coverage shortly.',
  'You\'re with {station}. Stay with us for more.',
  'This is {station}. We\'ll be right back.',
  'Broadcasting from {station}. More updates coming.',
  'You\'re listening to {station}. Don\'t go anywhere.',
  'This is {station}. We continue in just a moment.',
  'Live from {station}. More news on the way.',
  'You\'re tuned to {station}. We\'ll be back.',
  'This is {station}. Stay with us.',
];

export const BRIDGE_INTROS: string[] = [
  'Up next, music selection on {station}.',
  'Taking a short music break on {station}.',
  'Enjoy this track while we prepare the latest updates.',
  'A brief musical interlude on {station}.',
  'Now for some music on {station}. We\'ll be back with news shortly.',
  'Here\'s a musical break on {station}. Stay with us.',
  'Taking a moment for music on {station}. More news coming up.',
  'Enjoy this selection from {station}. We\'ll return with updates.',
  'A musical interlude now on {station}. We continue shortly.',
  'Music time on {station}. We\'ll be back with more news.',
  'Here\'s some music while we gather the latest stories on {station}.',
  'A brief music break on {station}. Don\'t go anywhere.',
  'Now for a musical selection on {station}. We\'ll return shortly.',
  'Enjoy this track from {station}. More updates coming.',
  'Taking a short break for music on {station}. Stay tuned.',
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
