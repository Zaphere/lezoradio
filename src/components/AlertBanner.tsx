import type { Alert } from '../lib/types';

interface Props {
  alert: Alert | null;
}

const severityColors: Record<string, string> = {
  low: 'bg-yellow-500/20 text-yellow-500',
  medium: 'bg-orange-500/20 text-orange-400',
  high: 'bg-[#D62828]/20 text-[#D62828]',
  critical: 'bg-[#D62828]/30 text-[#D62828] font-bold',
};

export default function AlertBanner({ alert }: Props) {
  if (!alert) return null;

  const colors = severityColors[alert.severity] || severityColors.high;

  return (
    <div className={`rounded-2xl p-4 animate-slide-up shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${colors}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">🚨</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold uppercase tracking-wider">Alert</span>
            <span className="text-[11px] uppercase opacity-60">{alert.severity}</span>
          </div>
          <h4 className="font-semibold text-base mb-1">{alert.title}</h4>
          <p className="text-sm opacity-90">{alert.message}</p>
          <span className="text-xs opacity-60 mt-2 block">{alert.region}</span>
        </div>
      </div>
    </div>
  );
}
