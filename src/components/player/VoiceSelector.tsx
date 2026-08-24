import { useEffect, useState } from 'react';
import type { VoiceOption } from '../../lib/types';

interface Props {
  voices: VoiceOption[];
  selected: VoiceOption | null;
  onSelect: (voice: VoiceOption) => void;
}

export default function VoiceSelector({ voices, selected, onSelect }: Props) {
  const [loaded, setLoaded] = useState(voices.length > 0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (voices.length > 0) return;

    const handler = () => {
      setLoaded(true);
    };

    window.speechSynthesis.onvoiceschanged = handler;
    const timeout = setTimeout(() => setLoaded(true), 2000);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      clearTimeout(timeout);
    };
  }, [voices.length]);

  if (!loaded) {
    return (
      <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] p-5">
        <h4 className="text-sm font-semibold text-[#555555] dark:text-[#94A3B8] mb-2">Voice</h4>
        <div className="h-10 rounded-2xl bg-[#F8F8F8] dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] p-5">
      <h4 className="text-sm font-semibold text-[#555555] dark:text-[#94A3B8] mb-2">Voice</h4>
      <select
        value={selected?.voiceURI || ''}
        onChange={(e) => {
          const v = voices.find((v) => v.voiceURI === e.target.value);
          if (v) onSelect(v);
        }}
        className="w-full rounded-2xl bg-[#F8F8F8] dark:bg-white/10 px-4 py-2.5 text-sm text-[#111111] dark:text-[#F1F5F9] outline-none cursor-pointer appearance-none transition-colors"
      >
        <option value="" disabled>Select a voice</option>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} \u2014 {v.lang}
          </option>
        ))}
      </select>
    </div>
  );
}
