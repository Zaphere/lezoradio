import type { DiagnosticResult } from '../../lib/types';

interface Props {
  result: DiagnosticResult;
}

const healthColors: Record<string, string> = {
  healthy: 'text-success',
  warning: 'text-yellow-400',
  offline: 'text-alert',
  unknown: 'text-text-secondary',
};

const healthDots: Record<string, string> = {
  healthy: '🟢',
  warning: '🟡',
  offline: '🔴',
  unknown: '⚪',
};

export default function RssFeedCard({ result }: Props) {
  return (
    <div className="rounded-xl bg-surface p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${healthColors[result.health]}`}>
          {healthDots[result.health]}
        </span>
        <span className="text-sm font-medium text-text-primary">{result.feedName}</span>
      </div>

      {result.ok ? (
        <div className="flex items-center gap-3 text-xs text-text-secondary ml-5">
          <span className="text-success">Connected</span>
          <span>{result.articleCount} articles</span>
          <span>{result.responseTime}ms</span>
        </div>
      ) : (
        <div className="ml-5 text-xs text-alert">
          Failed — {result.error?.message || 'Unknown error'}
        </div>
      )}
    </div>
  );
}
