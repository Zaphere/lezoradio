import { useState } from 'react';
import type { ContentSource, DiagnosticSummary, BroadcastItem } from '../../lib/types';
import { scanAll } from '../../services/rss/rssDiagnostics';
import type { ScanResult } from '../../services/rss/rssDiagnostics';
import { saveDiagnostics } from '../../services/rss/rssRepository';
import RssFeedCard from './RssFeedCard';
import DiagnosticLog from './DiagnosticLog';

interface Props {
  sources: ContentSource[];
  onItemsGenerated?: (items: BroadcastItem[]) => void;
}

async function triggerBackendIngest(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/rss/ingest', { method: 'POST' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, message: data.error || 'Ingestion failed' };
    }

    const totalItems = (data.results || []).reduce(
      (sum: number, r: { items?: number }) => sum + (r.items || 0),
      0
    );

    return {
      success: true,
      message: `Ingested ${totalItems} new articles into Supabase`,
    };
  } catch {
    return {
      success: false,
      message: 'Backend offline — run `cd backend && npm start` alongside `npm run dev`',
    };
  }
}

export default function RssDiagnostics({ sources, onItemsGenerated }: Props) {
  const [scanning, setScanning] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);

  const handleScan = async () => {
    if (sources.length === 0) return;
    setScanning(true);
    try {
      const s: ScanResult = await scanAll(sources);
      await saveDiagnostics(s);
      setSummary(s);
      onItemsGenerated?.(s.broadcastItems);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleDiagnostics = async () => {
    await handleScan();
    setShowLog(true);
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMessage(null);
    try {
      const result = await triggerBackendIngest();
      setIngestMessage(result.message);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">RSS Diagnostics</h3>
        {scanning && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanning...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleScan}
          disabled={scanning || ingesting || sources.length === 0}
          className="flex-1 py-2.5 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 
                     text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {scanning ? 'Scanning...' : 'Scan RSS Feeds'}
        </button>
        <button
          onClick={handleDiagnostics}
          disabled={scanning || ingesting || sources.length === 0}
          className="flex-1 py-2.5 rounded-xl bg-white/10 text-text-secondary hover:bg-white/20 
                     text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Run Feed Diagnostics
        </button>
      </div>

      <button
        onClick={handleIngest}
        disabled={scanning || ingesting}
        className="w-full py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30
                   text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {ingesting ? 'Ingesting to Database...' : 'Ingest RSS → Supabase'}
      </button>

      {ingestMessage && (
        <p className={`text-xs text-center ${ingestMessage.includes('offline') || ingestMessage.includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}>
          {ingestMessage}
        </p>
      )}

      {sources.length === 0 && (
        <p className="text-xs text-text-secondary/50 text-center py-2">
          No content sources configured. Add sources via Supabase.
        </p>
      )}

      {summary && (
        <div className="space-y-2">
          {summary.results.map((result) => (
            <RssFeedCard key={result.sourceId} result={result} />
          ))}
        </div>
      )}

      {showLog && (
        <>
          <button
            onClick={() => setShowLog(false)}
            className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Hide Console Log
          </button>
          <DiagnosticLog summary={summary} />
        </>
      )}

      {summary && !showLog && (
        <button
          onClick={() => setShowLog(true)}
          className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          Show Console Log
        </button>
      )}
    </div>
  );
}
