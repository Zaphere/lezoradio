import { useEffect, useState } from 'react';

interface Props {
  isPlaying: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function AudioVisualizer({ isPlaying, size = 'medium' }: Props) {
  const [levels, setLevels] = useState<number[]>([15, 30, 60, 45, 80, 50, 35, 20]);

  useEffect(() => {
    if (!isPlaying) {
      setLevels([12, 12, 12, 12, 12, 12, 12, 12]);
      return;
    }

    const interval = setInterval(() => {
      setLevels([
        Math.floor(Math.random() * 65 + 20),
        Math.floor(Math.random() * 85 + 15),
        Math.floor(Math.random() * 95 + 25),
        Math.floor(Math.random() * 75 + 20),
        Math.floor(Math.random() * 100 + 30),
        Math.floor(Math.random() * 80 + 20),
        Math.floor(Math.random() * 60 + 15),
        Math.floor(Math.random() * 40 + 15),
      ]);
    }, 90);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const sizeClasses = {
    small: 'h-6 gap-0.5',
    medium: 'h-10 gap-1',
    large: 'h-14 gap-1.5'
  };

  const barWidths = {
    small: 'w-1',
    medium: 'w-1.5',
    large: 'w-2'
  };

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      {levels.map((lvl, idx) => (
        <div
          key={idx}
          className={`${barWidths[size]} rounded-full transition-[height,opacity] duration-100 ease-out ${
            isPlaying
              ? 'bg-gradient-to-t from-primary/80 to-primary shadow-sm shadow-primary/30'
              : 'bg-primary/20 h-2'
          }`}
          style={{
            height: isPlaying ? `${lvl}%` : '8px',
          }}
        />
      ))}
    </div>
  );
}
