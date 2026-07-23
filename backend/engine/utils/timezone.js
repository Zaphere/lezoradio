// backend/engine/utils/timezone.js
// Timezone resolution from IANA strings.

const COUNTRY_TIMEZONES = {
  CD: 'Africa/Kinshasa',
  ZA: 'Africa/Johannesburg',
  ZM: 'Africa/Lusaka',
  KE: 'Africa/Nairobi',
  TZ: 'Africa/Dar_es_Salaam',
  NG: 'Africa/Lagos',
  GH: 'Africa/Accra',
  UG: 'Africa/Kampala',
  RW: 'Africa/Kigali',
  CG: 'Africa/Brazzaville',
  CM: 'Africa/Douala',
  AO: 'Africa/Luanda',
  MW: 'Africa/Blantyre',
  BI: 'Africa/Bujumbura',
  SS: 'Africa/Juba',
};

/**
 * Get the current time in a given timezone.
 * @param {string} timezone - IANA timezone string (e.g. 'Africa/Kinshasa')
 * @returns {Date} Current time in that timezone (as a Date object with local time values)
 */
export function getCurrentTimeInTimezone(timezone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * Get the current hour in a given timezone.
 */
export function getHourInTimezone(timezone) {
  return getCurrentTimeInTimezone(timezone).getHours();
}

/**
 * Get the current minute in a given timezone.
 */
export function getMinuteInTimezone(timezone) {
  return getCurrentTimeInTimezone(timezone).getMinutes();
}

/**
 * Resolve timezone from country code or region slug.
 */
export function resolveTimezone(countryCode, regionSlug) {
  if (regionSlug) {
    const regionMap = {
      kinshasa: 'Africa/Kinshasa',
      goma: 'Africa/Maputo',
      lubumbashi: 'Africa/Maputo',
    };
    if (regionMap[regionSlug]) return regionMap[regionSlug];
  }
  if (countryCode && COUNTRY_TIMEZONES[countryCode]) return COUNTRY_TIMEZONES[countryCode];
  return 'UTC';
}

/**
 * Format time as HH:MM in a timezone.
 */
export function formatTimeInTimezone(timezone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
