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
  volume?: number;
  onVolumeChange?: (volume: number) => void;
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
  volume = 1,
  onVolumeChange,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

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

  const handleVolumePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = volumeBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newVolume = ratio;
    setVolumeDragging(true);
    if (onVolumeChange) onVolumeChange(newVolume);
  }, [onVolumeChange]);

  const handleVolumePointerMove = useCallback((e: React.PointerEvent) => {
    if (!volumeDragging) return;
    const bar = volumeBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (onVolumeChange) onVolumeChange(ratio);
  }, [volumeDragging, onVolumeChange]);

  const handleVolumePointerUp = useCallback(() => {
    setVolumeDragging(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (onVolumeChange) {
      onVolumeChange(volume > 0 ? 0 : 1);
    }
  }, [volume, onVolumeChange]);

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

        {onVolumeChange && (
          <div
            className="relative group"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button
              onClick={toggleMute}
              className="p-2 rounded-full text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10 transition-all cursor-pointer"
              aria-label={volume > 0 ? 'Mute' : 'Unmute'}
            >
              {volume === 0 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 0.5 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {showVolume && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-32">
                <div className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2 text-center">Volume</div>
                <div
                  ref={volumeBarRef}
                  className="relative h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer touch-none"
                  onPointerDown={handleVolumePointerDown}
                  onPointerMove={handleVolumePointerMove}
                  onPointerUp={handleVolumePointerUp}
                  onPointerLeave={handleVolumePointerUp}
                  style={{ touchAction: 'none' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[#00A651]"
                    style={{ width: `${volume * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#00A651] shadow"
                    style={{ left: `calc(${volume * 100}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">0%</span>
                  <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{Math.round(volume * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
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
