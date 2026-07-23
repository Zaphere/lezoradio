// @deprecated — archived in Phase 1 (2026-07-14). Replaced by backend engine modules and frontend useNowPlaying/useAudioExecutor.
import { useState, useRef, useCallback, useEffect } from 'react';
import type { RadioScript, Alert, QueueItem, BroadcastItem, VoiceOption, NewsItem, NewsCategory, BroadcastStateValue } from '../lib/types';
import { TRANSITIONS } from '../lib/transitions';
import { fetchRadioScripts, fetchAlerts, isDatabaseReady, markScriptAsRead, markNewsItemProcessed, fetchNewsItems } from '../lib/supabase';
import { newsItemToSpeech, isLezoTrafficItem, lezoTrafficItemToSpeech, lezoTrafficSegmentIntro } from '../lib/newsText';
import {
  loadBroadcastProgress,
  markItemPlayed,
  findFirstUnplayedIndex,
  findNextUnplayedIndex,
  clearBroadcastProgress,
  hasUnplayedItems,
  savePlaybackIndex,
} from '../lib/broadcastProgress';
import { useVoiceEngine } from './useVoiceEngine';
import { TrackAudio, getRandomSpeechGap } from '../services/audio/TrackAudio';
import { IntroAudio } from '../services/audio/IntroAudio';
import { BackgroundAudio } from '../services/audio/BackgroundAudio';
import {
  ENTERTAINMENT_TRACKS,
  commentaryAfterTrack,
  introBeforeTrack,
  entertainmentSegmentClose,
} from '../lib/entertainmentConfig';
import { pickLine, STATION_IDS } from '../lib/broadcastFlowSupervisor';
import { COMING_UP_TEASERS } from '../lib/transitions';

type EntertainmentPhase = 'track' | 'after-track' | 'before-track' | 'closing';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Wait this long after the last story before switching to entertainment. */
const ENTERTAINMENT_DELAY = 8000;
const BROADCAST_SEGMENT_MS = 4.5 * 60 * 1000; // rotate to entertainment after ~4.5 min of news
const FALLBACK_MESSAGE = 'No recent news feeds detected. Redirecting to our entertainment segment. Keep tuned and enjoy the session.';

function sortPlaylistOldestFirst(items: NewsItem[]): NewsItem[] {
  return [...items].sort(
    (a, b) => new Date(a.ingested_at).getTime() - new Date(b.ingested_at).getTime(),
  );
}

interface Props {
  stationId: string;
  stationName: string;
  stationRegion: string;
  newsCategory?: NewsCategory;
  testData?: {
    newsText?: string;
    alertMessage?: string;
  };
}

