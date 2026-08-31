import { useState } from 'react';
import VolumeControl from './VolumeControl';
import StationClock from './StationClock';
import ThemeToggle from '../ThemeToggle';
import type { StationTimeInfo } from '../../lib/types';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  timeInfo: StationTimeInfo;
  isLive: boolean;
  onGoLive?: () => void;
  showGoLive?: boolean;
}

export default function RadioControlsSheet({
  volume,
  onVolumeChange,
  timeInfo,
  isLive,
  onGoLive,
  showGoLive,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-white dark:bg-white/8 border border-[var(--color-border)] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] flex items-center justify-center text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] transition-all active:scale-95 touch-manipulation"
        aria-label="Open radio controls"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close controls"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1A1A1E] rounded-t-3xl p-5 pb-7 space-y-4 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] animate-slide-up border-t border-[var(--color-border)] dark:border-white/10">
            <div className="w-10 h-1.5 rounded-full bg-[var(--color-surface-subtle)] dark:bg-white/15 mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1A1D23] dark:text-[#F1F5F9]">Radio Controls</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10 transition-all"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-[var(--color-surface-subtle)] dark:bg-white/5">
              <span className="text-sm text-[#6B7280] dark:text-[#94A3B8] font-medium">Local time</span>
              <StationClock timeInfo={timeInfo} />
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-[var(--color-surface-subtle)] dark:bg-white/5">
              <span className="text-sm text-[#6B7280] dark:text-[#94A3B8] font-medium">Theme</span>
              <ThemeToggle />
            </div>

            <div className="py-3 px-4 rounded-2xl bg-[var(--color-surface-subtle)] dark:bg-white/5">
              <span className="text-sm text-[#6B7280] dark:text-[#94A3B8] font-medium block mb-2">Volume</span>
              <VolumeControl volume={volume} onChange={onVolumeChange} />
            </div>

            {showGoLive && onGoLive && (
              <button
                type="button"
                onClick={() => { onGoLive(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#D62828] text-white text-sm font-bold shadow-[0_4px_12px_rgba(214,40,40,0.3)] hover:bg-[#E84949] active:scale-[0.98] transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Go Live
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280] dark:text-[#94A3B8]">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#D62828] animate-pulse' : 'bg-[#6B7280]/40'}`} />
              {isLive ? 'Broadcasting live' : 'Stand by'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
