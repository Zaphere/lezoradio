import type { ContentSource, DiagnosticResult, DiagnosticSummary, FeedHealth, BroadcastItem } from '../../lib/types';
import { fetchWithRetry } from './rssFetcher';
import { parseRSS, articlesToBroadcastItems } from './rssParser';
import { normalizeFeedUrl } from './feedUrls';

function calculateHealth(ok: boolean, status: number, articleCount: number, responseTime: number): FeedHealth {
  if (!ok) return 'offline';
  if (status === 200 && articleCount > 0 && responseTime < 2000) return 'healthy';
  if (status === 200 && articleCount === 0) return 'warning';
  if (status === 200 && responseTime > 5000) return 'warning';
  if (status >= 400) return 'offline';
  return 'offline';
}

export interface ScanResult extends DiagnosticSummary {
  broadcastItems: BroadcastItem[];
}

export async function scanAll(sources: ContentSource[]): Promise<ScanResult> {
  const start = performance.now();
  const results: DiagnosticResult[] = [];
  const broadcastItems: BroadcastItem[] = [];

  console.group(`%c🔍 RSS Diagnostics — ${new Date().toLocaleTimeString()}`, 'font-weight:bold;font-size:1.1em');

  for (const source of sources) {
    console.group(`%c${source.name}`, 'font-weight:bold');

    const feedUrl = normalizeFeedUrl(source.url);
    const fetchResult = await fetchWithRetry(feedUrl);

    let articleCount = 0;
    let latestTitle: string | null = null;

    if (fetchResult.ok && fetchResult.xml) {
      try {
        const articles = parseRSS(fetchResult.xml);
        articleCount = articles.length;
        latestTitle = articles[0]?.title || null;

        const items = articlesToBroadcastItems(
          articles,
          source.name,
          '',
          undefined,
          undefined,
          undefined,
        );
        broadcastItems.push(...items);

        console.timeEnd('fetch');
        console.table([{ Status: fetchResult.status, Articles: articleCount, Health: calculateHealth(true, fetchResult.status, articleCount, fetchResult.responseTime), Latest: latestTitle || '(no title)' }]);
      } catch (err: any) {
        console.warn(`Parse error: ${err.message}`);
      }
    } else {
      const hint = fetchResult.error?.category === 'backend-offline'
        ? 'Run `cd backend && npm start` in another terminal (alongside `npm run dev`), then scan again.'
        : fetchResult.error?.category === 'proxy-error'
        ? 'Backend proxy failed. Check that the feed URL is valid.'
        : '';
      console.warn(`✗ ${fetchResult.status} ${fetchResult.statusText} — ${fetchResult.error?.message || 'Unavailable'}${hint ? ` (${hint})` : ''}`);
    }

    const health = calculateHealth(fetchResult.ok, fetchResult.status, articleCount, fetchResult.responseTime);

    results.push({
      sourceId: source.id,
      feedName: source.name,
      url: feedUrl,
      status: fetchResult.status,
      ok: fetchResult.ok,
      articleCount,
      latestTitle,
      responseTime: fetchResult.responseTime,
      health,
      error: fetchResult.error,
    });

    console.groupEnd();
  }

  const successful = results.filter((r) => r.health !== 'offline').length;
  const failed = results.filter((r) => r.health === 'offline').length;
  const totalArticles = results.reduce((sum, r) => sum + r.articleCount, 0);
  const duration = Math.round(performance.now() - start);

  console.log(`%c✓ ${successful} successful · ✗ ${failed} failed · ${totalArticles} total articles · ${duration}ms`, 'font-weight:bold');
  console.groupEnd();

  return {
    results,
    totalArticles,
    successful,
    failed,
    duration,
    timestamp: new Date().toISOString(),
    broadcastItems,
  };
}
