// @deprecated — archived in Phase 1 (2026-07-14). Replaced by backend engine modules and frontend useNowPlaying/useAudioExecutor.
import { useRef, useCallback, useState, useEffect } from 'react';
import type { VoiceOption } from '../lib/types';
import { ElevenLabsTTS } from '../services/tts/elevenlabsTTS';

export type VoiceState = 'idle' | 'speaking' | 'paused';

export function useVoiceEngine(onEnd?: () => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [currentText, setCurrentText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const ttsRef = useRef<ElevenLabsTTS | null>(null);
  const rateRef = useRef(0.85);
  const volumeRef = useRef(1);
  const voiceIdRef = useRef<string>('');
  const speakLockRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID as string || '3IyGWZwOTNraZr1Tz0fI';
    voiceIdRef.current = voiceId;

    const tts = new ElevenLabsTTS(apiKey, voiceId);
    tts.onEnd = () => {
      speakLockRef.current = false;
      setCurrentTime(0);
      setDuration(0);
      setState('idle');
      setCurrentText('');
      onEnd?.();
    };
    tts.onError = () => {
      speakLockRef.current = false;
      setCurrentTime(0);
      setDuration(0);
      setState('idle');
      setCurrentText('');
    };
    ttsRef.current = tts;

    return () => {
      cancelAnimationFrame(rafRef.current);
      tts.stop();
    };
  }, []);

  useEffect(() => {
    if (state !== 'speaking') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const poll = () => {
      const tts = ttsRef.current;
      if (tts) {
        setCurrentTime(tts.getCurrentTime());
        const d = tts.getDuration();
        if (d > 0) setDuration(d);
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);

    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  const speak = useCallback((text: string, transition?: string) => {
    const tts = ttsRef.current;
    if (!tts) return;
    if (speakLockRef.current) return;
    speakLockRef.current = true;

    const fullText = transition ? `${transition} ${text}` : text;
    setCurrentText(fullText);
    setCurrentTime(0);
    setDuration(0);
    setState('speaking');
    tts.speak(fullText);
  }, []);

  const pause = useCallback(() => {
    ttsRef.current?.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    ttsRef.current?.resume();
    setState('speaking');
  }, []);

  const stop = useCallback(() => {
    speakLockRef.current = false;
    cancelAnimationFrame(rafRef.current);
    ttsRef.current?.stop();
    setCurrentTime(0);
    setDuration(0);
    setState('idle');
    setCurrentText('');
  }, []);

  const seek = useCallback((time: number) => {
    ttsRef.current?.seek(time);
    setCurrentTime(time);
  }, []);

  const activate = useCallback((label = '') => {
    setCurrentText(label);
    setState('speaking');
  }, []);

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate;
    ttsRef.current?.setRate(rate);
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
    ttsRef.current?.setVolume(volume);
  }, []);

  const setVoice = useCallback((voice: VoiceOption) => {
    voiceIdRef.current = voice.providerVoiceId || voice.voiceURI || voiceIdRef.current;
    ttsRef.current?.setVoice(voice);
  }, []);

  const setLanguage = useCallback((_lang: string) => {
    // Not applicable for ElevenLabs — model auto-detects language
  }, []);

  const setLastText = useCallback((text: string) => {
    ttsRef.current?.setLastText(text);
  }, []);

  const clearCache = useCallback(() => {
    ttsRef.current?.clearCache();
  }, []);

  const isSpeaking = state === 'speaking';

  return { speak, pause, resume, stop, seek, activate, setRate, setVolume, setVoice, setLanguage, setLastText, clearCache, state, currentTime, duration, currentText, isSpeaking };
}
