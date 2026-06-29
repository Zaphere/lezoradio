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
      <div className="glass rounded-2xl p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Voice</h4>
        <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Voice</h4>
      <select
        value={selected?.voiceURI || ''}
        onChange={(e) => {
          const v = voices.find((v) => v.voiceURI === e.target.value);
          if (v) onSelect(v);
        }}
        className="w-full rounded-xl bg-white/10 border border-border/50 px-3 py-2 
                   text-xs text-text-primary outline-none focus:border-primary/50 
                   transition-colors cursor-pointer appearance-none"
      >
        <option value="" disabled>Select a voice</option>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} — {v.lang}
          </option>
        ))}
      </select>
    </div>
  );
}
