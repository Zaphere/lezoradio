import { useState, useRef, useEffect } from 'react';
import {
  getFrenchBulletinSlot,
  getNextBulletinTimeString,
  isFrenchBulletinTime,
} from '../lib/frenchBulletin';
import { getStationHour } from '../lib/stationTime';

interface UseFrenchBulletinOptions {
  timezone: string;
  stationId: string;
  isLive: boolean;
  onTrigger: (hour: number) => void;
}

export function useFrenchBulletin(options: UseFrenchBulletinOptions) {
  const { timezone, stationId, isLive, onTrigger } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [nextBulletinTime, setNextBulletinTime] = useState<string>('--:--');
  const [activeBulletinHour, setActiveBulletinHour] = useState<number | null>(null);
  const lastTriggeredSlotRef = useRef<string>('');
  const playingRef = useRef(false);

  useEffect(() => {
    setNextBulletinTime(getNextBulletinTimeString(timezone));
    setActiveBulletinHour(isFrenchBulletinTime(timezone) ? getStationHour(timezone) : null);

    const interval = setInterval(() => {
      setNextBulletinTime(getNextBulletinTimeString(timezone));

      const slot = getFrenchBulletinSlot(timezone);
      if (slot && isLive) {
        const slotKey = `${stationId}-${slot.hour}`;
        if (lastTriggeredSlotRef.current !== slotKey && !playingRef.current) {
          lastTriggeredSlotRef.current = slotKey;
          setActiveBulletinHour(slot.hour);
          playingRef.current = true;
          setIsPlaying(true);
          onTrigger(slot.hour);
        }
      } else {
        setActiveBulletinHour(isFrenchBulletinTime(timezone) ? getStationHour(timezone) : null);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [timezone, stationId, isLive, onTrigger]);

  function markComplete() {
    playingRef.current = false;
    setIsPlaying(false);
  }

  return {
    isPlaying,
    nextBulletinTime,
    activeBulletinHour,
    markComplete,
  };
}
