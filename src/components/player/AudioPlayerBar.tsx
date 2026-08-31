import { useRef, useCallback, useState } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayerBar({
  title,
  subtitle,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  hasPrev,
  hasNext,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * Math.max(duration, 1);
    setDragging(true);
    setDragTime(time);
  }, [duration]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragTime(ratio * Math.max(duration, 1));
  }, [dragging, duration]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      setDragging(false);
      onSeek(dragTime);
    }
  }, [dragging, dragTime, onSeek]);

  const displayTime = dragging ? dragTime : currentTime;
  const progress = duration > 0 ? Math.min(1, displayTime / duration) : 0;

  return (
    <div className="w-full bg-white dark:bg-white/6 rounded-3xl border border-[var(--color-border)] dark:border-white/8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="p-2 rounded-full text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous story"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={onPlayPause}
            className="p-2.5 rounded-full bg-[#00A651] text-white hover:bg-[#00C45E] shadow-[0_4px_12px_rgba(0,166,81,0.3)] transition-all cursor-pointer active:scale-95"
            aria-label={isPlaying && !isPaused ? 'Pause' : 'Play'}
          >
            {isPlaying && !isPaused ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-2 rounded-full text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next story"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-w-0 ml-1">
          <p className="text-sm font-medium text-[#1A1D23] dark:text-[#F1F5F9] truncate leading-tight">
            {title || 'No story playing'}
          </p>
          {subtitle && (
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] truncate leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div
        ref={barRef}
        className="relative h-2 rounded-full bg-[var(--color-surface-subtle)] dark:bg-white/10 cursor-pointer group touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#00A651] transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#00A651] shadow-[0_2px_8px_rgba(0,166,81,0.4)] transition-opacity ${
            dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{ left: `calc(${progress * 100}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-[#6B7280] dark:text-[#94A3B8] tabular-nums">{formatTime(displayTime)}</span>
        <span className="text-xs text-[#6B7280] dark:text-[#94A3B8] tabular-nums">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
