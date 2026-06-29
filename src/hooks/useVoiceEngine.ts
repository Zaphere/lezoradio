import { useRef, useCallback, useState } from 'react';
import type { VoiceOption } from '../lib/types';

export type VoiceState = 'idle' | 'speaking' | 'paused';

export function useVoiceEngine(onEmpty?: () => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [currentText, setCurrentText] = useState('');
  const speakingRef = useRef(false);
  const rateRef = useRef(0.85);
  const volumeRef = useRef(1);
  const voiceURIRef = useRef<string | null>(null);
  const onEmptyRef = useRef(onEmpty);
  onEmptyRef.current = onEmpty;

  const speak = useCallback((text: string, transition?: string) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setCurrentText(text);
      setState('speaking');
      setTimeout(() => { setState('idle'); setCurrentText(''); onEmptyRef.current?.(); }, text.length * 60);
      return;
    }

    synth.cancel();
    speakingRef.current = false;

    const fullText = transition ? `${transition} ${text}` : text;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rateRef.current;
    utterance.pitch = 1.0;
    utterance.volume = volumeRef.current;

    if (voiceURIRef.current) {
      const voices = synth.getVoices();
      const match = voices.find((v) => v.voiceURI === voiceURIRef.current);
      if (match) utterance.voice = match;
    } else {
      const voices = synth.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith('en-GB') || v.lang.startsWith('en-US'));
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      speakingRef.current = true;
      setState('speaking');
    };

    utterance.onend = () => {
      speakingRef.current = false;
      setState('idle');
      setCurrentText('');
      onEmptyRef.current?.();
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      setState('idle');
      setCurrentText('');
      onEmptyRef.current?.();
    };

    setCurrentText(fullText);
    setState('speaking');
    synth.speak(utterance);
  }, []);

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setState('speaking');
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setState('idle');
    setCurrentText('');
  }, []);

  const activate = useCallback((label = '') => {
    setCurrentText(label);
    setState('speaking');
  }, []);

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate;
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
  }, []);

  const setVoice = useCallback((voice: VoiceOption) => {
    voiceURIRef.current = voice.voiceURI;
  }, []);

  const isSpeaking = typeof window !== 'undefined' ? (window.speechSynthesis?.speaking ?? false) : false;

  return { speak, pause, resume, stop, activate, setRate, setVolume, setVoice, state, currentText, isSpeaking };
}
