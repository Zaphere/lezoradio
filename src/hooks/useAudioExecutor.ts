import { useState, useEffect, useRef, useCallback } from 'react';
import type { NowPlaying } from '../lib/types';
import { AudioManager } from '../services/audio/AudioManager';
import { TIMING } from '../lib/timing';

export interface AudioExecutorState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
}

interface UseAudioExecutorOptions {
  nowPlaying: NowPlaying | null;
  enabled?: boolean;
  onTrackEnd?: () => void;
}

interface UseAudioExecutorResult extends AudioExecutorState {
  setVolume: (vol: number) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  getAnalyser: () => AnalyserNode | null;
  resumeAudioContext: () => void;
}

/**
 * Reacts to NowPlaying state changes and drives AudioManager.
 *
 * State machine:
 *  - On new nowPlaying.version → determine transition type → execute
 *  - track/tts/jingle → play on track layer
 *  - intro → play on intro layer
 *  - ambient/track with background → start background layer
 *  - silence → stop all
 *
 * Exposes playback state for UI components.
 */
export function useAudioExecutor({
  nowPlaying,
  enabled = true,
  onTrackEnd,
}: UseAudioExecutorOptions): UseAudioExecutorResult {
  const [state, setState] = useState<AudioExecutorState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
  });

  const managerRef = useRef<AudioManager | null>(null);
  const versionRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const onTrackEndRef = useRef(onTrackEnd);
  onTrackEndRef.current = onTrackEnd;

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback(() => {
    clearProgressTimer();
    progressTimerRef.current = setInterval(() => {
      const mgr = managerRef.current;
      if (!mgr) return;
      const el = mgr.getTrackElement();
      if (!el || el.paused) return;
      const ct = el.currentTime;
      const dur = el.duration;
      if (Number.isFinite(ct) && Number.isFinite(dur) && dur > 0) {
        setState(prev => {
          if (prev.currentTime === ct && prev.duration === dur) return prev;
          return { ...prev, currentTime: ct, duration: dur };
        });
      }
    }, 250);
  }, [clearProgressTimer]);

  useEffect(() => {
    if (!enabled) return;

    const mgr = new AudioManager();
    managerRef.current = mgr;

    mgr.setTrackEndCallback(() => {
      clearProgressTimer();
      // Don't auto-advance while paused — user controls the session
      if (pausedRef.current) return;
      // DON'T restore background here — it stays ducked until the next ambient segment arrives.
      // This prevents the background from creeping up at the end of a presentation
      // if the audio file is slightly shorter than the estimated duration.
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }));
      onTrackEndRef.current?.();
    });

    mgr.setBackgroundEndCallback(() => {
      // Background track ended — refetch to get next content
      onTrackEndRef.current?.();
    });

    return () => {
      clearProgressTimer();
      mgr.dispose();
      managerRef.current = null;
    };
  }, [enabled, clearProgressTimer]);

  useEffect(() => {
    if (!nowPlaying || !enabled) return;
    if (nowPlaying.version <= versionRef.current) return;
    // Don't auto-play new segments while paused — user controls the session
    if (pausedRef.current) return;

    versionRef.current = nowPlaying.version;
    const mgr = managerRef.current;
    if (!mgr) return;

    clearProgressTimer();

    const { segmentType, audioUrl, transitionType, durationSeconds } = nowPlaying;

    if (segmentType === 'silence') {
      mgr.stopAll();
      setState({ isPlaying: false, isPaused: false, currentTime: 0, duration: 0 });
      return;
    }

    const handleTrackAudio = (url: string, _transition: typeof transitionType) => {
      const duration = durationSeconds > 0 ? durationSeconds * 1000 : 30000;

      // Ensure background music is always playing underneath the presenter
      // If background isn't running yet (e.g. user joined mid-bulletin), start it now
      if (nowPlaying?.backgroundAudioUrl && !mgr.isBackgroundPlaying) {
        mgr.startBackground(nowPlaying.backgroundAudioUrl, { loop: true });
      }

      // Duck background music — voice plays OVER music
      if (mgr.isBackgroundPlaying) {
        mgr.duckBackground(TIMING.INTRO_DUCK_DURATION);
      }

      // Play presenter voice/TTS track immediately
      mgr.playTrack(url);
      setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: duration / 1000 });
      startProgressTimer();
    };

    const handleIntro = (url: string) => {
      mgr.playIntro(url, () => {
        mgr.restoreBackground(TIMING.BACKGROUND_FADE_IN);
        setState(prev => ({ ...prev, isPlaying: false }));
      });
      setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: durationSeconds || 0 });
    };

    const handleBackground = (url: string) => {
      if (!mgr.isBackgroundPlaying) {
        // Start background music — loops continuously under TTS
        mgr.startBackground(url, { loop: true });
      } else if (url) {
        const currentBg = mgr.getBackgroundElement();
        if (currentBg && currentBg.src !== url) {
          // New background track — crossfade to it
          mgr.stopBackground(true);
          mgr.startBackground(url, { loop: true });
        } else {
          // Same background track — restore volume (was ducked during presenter)
          mgr.restoreBackground(TIMING.BACKGROUND_FADE_IN);
        }
      }
    };

    if (!audioUrl) {
      // No audio URL — ensure background keeps running
      if (segmentType !== 'ambient' && segmentType !== 'transition') {
        setState(prev => ({ ...prev, isPlaying: false }));
      }
      return;
    }

    switch (segmentType) {
      case 'track':
      case 'tts':
      case 'jingle':
      case 'bulletin':
      case 'announcement':
        handleTrackAudio(audioUrl, transitionType);
        break;
      case 'intro':
        handleIntro(audioUrl);
        break;
      case 'ambient':
        // Ambient = background music layer, ducked when foreground TTS plays
        handleBackground(audioUrl);
        break;
      case 'transition':
        // Don't stop background during transitions — just stop foreground track
        mgr.stopTrack(true);
        mgr.restoreBackground(TIMING.BACKGROUND_FADE_IN);
        setState({ isPlaying: false, isPaused: false, currentTime: 0, duration: 0 });
        break;
      default:
        break;
    }
  }, [nowPlaying, enabled, clearProgressTimer, startProgressTimer]);

  useEffect(() => {
    if (!state.isPlaying) {
      clearProgressTimer();
    }
  }, [state.isPlaying, clearProgressTimer]);

  const setVolume = useCallback((vol: number) => {
    managerRef.current?.setMasterVolume(vol);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    managerRef.current?.pauseAll();
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    managerRef.current?.resumeAll();
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const seek = useCallback((time: number) => {
    const el = managerRef.current?.getTrackElement();
    if (el && Number.isFinite(el.duration)) {
      el.currentTime = Math.max(0, Math.min(time, el.duration));
      setState(prev => ({ ...prev, currentTime: el.currentTime }));
    }
  }, []);

  const getAnalyser = useCallback(() => managerRef.current?.getAnalyser() ?? null, []);
  const resumeAudioContext = useCallback(() => managerRef.current?.resumeAudioContext(), []);

  return {
    ...state,
    setVolume,
    pause,
    resume,
    seek,
    getAnalyser,
    resumeAudioContext,
  };
}
