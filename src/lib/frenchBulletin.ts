import type { FrenchBulletinSlot, BroadcastMode } from './types';
import { getStationHour, getStationMinute } from './stationTime';

export const FRENCH_BULLETIN_TIMES: FrenchBulletinSlot[] = [
  { hour: 9,  minute: 0, label: 'Matin' },
  { hour: 12, minute: 0, label: 'Midi' },
  { hour: 15, minute: 0, label: 'Après-midi' },
  { hour: 18, minute: 0, label: 'Soir' },
  { hour: 21, minute: 0, label: 'Nuit' },
];

export const FRENCH_BULLETIN_SLOT_LABELS: Record<number, string> = {
  9: 'Bulletin du Matin',
  12: 'Bulletin de Midi',
  15: 'Bulletin de l\'Après-midi',
  18: 'Bulletin du Soir',
  21: 'Bulletin de Nuit',
};

export const FRENCH_BULLETIN_PRIORITY = 3;

export const PRIORITY_ORDER = {
  EMERGENCY: 1,
  BREAKING_NEWS: 2,
  FRENCH_GLOBAL_BULLETIN: 3,
  LOCAL_SCHEDULED: 4,
  TRAFFIC: 5,
  WEATHER: 6,
  RSS_NEWS: 7,
  ENTERTAINMENT_MUSIC: 8,
} as const;

export const INTRO_JINGLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/introaudio/LezzoTrafficappIntro.mp3`;

export const FRENCH_BULLETIN_INTRO_SCRIPT = `Bulletin d'information en français. Voici les titres du jour.`;

export const FRENCH_BULLETIN_OUTRO_SCRIPT = `Ce bulletin d'information était présenté par Afrique AI Radio. Restez à l'écoute pour la suite de nos programmes.`;

export function getFrenchBulletinSlot(timezone: string): FrenchBulletinSlot | null {
  const hour = getStationHour(timezone);
  const minute = getStationMinute(timezone);
  for (const slot of FRENCH_BULLETIN_TIMES) {
    if (slot.hour === hour && minute >= 0 && minute < 5) {
      return slot;
    }
  }
  return null;
}

export function isFrenchBulletinTime(timezone: string): boolean {
  return getFrenchBulletinSlot(timezone) !== null;
}

export function getNextBulletinSlot(timezone: string): FrenchBulletinSlot | null {
  const hour = getStationHour(timezone);
  const minute = getStationMinute(timezone);
  const currentTotalMinutes = hour * 60 + minute;

  for (const slot of FRENCH_BULLETIN_TIMES) {
    const slotTotalMinutes = slot.hour * 60 + slot.minute;
    if (slotTotalMinutes > currentTotalMinutes) {
      return slot;
    }
  }

  return FRENCH_BULLETIN_TIMES[0];
}

export function getNextBulletinTimeString(timezone: string): string {
  const next = getNextBulletinSlot(timezone);
  if (!next) return '';
  const h = next.hour.toString().padStart(2, '0');
  const m = next.minute.toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function getActiveBulletinHour(timezone: string): number | null {
  return getFrenchBulletinSlot(timezone)?.hour ?? null;
}

export function getBroadcastMode(
  broadcastState: string,
  isBulletinTime: boolean,
  isEmergency: boolean,
  isMusicMode: boolean,
  isLive: boolean,
): BroadcastMode {
  if (!isLive || broadcastState === 'IDLE') return 'LIVE_NEWS';
  if (isEmergency) return 'EMERGENCY';
  if (isBulletinTime) return 'GLOBAL_BULLETIN';
  if (isMusicMode) return 'MUSIC_FILL';
  return 'LIVE_NEWS';
}

export function getBulletinScriptForHour(hour: number, stationName: string, newsCount: number): string {
  const labels: Record<number, string> = {
    9: `Bonjour de ${stationName}. Voici le bulletin d'information de ${newsCount} sujets.`,
    12: `Bonjour de ${stationName}. Voici le bulletin de midi avec ${newsCount} sujets.`,
    15: `De ${stationName}, voici le bulletin de l'après-midi avec ${newsCount} sujets.`,
    18: `Bonsoir de ${stationName}. Voici le bulletin du soir avec ${newsCount} sujets.`,
    21: `Bonsoir de ${stationName}. Voici le bulletin de nuit avec ${newsCount} sujets.`,
  };
  return labels[hour] ?? `Bulletin d'information de ${stationName}.`;
}
