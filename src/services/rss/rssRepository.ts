import type { ContentSource, DiagnosticSummary } from '../../lib/types';
import { updateSourceHealth } from '../../lib/supabase';

export async function saveDiagnostics(summary: DiagnosticSummary): Promise<void> {
  const updates = summary.results.map((result) =>
    updateSourceHealth(result.sourceId, {
      health: result.health,
      article_count: result.articleCount,
      response_time: result.responseTime,
      last_checked: summary.timestamp,
      ...(result.health !== 'offline' ? { last_success: summary.timestamp } : { last_failure: summary.timestamp }),
    } as Partial<ContentSource>)
  );

  await Promise.allSettled(updates);
}