export function useRadioEngine({ stationId, stationName, stationRegion, newsCategory, testData }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [, setPlayedIds] = useState<Set<string>>(new Set());
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [nextUp, setNextUp] = useState<QueueItem[]>([]);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [isMusicMode, setIsMusicMode] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const tickRef = useRef<(() => Promise<void>) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<TrackAudio | null>(null);
  const introRef = useRef<IntroAudio | null>(null);
  const pendingSpeechRef = useRef<(() => void) | null>(null);
  const playlistRef = useRef<NewsItem[]>([]);
  const currentIndexRef = useRef(-1);
  const isIntroActiveRef = useRef(false);
  const isLiveRef = useRef(false);
  const isMusicModeRef = useRef(false);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const playItemAtRef = useRef<(index: number, options?: { withIntro?: boolean; stationIntro?: boolean }) => void>(() => {});
  const tryPlayNextUnplayedRef = useRef<(fromIndex: number, options?: { withIntro?: boolean; stationIntro?: boolean }) => boolean>(() => false);
  const scheduleEntertainmentRef = useRef<() => void>(() => {});
  const startEntertainmentRef = useRef<() => void>(() => {});
  const advanceEntertainmentRef = useRef<() => void>(() => {});

  const bgMusicRef = useRef<BackgroundAudio | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entertainmentActiveRef = useRef(false);
  const awaitingEntertainmentRef = useRef(false);
  const entertainmentIndexRef = useRef(0);
  const entertainmentPhaseRef = useRef<EntertainmentPhase>('track');
  const playbackLockRef = useRef(false);
  const [isPlaybackLocked, setIsPlaybackLocked] = useState(false);
  const stationIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStationIdTimeRef = useRef<number>(0);
  const storyCountRef = useRef(0);
  const timeAnnouncementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPlaybackLock = useCallback((val: boolean) => {
    playbackLockRef.current = val;
    setIsPlaybackLocked(val);
  }, []);


  const [playlist, setPlaylist] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isBehindLive, setIsBehindLive] = useState(false);
  const [isIntroActive, setIsIntroActive] = useState(false);
  const [entertainmentTrack, setEntertainmentTrack] = useState<string | null>(null);

  const mountedIndexRef = useRef(-1);

  useEffect(() => {
    const progress = loadBroadcastProgress(stationId, newsCategory);
    playedIdsRef.current = new Set(progress.playedIds);
    setPlayedIds(playedIdsRef.current);
    if (progress.lastIndex >= 0) {
      currentIndexRef.current = progress.lastIndex;
      setCurrentIndex(progress.lastIndex);
      mountedIndexRef.current = progress.lastIndex;
    }
  }, [stationId, newsCategory]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      savePlaybackIndex(stationId, newsCategory, currentIndexRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stationId, newsCategory]);

  isLiveRef.current = isLive;
  isMusicModeRef.current = isMusicMode;

  const onVoiceEnded = useCallback(() => {
    setPlaybackLock(false);

    if (awaitingEntertainmentRef.current) {
      awaitingEntertainmentRef.current = false;
      startEntertainmentRef.current();
      return;
    }

    if (entertainmentActiveRef.current) {
      advanceEntertainmentRef.current();
      return;
    }

    const idx = currentIndexRef.current;
    if (tryPlayNextUnplayedRef.current(idx)) return;
    tickRef.current?.();
    scheduleEntertainmentRef.current();
  }, []);

  const voice = useVoiceEngine(onVoiceEnded);
  const {
    speak: voiceSpeak,
    stop: voiceStop,
    activate: voiceActivate,
    setRate: voiceSetRate,
    setVolume: voiceSetVolume,
    setVoice: voiceSetVoice,
  } = voice;
  const voiceState = voice.state;

  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const scheduleSegmentEnd = useCallback(() => {
    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      if (!isLiveRef.current) return;
      if (isMusicModeRef.current) return;
      awaitingEntertainmentRef.current = true;
      voiceStop();
      clearSegmentTimer();
    }, BROADCAST_SEGMENT_MS);
  }, [voiceStop, clearSegmentTimer]);

  const scheduleStationId = useCallback(() => {
    if (stationIdTimerRef.current) {
      clearTimeout(stationIdTimerRef.current);
    }
    
    const randomInterval = 10 * 60 * 1000 + Math.random() * 5 * 60 * 1000; // 10-15 minutes
    stationIdTimerRef.current = setTimeout(() => {
      if (!isLiveRef.current) return;
      if (isMusicModeRef.current) return;
      if (isIntroActiveRef.current) return;
      if (voiceStateRef.current !== 'idle') return;
      
      const stationId = pickLine(STATION_IDS, stationName);
      voiceSpeak(stationId);
      lastStationIdTimeRef.current = Date.now();
      scheduleStationId();
    }, randomInterval);
  }, [stationName, voiceSpeak]);

  const clearStationIdTimer = useCallback(() => {
    if (stationIdTimerRef.current) {
      clearTimeout(stationIdTimerRef.current);
      stationIdTimerRef.current = null;
    }
  }, []);

  const scheduleTimeAnnouncement = useCallback(() => {
    if (timeAnnouncementTimerRef.current) {
      clearTimeout(timeAnnouncementTimerRef.current);
    }
    
    const randomInterval = 20 * 60 * 1000 + Math.random() * 10 * 60 * 1000; // 20-30 minutes
    timeAnnouncementTimerRef.current = setTimeout(() => {
      if (!isLiveRef.current) return;
      if (isMusicModeRef.current) return;
      if (isIntroActiveRef.current) return;
      if (voiceStateRef.current !== 'idle') return;
      
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
      const timeAnnouncement = `It's ${timeStr}. You're listening to ${stationName}.`;
      voiceSpeak(timeAnnouncement);
      scheduleTimeAnnouncement();
    }, randomInterval);
  }, [stationName, voiceSpeak]);

  const clearTimeAnnouncementTimer = useCallback(() => {
    if (timeAnnouncementTimerRef.current) {
      clearTimeout(timeAnnouncementTimerRef.current);
      timeAnnouncementTimerRef.current = null;
    }
  }, []);

  const stopMusic = useCallback(() => {
    trackRef.current?.stop();
    entertainmentActiveRef.current = false;
    awaitingEntertainmentRef.current = false;
    setEntertainmentTrack(null);
    setIsMusicMode(false);
    isMusicModeRef.current = false;
  }, []);

  const playEntertainmentTrack = useCallback((index: number) => {
    const track = ENTERTAINMENT_TRACKS[index];
    if (!track) return;

    entertainmentPhaseRef.current = 'track';
    setEntertainmentTrack(track.title);
    if (!trackRef.current) {
      trackRef.current = new TrackAudio();
    }

    trackRef.current.play(track.url, () => {
      entertainmentPhaseRef.current = 'after-track';
      setEntertainmentTrack(null);
      setTimeout(() => {
        voiceSpeak(commentaryAfterTrack(track, stationName));
      }, getRandomSpeechGap());
    });
  }, [stationName, voiceSpeak]);

  const endEntertainmentSegment = useCallback(async () => {
    entertainmentActiveRef.current = false;
    setEntertainmentTrack(null);
    trackRef.current?.stop();
    setIsMusicMode(false);
    isMusicModeRef.current = false;

    await tickRef.current?.();
    if (!tryPlayNextUnplayedRef.current(currentIndexRef.current)) {
      scheduleEntertainmentRef.current();
    }
  }, []);

  const advanceEntertainment = useCallback(() => {
    const phase = entertainmentPhaseRef.current;
    const index = entertainmentIndexRef.current;

    if (phase === 'after-track') {
      const nextIndex = index + 1;
      if (nextIndex < ENTERTAINMENT_TRACKS.length) {
        entertainmentPhaseRef.current = 'before-track';
        setTimeout(() => {
          voiceSpeak(introBeforeTrack(ENTERTAINMENT_TRACKS[nextIndex], stationName));
        }, getRandomSpeechGap());
      } else {
        entertainmentPhaseRef.current = 'closing';
        setTimeout(() => {
          voiceSpeak(entertainmentSegmentClose(stationName));
        }, getRandomSpeechGap());
      }
      return;
    }

    if (phase === 'before-track') {
      entertainmentIndexRef.current = index + 1;
      setTimeout(() => playEntertainmentTrack(index + 1), getRandomSpeechGap());
      return;
    }

    if (phase === 'closing') {
      void endEntertainmentSegment();
    }
  }, [stationName, voiceSpeak, playEntertainmentTrack, endEntertainmentSegment]);

  const startEntertainmentSegment = useCallback(() => {
    clearSegmentTimer();
    entertainmentActiveRef.current = true;
    entertainmentIndexRef.current = 0;
    setIsMusicMode(true);
    isMusicModeRef.current = true;
    playEntertainmentTrack(0);
  }, [playEntertainmentTrack, clearSegmentTimer]);

  startEntertainmentRef.current = startEntertainmentSegment;
  advanceEntertainmentRef.current = advanceEntertainment;

  const stopIntro = useCallback(() => {
    introRef.current?.stop();
    pendingSpeechRef.current = null;
    isIntroActiveRef.current = false;
    setIsIntroActive(false);
  }, []);

  const scheduleEntertainmentIfIdle = useCallback(() => {
    clearFallbackTimer();
    
    // Variable delay based on playlist length - shorter delay if few stories, longer if many
    const playlistLength = playlistRef.current.length;
    const unplayedCount = playlistRef.current.filter(item => !playedIdsRef.current.has(item.id)).length;
    
    // Base delay is 8 seconds, but adjust based on content availability
    let adjustedDelay = ENTERTAINMENT_DELAY;
    if (unplayedCount === 0 && playlistLength > 0) {
      // All stories played, shorter delay to entertainment
      adjustedDelay = 5000;
    } else if (playlistLength >= 10) {
      // Plenty of content, longer delay
      adjustedDelay = 12000;
    } else if (playlistLength >= 5) {
      // Moderate content, medium delay
      adjustedDelay = 8000;
    } else {
      // Limited content, shorter delay
      adjustedDelay = 5000;
    }
    
    fallbackTimerRef.current = setTimeout(() => {
      if (!isLiveRef.current) return;
      if (isMusicModeRef.current) return;
      if (hasUnplayedItems(playlistRef.current, playedIdsRef.current)) return;
      if (voiceState !== 'idle' || isIntroActiveRef.current) return;

      setIsMusicMode(true);
      isMusicModeRef.current = true;
      awaitingEntertainmentRef.current = true;
      voiceSpeak(FALLBACK_MESSAGE);
    }, adjustedDelay);
  }, [voiceState, voiceSpeak, clearFallbackTimer]);

  scheduleEntertainmentRef.current = scheduleEntertainmentIfIdle;

  const playWithIntro = useCallback((speakFn: () => void) => {
    stopMusic();
    clearFallbackTimer();
    if (!introRef.current) {
      introRef.current = new IntroAudio();
    }
    pendingSpeechRef.current = speakFn;
    voiceActivate('Starting broadcast…');
    introRef.current.play(() => {
      pendingSpeechRef.current = null;
      speakFn();
    });
  }, [stopMusic, clearFallbackTimer, voiceActivate]);

  const playItemAt = useCallback((index: number, options?: { withIntro?: boolean; stationIntro?: boolean; force?: boolean }) => {
    if (playbackLockRef.current) return;

    const items = playlistRef.current;
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    if (playedIdsRef.current.has(item.id) && !options?.force) {
      tryPlayNextUnplayedRef.current(index, options);
      return;
    }

    setPlaybackLock(true);

    stopMusic();
    clearFallbackTimer();

    currentIndexRef.current = index;
    setCurrentIndex(index);
    savePlaybackIndex(stationId, newsCategory, index);

    markNewsItemProcessed(item.id);
    playedIdsRef.current = markItemPlayed(stationId, newsCategory, item.id, playedIdsRef.current, index);
    setPlayedIds(new Set(playedIdsRef.current));

    const isLezo = isLezoTrafficItem(item);
    const text = isLezo ? lezoTrafficItemToSpeech(item) : newsItemToSpeech(item);
    const isFirst = !!(options?.stationIntro);
    
    // Insert teaser every 3-5 stories
    storyCountRef.current += 1;
    const shouldTease = storyCountRef.current > 0 && storyCountRef.current % 4 === 0;
    const teaser = shouldTease ? COMING_UP_TEASERS[Math.floor(Math.random() * COMING_UP_TEASERS.length)] : null;
    
    const transition = isFirst
      ? `Now broadcasting from ${stationName}.`
      : isLezo
        ? lezoTrafficSegmentIntro(item, stationName)
        : TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];

    const speak = () => {
      isIntroActiveRef.current = false;
      setIsIntroActive(false);
      const fullTransition = teaser ? `${teaser} ${transition}` : transition;
      voiceSpeak(text, fullTransition);
      scheduleSegmentEnd();
    };

    if (options?.withIntro) {
      isIntroActiveRef.current = true;
      setIsIntroActive(true);
      playWithIntro(speak);
    } else {
      stopIntro();
      speak();
    }
  }, [stationId, stationName, newsCategory, voiceSpeak, playWithIntro, stopIntro, stopMusic, clearFallbackTimer, scheduleSegmentEnd]);

  const tryPlayNextUnplayed = useCallback((
    fromIndex: number,
    options?: { withIntro?: boolean; stationIntro?: boolean },
  ): boolean => {
    const items = playlistRef.current;
    const nextIdx = findNextUnplayedIndex(items, playedIdsRef.current, fromIndex);
    if (nextIdx >= 0) {
      playItemAt(nextIdx, options);
      return true;
    }
    return false;
  }, [playItemAt]);

  playItemAtRef.current = playItemAt;
  tryPlayNextUnplayedRef.current = tryPlayNextUnplayed;

  const beginFromNextUnplayed = useCallback((withIntro = false) => {
    const items = playlistRef.current;
    const firstUnplayed = findFirstUnplayedIndex(items, playedIdsRef.current);
    if (firstUnplayed < 0) {
      scheduleEntertainmentIfIdle();
      return false;
    }
    playItemAt(firstUnplayed, { withIntro, stationIntro: withIntro });
    return true;
  }, [playItemAt, scheduleEntertainmentIfIdle]);

  const setFeedItems = useCallback((items: NewsItem[]) => {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = item.url || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const lezoItems = unique.filter(item => isLezoTrafficItem(item));
    const otherItems = unique.filter(item => !isLezoTrafficItem(item));

    const sortedLezo = sortPlaylistOldestFirst(lezoItems);
    const sortedOther = sortPlaylistOldestFirst(otherItems);

    const sorted = [...sortedLezo, ...sortedOther];
    playlistRef.current = sorted;
    setPlaylist(sorted);

    if (!isLiveRef.current) return;

    const currentItem = currentIndexRef.current >= 0 && currentIndexRef.current < playlistRef.current.length
      ? playlistRef.current[currentIndexRef.current]
      : null;

    const hasNewLezo = sortedLezo.some(item => !playedIdsRef.current.has(item.id));
    const isCurrentlyLezo = currentItem && isLezoTrafficItem(currentItem);

    if (hasNewLezo && !isCurrentlyLezo && voiceStateRef.current === 'speaking' && !isIntroActiveRef.current) {
      voiceStop();
      stopMusic();
      stopIntro();
      clearFallbackTimer();
      let nextIdx = findFirstUnplayedIndex(sorted, playedIdsRef.current);
      if (nextIdx >= 0) {
        playItemAt(nextIdx);
      }
      return;
    }

    if (voiceStateRef.current !== 'idle' || isIntroActiveRef.current) return;

    let nextIdx = -1;
    if (currentIndexRef.current >= 0) {
      nextIdx = findNextUnplayedIndex(sorted, playedIdsRef.current, currentIndexRef.current);
    }
    if (nextIdx < 0) {
      nextIdx = findFirstUnplayedIndex(sorted, playedIdsRef.current);
    }

    if (nextIdx >= 0) {
      stopMusic();
      clearFallbackTimer();
      playItemAt(nextIdx);
    }
  }, [playItemAt, stopMusic, clearFallbackTimer, voiceStop, stopIntro]);

  const startNewsPlaylist = useCallback((items: NewsItem[], withIntro = false) => {
    playlistRef.current = sortPlaylistOldestFirst(items);
    setPlaylist(playlistRef.current);
    beginFromNextUnplayed(withIntro);
  }, [beginFromNextUnplayed]);

  const skipNext = useCallback(() => {
    voiceStop();
    stopIntro();
    isIntroActiveRef.current = false;
    setIsIntroActive(false);
    if (!tryPlayNextUnplayed(currentIndexRef.current)) {
      scheduleEntertainmentIfIdle();
    }
  }, [voiceStop, stopIntro, tryPlayNextUnplayed, scheduleEntertainmentIfIdle]);

  const skipIntro = useCallback(() => {
    const pending = pendingSpeechRef.current;
    introRef.current?.skip(pending ?? undefined);
    pendingSpeechRef.current = null;
    isIntroActiveRef.current = false;
    setIsIntroActive(false);
  }, []);

  const goLive = useCallback(() => {
    const items = playlistRef.current;
    if (items.length === 0) return;
    setPlaybackLock(false);
    for (let i = items.length - 1; i >= 0; i--) {
      if (!playedIdsRef.current.has(items[i].id)) {
        playItemAt(i);
        return;
      }
    }
    playItemAt(items.length - 1);
  }, [playItemAt]);

  const jumpToIndex = useCallback((index: number) => {
    const items = playlistRef.current;
    if (index < 0 || index >= items.length) return;
    setPlaybackLock(false);
    voiceStop();
    stopIntro();
    stopMusic();
    playItemAt(index, { force: true });
  }, [voiceStop, stopIntro, stopMusic, playItemAt]);

  useEffect(() => {
    const items = playlist;
    if (currentIndex < 0 || items.length === 0) {
      setIsBehindLive(false);
      return;
    }
    let behind = false;
    for (let i = currentIndex + 1; i < items.length; i++) {
      if (!playedIdsRef.current.has(items[i].id)) {
        behind = true;
        break;
      }
    }
    setIsBehindLive(behind);
  }, [playlist, currentIndex]);

  const scriptsToItems = useCallback((scripts: RadioScript[]): QueueItem[] => {
    const priorityMap: Record<string, number> = {
      alert: 1, traffic: 2, local: 3, regional: 4, global: 5,
    };
    return scripts
      .filter((s) => !playedIdsRef.current.has(s.id))
      .map((s) => ({ script: s, priority: priorityMap[s.category] || 6 }))
      .sort((a, b) => a.priority - b.priority);
  }, []);

  const playFromQueue = useCallback((withIntro = false) => {
    const q = queueRef.current;
    if (q.length === 0) return;

    const item = q.shift()!;
    setQueue([...q]);
    setNextUp(q.slice(0, 3));
    playedIdsRef.current.add(item.script.id);
    setPlayedIds(new Set(playedIdsRef.current));
    markScriptAsRead(item.script.id);

    const intro = `Now broadcasting from ${stationName}.`;
    const speak = () => voiceSpeak(item.script.script, intro);
    if (withIntro) {
      playWithIntro(speak);
    } else {
      speak();
    }
  }, [stationName, voiceSpeak, playWithIntro]);

  const processAlerts = useCallback(async () => {
    try {
      const alerts = await fetchAlerts();
      if (alerts.length > 0) {
        const top = alerts[0] as Alert;
        voiceStop();
        stopMusic();
        stopIntro();
        clearFallbackTimer();
        setActiveAlert(top);
        voiceSpeak(`BREAKING NEWS ALERT: ${top.title}. ${top.message}`);
        setTimeout(() => setActiveAlert(null), 5000);
      }
    } catch (err) {
      console.warn('[RadioEngine] Failed to process alerts:', err);
    }
  }, [voiceStop, voiceSpeak, stopMusic, stopIntro, clearFallbackTimer]);

  const processQueue = useCallback(async () => {
    try {
      if (playlistRef.current.length > 0) {
        if (isLiveRef.current && voiceState === 'idle' && !isIntroActiveRef.current && !playbackLockRef.current) {
          if (!tryPlayNextUnplayed(currentIndexRef.current)) {
            scheduleEntertainmentIfIdle();
          }
        }
        return;
      }

      const scripts = await fetchRadioScripts(stationRegion || undefined, newsCategory);
      const items = scriptsToItems(scripts as RadioScript[]);
      if (items.length === 0) {
        if (isLiveRef.current && voiceState === 'idle' && !playbackLockRef.current) {
          scheduleEntertainmentIfIdle();
        }
        return;
      }

      stopMusic();
      clearFallbackTimer();

      const existingIds = new Set(queueRef.current.map((q) => q.script.id));
      for (const item of items) {
        if (!existingIds.has(item.script.id) && !playedIdsRef.current.has(item.script.id)) {
          queueRef.current.push(item);
          existingIds.add(item.script.id);
        }
      }
      queueRef.current.sort((a, b) => a.priority - b.priority);
      setQueue([...queueRef.current]);
      setNextUp(queueRef.current.slice(0, 3));

      if (voiceState === 'idle' && queueRef.current.length > 0 && !playbackLockRef.current) {
        playFromQueue();
      }
    } catch (err) {
      console.warn('[RadioEngine] Failed to process queue:', err);
    }
  }, [scriptsToItems, voiceState, stationRegion, newsCategory, playFromQueue, stopMusic, clearFallbackTimer, tryPlayNextUnplayed, scheduleEntertainmentIfIdle]);

  const tick = useCallback(async () => {
    await processAlerts();
    await processQueue();
  }, [processAlerts, processQueue]);

  tickRef.current = tick;

  const start = useCallback(async () => {
    setIsLive(true);
    setIsMusicMode(false);
    isLiveRef.current = true;
    isMusicModeRef.current = false;
    stopMusic();
    clearFallbackTimer();

    try {
      const ready = await isDatabaseReady();
      setDbReady(ready);

      let startedPlaying = false;
      // Refresh news data before attempting playback — fixes immediate music fallback
      if (playlistRef.current.length === 0) {
        try {
          const freshItems = await fetchNewsItems(stationRegion, newsCategory);
          if (freshItems.length > 0) {
            startNewsPlaylist(freshItems as NewsItem[], true);
            startedPlaying = true;
          }
        } catch (err) {
          console.warn('[RadioEngine] Failed to fetch news on start:', err);
        }
      }

      if (ready) {
        pollingRef.current = setInterval(tick, 15000);
      }

      scheduleStationId();
      scheduleTimeAnnouncement();

      if (!startedPlaying) {
        if (playlistRef.current.length > 0) {
          beginFromNextUnplayed(true);
        } else {
          await tick();
          if (!beginFromNextUnplayed(false)) {
            scheduleEntertainmentIfIdle();
          }
        }
      }
    } catch (err) {
      console.warn('[RadioEngine] Failed to start:', err);
      setDbReady(false);
      scheduleEntertainmentIfIdle();
    }
  }, [tick, beginFromNextUnplayed, scheduleEntertainmentIfIdle, stopMusic, clearFallbackTimer, startNewsPlaylist, stationRegion, newsCategory, scheduleStationId, scheduleTimeAnnouncement]);

  const stop = useCallback(() => {
    setPlaybackLock(false);
    if (currentIndexRef.current >= 0) {
      savePlaybackIndex(stationId, newsCategory, currentIndexRef.current);
    }
    clearSegmentTimer();
    clearStationIdTimer();
    clearTimeAnnouncementTimer();
    setIsLive(false);
    isLiveRef.current = false;
    stopMusic();
    stopIntro();
    clearFallbackTimer();
    voiceStop();
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [voiceStop, stopMusic, stopIntro, clearFallbackTimer, clearSegmentTimer, clearStationIdTimer, clearTimeAnnouncementTimer, stationId, newsCategory]);

  const simulateNews = useCallback((options?: { withIntro?: boolean }) => {
    const text = testData?.newsText || `This is a simulated news broadcast for ${stationName}. In today's headlines, developments continue across the region. Officials report progress on key initiatives. Community leaders respond to recent announcements.`;
    const fakeScript: RadioScript = {
      id: uuidv4(),
      news_item_id: uuidv4(),
      script: text,
      region: stationName,
      category: 'local',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const item: QueueItem = { script: fakeScript, priority: 3 };

    stopMusic();
    clearFallbackTimer();
    queueRef.current.push(item);
    queueRef.current.sort((a, b) => a.priority - b.priority);
    setQueue([...queueRef.current]);
    setNextUp(queueRef.current.slice(0, 3));

    if (voiceState === 'idle') {
      playFromQueue(options?.withIntro);
    }
  }, [stationName, testData, voiceState, playFromQueue, stopMusic, clearFallbackTimer]);

  const triggerAlert = useCallback(() => {
    const msg = testData?.alertMessage || `This is a test of the emergency alert system. Please stand by for important information.`;
    voiceStop();
    stopMusic();
    stopIntro();
    clearFallbackTimer();
    setActiveAlert({
      id: `alert-${Date.now()}`,
      title: 'Test Emergency Alert',
      message: msg,
      severity: 'high',
      region: stationName,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    voiceSpeak(`BREAKING NEWS ALERT: Test Emergency Alert. ${msg}`);
    setTimeout(() => setActiveAlert(null), 5000);
  }, [stationName, testData, voiceStop, voiceSpeak, stopMusic, stopIntro, clearFallbackTimer]);

  const resetQueue = useCallback(() => {
    setPlaybackLock(false);
    voiceStop();
    stopMusic();
    stopIntro();
    clearFallbackTimer();
    queueRef.current = [];
    setQueue([]);
    playedIdsRef.current = new Set();
    setPlayedIds(new Set());
    setNextUp([]);
    setActiveAlert(null);
    currentIndexRef.current = -1;
    setCurrentIndex(-1);
    clearBroadcastProgress(stationId, newsCategory);
  }, [voiceStop, stopMusic, stopIntro, clearFallbackTimer, stationId, newsCategory]);

  const setRate = useCallback((rate: number) => {
    voiceSetRate(rate);
  }, [voiceSetRate]);

  const setVolume = useCallback((volume: number) => {
    voiceSetVolume(volume);
    introRef.current?.setVolume(volume);
    trackRef.current?.setVolume(volume);
  }, [voiceSetVolume]);

  const setVoice = useCallback((v: VoiceOption) => {
    voiceSetVoice(v);
  }, [voiceSetVoice]);

  const speakNewsFeed = useCallback((items: NewsItem[], withIntro = false) => {
    startNewsPlaylist(items, withIntro);
  }, [startNewsPlaylist]);

  const enqueueItems = useCallback((items: BroadcastItem[], withIntro = false) => {
    if (items.length === 0) return;

    const text = items.map((item) => `${item.title}. ${item.body}`).join(' ');
    const speak = () => voiceSpeak(text, `Now broadcasting from ${stationName}.`);

    stopMusic();
    clearFallbackTimer();
    if (withIntro) {
      playWithIntro(speak);
    } else {
      speak();
    }
  }, [stationName, voiceSpeak, stopMusic, clearFallbackTimer, playWithIntro]);

  useEffect(() => {
    introRef.current = new IntroAudio();
    introRef.current.preload();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearFallbackTimer();
      clearSegmentTimer();
      trackRef.current?.stop(false);
      introRef.current?.stop(false);
      bgMusicRef.current?.stop(false);
      voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLive && !isMusicMode && !isIntroActive) {
      if (!bgMusicRef.current) bgMusicRef.current = new BackgroundAudio();
      bgMusicRef.current.start();
    } else {
      bgMusicRef.current?.stop(true);
    }
  }, [isLive, isMusicMode, isIntroActive]);

  const currentItem = currentIndex >= 0 ? playlist[currentIndex] ?? null : null;

  const broadcastState: BroadcastStateValue = !isLive ? 'IDLE' : isMusicMode ? 'ENTERTAINMENT' : isIntroActive ? 'INTRO_MUSIC' : 'NEWS_SEGMENT';

  const requestChannelSwitch = useCallback(() => {
    setPlaybackLock(false);
    voiceStop();
    stopMusic();
    stopIntro();
    clearFallbackTimer();
    currentIndexRef.current = -1;
    setCurrentIndex(-1);
    setIsMusicMode(false);
    setIsLive(false);
    isLiveRef.current = false;
  }, [voiceStop, stopMusic, stopIntro, clearFallbackTimer]);

  const speakBulletin = useCallback((text: string, intro?: string) => {
    voiceStop();
    clearFallbackTimer();
    if (intro) {
      voiceSpeak(text, intro);
    } else {
      voiceSpeak(text);
    }
  }, [voiceStop, voiceSpeak, clearFallbackTimer]);

  return {
    ...voice,
    queue, nextUp, activeAlert, isLive, dbReady, isMusicMode, entertainmentTrack,
    playlist, currentIndex, currentItem, isIntroActive, isBehindLive,
    broadcastState, isPlaybackLocked,
    start, stop, simulateNews, triggerAlert, resetQueue,
    setRate, setVolume, setVoice, enqueueItems, speakNewsFeed,
    setFeedItems, skipNext, skipIntro,
    goLive, jumpToIndex, requestChannelSwitch, speakBulletin,
  };
}
