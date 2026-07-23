// Adapter — re-exports from legacy until bulletin scheduling moves to backend `eventScheduler.js`.
export {
  FRENCH_BULLETIN_TIMES,
  FRENCH_BULLETIN_SLOT_LABELS,
  FRENCH_BULLETIN_PRIORITY,
  PRIORITY_ORDER,
  INTRO_JINGLE_URL,
  FRENCH_BULLETIN_INTRO_SCRIPT,
  FRENCH_BULLETIN_OUTRO_SCRIPT,
  getFrenchBulletinSlot,
  isFrenchBulletinTime,
  getNextBulletinSlot,
  getNextBulletinTimeString,
  getActiveBulletinHour,
  getBroadcastMode,
  getBulletinScriptForHour,
} from '../_legacy/lib/frenchBulletin';
