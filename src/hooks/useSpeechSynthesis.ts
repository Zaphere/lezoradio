import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface UseSpeechSynthesisResult {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  speaking: boolean;
  supported: boolean;
  voices: SpeechSynthesisVoice[];
}

/**
 * Browser-native Text-to-Speech using the Web Speech API.
 * Falls back gracefully when not supported.
 */
export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}): UseSpeechSynthesisResult {
  const { lang = 'fr-FR', rate = 1.0, pitch = 1.0, volume = 1.0 } = options;
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const findVoice = useCallback((targetLang: string): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Try exact match first (e.g., "fr-FR")
    let voice = voices.find(v => v.lang === targetLang);
    if (voice) return voice;

    // Try language prefix match (e.g., "fr" matches "fr-FR")
    const prefix = targetLang.split('-')[0].toLowerCase();
    voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (voice) return voice;

    // Try English fallback
    voice = voices.find(v => v.lang.startsWith('en'));
    return voice || voices[0] || null;
  }, [voices]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = findVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utterance.onpause = () => setSpeaking(false);
    utterance.onresume = () => setSpeaking(true);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [supported, lang, rate, pitch, volume, findVoice]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setSpeaking(false);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setSpeaking(true);
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return { speak, stop, pause, resume, speaking, supported, voices };
}
