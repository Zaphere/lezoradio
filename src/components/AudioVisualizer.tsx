import { useEffect, useRef } from 'react';

interface Props {
  isPlaying: boolean;
  analyser?: AnalyserNode | null;
  size?: 'small' | 'medium' | 'large';
}

const BAR_COUNT = 16;

export default function AudioVisualizer({ isPlaying, analyser, size = 'medium' }: Props) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || !analyser) {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = '8px';
      });
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / BAR_COUNT);

      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        const slice = data.slice(idx * step, (idx + 1) * step);
        const avg = slice.reduce((sum, v) => sum + v, 0) / Math.max(slice.length, 1);
        const pct = Math.max(12, Math.min(100, (avg / 255) * 100 + 8));
        bar.style.height = `${pct}%`;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, analyser]);

  const sizeClasses = {
    small: 'h-6 gap-0.5',
    medium: 'h-12 gap-0.5 px-4',
    large: 'h-14 gap-1 px-6',
  };

  const barWidths = {
    small: 'w-0.5',
    medium: 'w-1.5',
    large: 'w-2',
  };

  return (
    <div className={`flex items-end justify-center w-full max-w-xs mx-auto ${sizeClasses[size]} ${isPlaying ? 'visualizer-glow' : ''}`}>
      {Array.from({ length: BAR_COUNT }).map((_, idx) => (
        <div
          key={idx}
          ref={(el) => { barsRef.current[idx] = el; }}
          className={`${barWidths[size]} rounded-full transition-[height] duration-75 ease-out ${
            isPlaying
              ? 'bg-[#00A651] shadow-[0_2px_8px_rgba(0,166,81,0.2)]'
              : 'bg-[#00A651]/20'
          }`}
          style={{ height: '8px' }}
        />
      ))}
    </div>
  );
}
