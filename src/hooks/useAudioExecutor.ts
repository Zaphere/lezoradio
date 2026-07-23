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
}

interface UseAudioExecutorResult extends AudioExecutorState {
  setVolume: (vol: number) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
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

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const mgr = new AudioManager();
    managerRef.current = mgr;

    mgr.setTrackEndCallback(() => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }));
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

    const handleTrackAudio = (url: string, transition: typeof transitionType) => {
      const duration = durationSeconds > 0 ? durationSeconds * 1000 : 30000;

      if (transition === 'duck' && mgr.isBackgroundPlaying) {
        mgr.duckBackground(TIMING.INTRO_DUCK_DURATION);
        setTimeout(() => {
          mgr.playTrack(url);
          setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: duration / 1000 });
        }, TIMING.INTRO_DUCK_DURATION);
      } else if (transition === 'crossfade' && mgr.isAnythingPlaying) {
        mgr.fadeOutAll(TIMING.CROSSFADE_DURATION, () => {
          mgr.playTrack(url);
          setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: duration / 1000 });
        });
      } else {
        mgr.stopAll();
        mgr.playTrack(url);
        setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: duration / 1000 });
      }
    };

    const handleIntro = (url: string) => {
      mgr.playIntro(url, () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      });
      setState({ isPlaying: true, isPaused: false, currentTime: 0, duration: durationSeconds || 0 });
    };

    const handleBackground = (url: string) => {
      if (!mgr.isBackgroundPlaying) {
        mgr.startBackground(url);
      }
    };

    if (!audioUrl) {
      if (segmentType !== 'ambient' && segmentType !== 'transition') {
        setState({ isPlaying: false, isPaused: false, currentTime: 0, duration: 0 });
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
        handleBackground(audioUrl);
        break;
      case 'transition':
        mgr.stopAll();
        setState({ isPlaying: false, isPaused: false, currentTime: 0, duration: 0 });
        break;
      default:
        break;
    }
  }, [nowPlaying, enabled, clearProgressTimer]);

  useEffect(() => {
    if (!state.isPlaying) {
      clearProgressTimer();
    }
  }, [state.isPlaying, clearProgressTimer]);

  const setVolume = useCallback((vol: number) => {
    managerRef.current?.setMasterVolume(vol);
  }, []);

  const pause = useCallback(() => {
    managerRef.current?.pauseAll();
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    managerRef.current?.resumeAll();
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const seek = useCallback((_time: number) => {
    // The current execution path manages playback through AudioManager, so seek is kept as a no-op until a dedicated media element is surfaced.
  }, []);

  return {
    ...state,
    setVolume,
    pause,
    resume,
    seek,
  };
}
