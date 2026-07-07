import { useRef, useEffect } from 'react';
import type { DiagnosticSummary } from '../../lib/types';

interface Props {
  summary: DiagnosticSummary | null;
}

export default function DiagnosticLog({ summary }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [summary]);

  if (!summary) return null;

  const lines: string[] = [];
  lines.push(`🔍 RSS Diagnostics — ${new Date(summary.timestamp).toLocaleTimeString()}`);
  lines.push('');

  for (const result of summary.results) {
    lines.push(`  ${result.feedName}`);
    lines.push(`    ${'-'.repeat(40)}`);
    if (result.ok) {
      lines.push(`    Status: ${result.status} OK`);
      lines.push(`    Articles: ${result.articleCount}`);
      lines.push(`    Latest: ${result.latestTitle || '(none)'}`);
      lines.push(`    Time: ${result.responseTime}ms`);
    } else {
      lines.push(`    Status: ${result.status} ${result.ok ? 'OK' : result.error?.message || 'Error'}`);
      lines.push(`    ${result.error?.message || 'Feed unavailable'}`);
    }
    lines.push('');
  }

  lines.push(`${'-'.repeat(40)}`);
  lines.push(`Successful: ${summary.successful}`);
  lines.push(`Failed: ${summary.failed}`);
  lines.push(`Total Articles: ${summary.totalArticles}`);
  lines.push(`${'-'.repeat(40)}`);

  return (
    <div className="card p-4">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Console Log</h4>
      <pre
        ref={preRef}
        className="bg-black/40 rounded-xl p-3 text-[11px] leading-relaxed text-green-400 font-mono overflow-x-auto max-h-60 overflow-y-auto"
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}
