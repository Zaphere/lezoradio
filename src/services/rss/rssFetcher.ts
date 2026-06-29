export interface FetchResult {
  ok: boolean;
  xml?: string;
  status: number;
  statusText: string;
  responseTime: number;
  error?: { category: string; message: string };
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWithRetry(url: string): Promise<FetchResult> {
  const backendAvailable = await checkBackendHealth();

  if (backendAvailable) {
    return await fetchViaProxy(url);
  }

  // Backend unavailable — direct browser fetch will always fail with CORS
  // for external RSS feeds, so fail fast with a helpful message instead.
  const start = performance.now();
  await delay(100);
  return {
    ok: false,
    status: 0,
    statusText: 'Backend Offline',
    responseTime: Math.round(performance.now() - start),
    error: {
      category: 'backend-offline',
      message:
        'RSS API server is not reachable on port 3001. Start the backend with `cd backend && npm start` (must run alongside `npm run dev` in the project root).',
    },
  };
}

async function fetchViaProxy(url: string): Promise<FetchResult> {
  const start = performance.now();

  try {
    const proxyUrl = `/api/rss/proxy?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const responseTime = Math.round(performance.now() - start);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        error: { category: 'proxy-error', message: `Proxy returned ${response.status}` },
      };
    }

    const data = await response.json();

    if (!data.ok && data.items === undefined) {
      return {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        responseTime,
        error: { category: 'proxy-error', message: 'Proxy returned invalid response' },
      };
    }

    const xml = proxyItemsToXml(data.items || []);

    return { ok: true, xml, status: 200, statusText: 'OK', responseTime };
  } catch (err: any) {
    const responseTime = Math.round(performance.now() - start);

    if (err.name === 'AbortError') {
      return { ok: false, status: 0, statusText: 'Timeout', responseTime, error: { category: 'timeout', message: 'Proxy request timed out' } };
    }

    return { ok: false, status: 0, statusText: 'Proxy Error', responseTime, error: { category: 'proxy-error', message: err.message || 'Proxy unavailable' } };
  }
}

function proxyItemsToXml(items: any[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>';
  for (const item of items) {
    xml += '<item>';
    xml += `<title>${escapeXml(item.title || '')}</title>`;
    xml += `<description>${escapeXml(item.description || '')}</description>`;
    xml += `<link>${escapeXml(item.url || '')}</link>`;
    if (item.published_at) {
      xml += `<pubDate>${new Date(item.published_at).toUTCString()}</pubDate>`;
    }
    xml += '<content:encoded><![CDATA[' + (item.content || item.description || '') + ']]></content:encoded>';
    xml += '</item>';
  }
  xml += '</channel></rss>';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
