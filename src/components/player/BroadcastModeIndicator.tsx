import type { BroadcastMode } from '../../lib/types';

interface Props {
  mode: BroadcastMode;
  bulletinHour?: number | null;
}

const MODE_CONFIG: Record<BroadcastMode, { label: string; color: string; pulse: boolean }> = {
  IDLE: {
    label: 'OFFLINE',
    color: 'bg-[var(--color-surface-subtle)] dark:bg-white/8 text-[#6B7280] dark:text-[#94A3B8] border border-[var(--color-border)] dark:border-white/10',
    pulse: false,
  },
  LIVE_NEWS: {
    label: 'LIVE NEWS',
    color: 'bg-[#00A651] text-white shadow-[0_2px_8px_rgba(0,166,81,0.3)]',
    pulse: true,
  },
  MUSIC_FILL: {
    label: 'MUSIC FILL',
    color: 'bg-[#00A651]/85 text-white shadow-[0_2px_8px_rgba(0,166,81,0.2)]',
    pulse: false,
  },
  GLOBAL_BULLETIN: {
    label: 'GLOBAL BULLETIN',
    color: 'bg-[#3C3B6E] text-white shadow-[0_2px_8px_rgba(60,59,110,0.3)]',
    pulse: true,
  },
  EMERGENCY: {
    label: 'EMERGENCY',
    color: 'bg-[#D62828] text-white shadow-[0_2px_8px_rgba(214,40,40,0.3)]',
    pulse: true,
  },
};

export default function BroadcastModeIndicator({ mode, bulletinHour }: Props) {
  const config = MODE_CONFIG[mode];
  const label = mode === 'GLOBAL_BULLETIN' && bulletinHour
    ? `${config.label} ${bulletinHour}:00`
    : config.label;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider ${config.color}`}>
      {config.pulse && (
        <span className={`w-1.5 h-1.5 rounded-full bg-white ${mode === 'LIVE_NEWS' ? '' : 'animate-pulse'}`}
          style={mode === 'LIVE_NEWS' ? { opacity: 0.7 } : undefined}
        />
      )}
      {label}
    </div>
  );
}
