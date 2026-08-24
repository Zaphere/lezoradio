import type { BroadcastMode } from '../../lib/types';

interface Props {
  mode: BroadcastMode;
  bulletinHour?: number | null;
}

const MODE_CONFIG: Record<BroadcastMode, { label: string; color: string; pulse: boolean }> = {
  IDLE: {
    label: 'OFFLINE',
    color: 'bg-[#F0F0F0] dark:bg-white/10 text-[#555555] dark:text-[#94A3B8]',
    pulse: false,
  },
  LIVE_NEWS: {
    label: 'LIVE NEWS',
    color: 'bg-[#00A651] text-white shadow-[0_2px_8px_rgba(0,166,81,0.3)]',
    pulse: true,
  },
  MUSIC_FILL: {
    label: 'MUSIC FILL',
    color: 'bg-[#00A651]/80 text-white shadow-[0_2px_8px_rgba(0,166,81,0.2)]',
    pulse: false,
  },
  GLOBAL_BULLETIN: {
    label: 'GLOBAL BULLETIN',
    color: 'bg-[#00A651]/70 text-white shadow-[0_2px_8px_rgba(0,166,81,0.2)]',
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
