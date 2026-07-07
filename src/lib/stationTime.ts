import type { StationTimeInfo } from './types';

export const STATION_TIMEZONE_MAP: Record<string, string> = {
  ZA: 'Africa/Johannesburg',
  ZM: 'Africa/Lusaka',
  MW: 'Africa/Blantyre',
  BW: 'Africa/Gaborone',
  NA: 'Africa/Windhoek',
  MZ: 'Africa/Maputo',
  CD: 'Africa/Kinshasa',
  CG: 'Africa/Brazzaville',
  CM: 'Africa/Douala',
  GA: 'Africa/Libreville',
  CF: 'Africa/Bangui',
  TD: 'Africa/Ndjamena',
  TZ: 'Africa/Dar_es_Salaam',
  KE: 'Africa/Nairobi',
  UG: 'Africa/Kampala',
  RW: 'Africa/Kigali',
  BI: 'Africa/Bujumbura',
  SS: 'Africa/Juba',
  EG: 'Africa/Cairo',
  DZ: 'Africa/Algiers',
  MA: 'Africa/Casablanca',
  TN: 'Africa/Tunis',
};

export const DRC_REGION_TIMEZONES: Record<string, string> = {
  kinshasa: 'Africa/Kinshasa',
  goma: 'Africa/Maputo',
  lubumbashi: 'Africa/Maputo',
};

export function resolveTimezone(stationTimezone?: string | null, countryCode?: string, regionSlug?: string): string {
  if (stationTimezone) return stationTimezone;
  if (regionSlug && DRC_REGION_TIMEZONES[regionSlug]) return DRC_REGION_TIMEZONES[regionSlug];
  if (countryCode && STATION_TIMEZONE_MAP[countryCode]) return STATION_TIMEZONE_MAP[countryCode];
  return 'UTC';
}

export function getStationDate(timezone: string): Date {
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

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
}

export function getStationHour(timezone: string): number {
  return getStationDate(timezone).getHours();
}

export function getStationMinute(timezone: string): number {
  return getStationDate(timezone).getMinutes();
}

export function getStationSecond(timezone: string): number {
  return getStationDate(timezone).getSeconds();
}

export function getStationTimeString(timezone: string, showSeconds = false): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (showSeconds) opts.second = '2-digit';
  return new Intl.DateTimeFormat('en-US', opts).format(new Date());
}

export function getStationDateString(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

export function getStationTimeInfo(timezone: string): StationTimeInfo {
  const localDate = getStationDate(timezone);
  return {
    timezone,
    localTime: localDate,
    localHour: localDate.getHours(),
    localMinute: localDate.getMinutes(),
    timeString: getStationTimeString(timezone),
    dateString: getStationDateString(timezone),
  };
}

export function getTimezoneAbbreviation(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone.split('/').pop() ?? timezone;
  } catch {
    return timezone.split('/').pop() ?? timezone;
  }
}
