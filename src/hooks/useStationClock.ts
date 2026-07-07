import { useState, useEffect, useRef } from 'react';
import type { StationTimeInfo } from '../lib/types';
import { getStationTimeInfo } from '../lib/stationTime';

export function useStationClock(timezone: string): StationTimeInfo {
  const [info, setInfo] = useState<StationTimeInfo>(() => getStationTimeInfo(timezone));
  const tzRef = useRef(timezone);
  tzRef.current = timezone;

  useEffect(() => {
    setInfo(getStationTimeInfo(tzRef.current));
    const interval = setInterval(() => {
      setInfo(getStationTimeInfo(tzRef.current));
    }, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  return info;
}
