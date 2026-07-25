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
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center text-text-primary hover:bg-surface-hover transition-all active:scale-95 touch-manipulation"
        aria-label="Open radio controls"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close controls"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-bg-primary border-t border-border rounded-t-2xl p-4 pb-6 space-y-3 animate-slide-up">
            <div className="w-8 h-1 rounded-full bg-border mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-primary">Radio Controls</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface border border-border">
              <span className="text-[10px] text-text-secondary uppercase tracking-wide">Local time</span>
              <StationClock timeInfo={timeInfo} />
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface border border-border">
              <span className="text-[10px] text-text-secondary uppercase tracking-wide">Theme</span>
              <ThemeToggle />
            </div>

            <div className="py-2 px-3 rounded-xl bg-surface border border-border">
              <span className="text-[10px] text-text-secondary uppercase tracking-wide block mb-2">Volume</span>
              <VolumeControl volume={volume} onChange={onVolumeChange} />
            </div>

            {showGoLive && onGoLive && (
              <button
                type="button"
                onClick={() => { onGoLive(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium active:scale-[0.98]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Go Live
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] text-text-secondary">
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-text-secondary/40'}`} />
              {isLive ? 'Broadcasting live' : 'Stand by'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
