import type { BroadcastMode } from '../../lib/types';

interface Props {
  mode: BroadcastMode;
  bulletinHour?: number | null;
}

const MODE_CONFIG: Record<BroadcastMode, { label: string; color: string; pulse: boolean }> = {
  IDLE: {
    label: 'OFFLINE',
    color: 'bg-gray-500/80 text-white',
    pulse: false,
  },
  LIVE_NEWS: {
    label: 'LIVE NEWS',
    color: 'bg-primary text-white',
    pulse: true,
  },
  MUSIC_FILL: {
    label: 'MUSIC FILL',
    color: 'bg-emerald-600/80 text-white',
    pulse: false,
  },
  GLOBAL_BULLETIN: {
    label: 'GLOBAL BULLETIN',
    color: 'bg-indigo-600/80 text-white',
    pulse: true,
  },
  EMERGENCY: {
    label: 'EMERGENCY',
    color: 'bg-red-600/90 text-white',
    pulse: true,
  },
};

export default function BroadcastModeIndicator({ mode, bulletinHour }: Props) {
  const config = MODE_CONFIG[mode];
  const label = mode === 'GLOBAL_BULLETIN' && bulletinHour
    ? `${config.label} ${bulletinHour}:00`
    : config.label;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      {config.pulse && (
        <span className={`w-1.5 h-1.5 rounded-full bg-white ${mode === 'LIVE_NEWS' ? '' : 'animate-pulse'}`}
          style={mode === 'LIVE_NEWS' ? { opacity: 0.7 } : undefined}
        />
      )}
      {label}
    </div>
  );
}
