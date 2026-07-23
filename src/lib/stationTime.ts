// Adapter — re-exports from legacy until `useStationClock` reads timezone from `stations` table.
export {
  getStationTimeInfo,
  getStationHour,
  getStationMinute,
  getStationSecond,
  getStationTimeString,
  getStationDateString,
  resolveTimezone,
  getTimezoneAbbreviation,
  STATION_TIMEZONE_MAP,
  DRC_REGION_TIMEZONES,
} from '../_legacy/lib/stationTime';
