import type { Alert } from '../lib/types';

interface Props {
  alert: Alert | null;
}

const severityColors: Record<string, string> = {
  low: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  medium: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
  high: 'bg-alert/20 border-alert/30 text-alert',
  critical: 'bg-alert/30 border-alert/50 text-alert font-bold',
};

export default function AlertBanner({ alert }: Props) {
  if (!alert) return null;

  const colors = severityColors[alert.severity] || severityColors.high;

  return (
    <div className={`rounded-2xl border p-4 animate-slide-up shadow-sm ${colors}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">🚨</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Alert</span>
            <span className="text-[10px] uppercase opacity-60">{alert.severity}</span>
          </div>
          <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
          <p className="text-sm opacity-90">{alert.message}</p>
          <span className="text-[10px] opacity-60 mt-2 block">{alert.region}</span>
        </div>
      </div>
    </div>
  );
}
