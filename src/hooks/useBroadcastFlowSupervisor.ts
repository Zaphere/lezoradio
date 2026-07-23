// @deprecated — archived in Phase 1 (2026-07-14). Replaced by backend engine modules and frontend useNowPlaying/useAudioExecutor.
import { useRef, useEffect, useState, useCallback } from 'react';
import type { BroadcastStateValue } from '../lib/types';
import {
  BFS_CONFIG,
  STATION_IDS,
  BRIDGE_INTROS,
  pickLine,
} from '../lib/broadcastFlowSupervisor';
import { TRANSITIONS } from '../lib/transitions';

type VoiceState = 'idle' | 'speaking' | 'paused';

interface UseBFSOptions {
  stationId: string;
  stationName: string;
  isLive: boolean;
  broadcastState: BroadcastStateValue;
  voiceState: VoiceState;
  isMusicMode: boolean;
  queueLength: number;
  playlistLength: number;
  isBehindLive: boolean;
  speak: (text: string) => void;
  fetchScripts: () => Promise<void>;
  onBridgeModeEnter: () => void;
  onBridgeModeExit: () => void;
  isPlaybackLocked?: boolean;
}

export type BFSStatus = 'monitoring' | 'recovering' | 'bridge' | 'healing';

export function useBroadcastFlowSupervisor(options: UseBFSOptions) {
  const [status, setStatus] = useState<BFSStatus>('monitoring');
  const [lastTransition, setLastTransition] = useState<string | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  const silenceStartRef = useRef<number | null>(null);
  const recoveringRef = useRef(false);
  const bridgeStartRef = useRef<number | null>(null);
  const bridgeVoiceTimeRef = useRef<number | null>(null);
  const hasHealedRef = useRef(false);
  const playedBridgeIntroRef = useRef(false);
  const lastBridgeCheckRef = useRef(0);
  const bridgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const {
      isLive,
      broadcastState,
      voiceState,
      isMusicMode,
      isBehindLive,
      queueLength,
      playlistLength,
      stationName,
      speak,
      fetchScripts,
      onBridgeModeEnter,
      onBridgeModeExit,
      isPlaybackLocked,
    } = optsRef.current;

    if (!isLive) {
      if (silenceStartRef.current !== null || bridgeTimeoutRef.current !== null) {
        if (bridgeTimeoutRef.current) {
          clearTimeout(bridgeTimeoutRef.current);
          bridgeTimeoutRef.current = null;
        }
        silenceStartRef.current = null;
        recoveringRef.current = false;
        bridgeStartRef.current = null;
        bridgeVoiceTimeRef.current = null;
        hasHealedRef.current = false;
        playedBridgeIntroRef.current = false;
        setStatus('monitoring');
      }
      return;
    }

    const isSilent = isLive
      && !playedBridgeIntroRef.current
      && broadcastState !== 'IDLE'
      && broadcastState !== 'STOPPING'
      && broadcastState !== 'INTRO_MUSIC'
      && broadcastState !== 'INTRO_DUCKING'
      && broadcastState !== 'HOST_INTRO'
      && voiceState !== 'speaking'
      && voiceState !== 'paused'
      && !isMusicMode
      && !isBehindLive
      && !isPlaybackLocked;

    const now = Date.now();

    if (isSilent) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = now;
      }

      const silentMs = now - silenceStartRef.current;

      if (silentMs >= BFS_CONFIG.SILENCE_THRESHOLD_MS && !recoveringRef.current) {
        recoveringRef.current = true;
        setStatus('recovering');

        const transition = pickLine(TRANSITIONS, stationName);
        speak(transition);
        setLastTransition(transition);

        fetchScripts().then(() => {
          const cur = optsRef.current;
          recoveringRef.current = false;

          if (cur.queueLength === 0 && cur.playlistLength === 0) {
            if (cur.isMusicMode) {
              setStatus('monitoring');
              return;
            }

            if (!playedBridgeIntroRef.current) {
              setStatus('bridge');
              bridgeStartRef.current = now;
              bridgeVoiceTimeRef.current = now;
              playedBridgeIntroRef.current = true;

              speak(pickLine(STATION_IDS, stationName));
              onBridgeModeEnter();

              if (bridgeTimeoutRef.current) clearTimeout(bridgeTimeoutRef.current);
              bridgeTimeoutRef.current = setTimeout(() => {
                const c = optsRef.current;
                if (c.isLive && playedBridgeIntroRef.current) {
                  speak(pickLine(BRIDGE_INTROS, stationName));
                  bridgeVoiceTimeRef.current = Date.now();
                }
              }, 3000);
            }

            if (bridgeStartRef.current) {
              const sinceBridge = now - bridgeStartRef.current;
              if (sinceBridge >= BFS_CONFIG.BRIDGE_CHECK_INTERVAL_MS) {
                const sinceLastCheck = now - lastBridgeCheckRef.current;
                if (sinceLastCheck >= BFS_CONFIG.MIN_BRIDGE_DURATION_MS) {
                  lastBridgeCheckRef.current = now;
                  fetchScripts().then(() => {
                    const c = optsRef.current;
                    if (c.queueLength > 0 || c.playlistLength > 0 || c.isMusicMode) {
                      bridgeStartRef.current = null;
                      bridgeVoiceTimeRef.current = null;
                      playedBridgeIntroRef.current = false;
                      if (bridgeTimeoutRef.current) {
                        clearTimeout(bridgeTimeoutRef.current);
                        bridgeTimeoutRef.current = null;
                      }
                      onBridgeModeExit();

                      if (c.isMusicMode) {
                        setStatus('monitoring');
                      } else {
                        setStatus('healing');
                        const heal = pickLine(TRANSITIONS, stationName);
                        speak(heal);
                        setLastTransition(heal);
                        setTimeout(() => setStatus('monitoring'), 2000);
                      }
                    }
                  });
                }
              }
            }
          } else {
            setStatus('healing');
            hasHealedRef.current = true;

            const heal = pickLine(TRANSITIONS, stationName);
            speak(heal);
            setLastTransition(heal);

            setTimeout(() => setStatus('monitoring'), 2000);
          }
        });
      }
    } else {
      silenceStartRef.current = null;
      if (recoveringRef.current) {
        recoveringRef.current = false;
        setStatus('monitoring');
      }
    }

    if (playedBridgeIntroRef.current && bridgeStartRef.current) {
      const curr = optsRef.current;
      if (curr.isMusicMode || curr.queueLength > 0 || curr.playlistLength > 0) {
        bridgeStartRef.current = null;
        bridgeVoiceTimeRef.current = null;
        playedBridgeIntroRef.current = false;
        if (bridgeTimeoutRef.current) {
          clearTimeout(bridgeTimeoutRef.current);
          bridgeTimeoutRef.current = null;
        }
        curr.onBridgeModeExit();

        if (curr.isMusicMode) {
          setStatus('monitoring');
        } else {
          setStatus('healing');
          const heal = pickLine(TRANSITIONS, stationName);
          speak(heal);
          setLastTransition(heal);
          setTimeout(() => setStatus('monitoring'), 2000);
        }
        return;
      }

      const sinceVoice = now - (bridgeVoiceTimeRef.current || now);
      if (sinceVoice >= BFS_CONFIG.SILENCE_THRESHOLD_MS) {
        speak(pickLine(STATION_IDS, stationName));
        bridgeVoiceTimeRef.current = Date.now();

        if (bridgeTimeoutRef.current) clearTimeout(bridgeTimeoutRef.current);
        bridgeTimeoutRef.current = setTimeout(() => {
          const c = optsRef.current;
          if (c.isLive && playedBridgeIntroRef.current) {
            speak(pickLine(BRIDGE_INTROS, stationName));
            bridgeVoiceTimeRef.current = Date.now();
          }
        }, 3000);
      }
    }

    if (queueLength === 0 && playlistLength === 0 && !recoveringRef.current && !hasHealedRef.current && !playedBridgeIntroRef.current) {
      fetchScripts();
    }
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, BFS_CONFIG.CHECK_INTERVAL_MS);
    tick();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bridgeTimeoutRef.current) clearTimeout(bridgeTimeoutRef.current);
    };
  }, [tick, options.isLive]);

  return { status, lastTransition };
}
