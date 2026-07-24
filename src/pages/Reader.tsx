import { useState, useEffect, useMemo } from 'react';
import { useNewsItems, useAlerts } from '../hooks/useSupabase';
import { fetchStations, fetchRadioScripts } from '../lib/supabase';
import type { NewsCategory, StationRecord, RadioScript } from '../lib/types';
import { getFlagEmoji } from '../lib/types';

function _fallbackSpeak(text: string, onEnd?: (text: string | null) => void) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.onend = () => onEnd?.(null);
    utterance.onerror = () => onEnd?.(null);
    window.speechSynthesis.speak(utterance);
  } else {
    onEnd?.(null);
  }
}

type FilterTab = 'news' | 'transcripts' | 'alerts';

const CATEGORIES: { label: string; value: NewsCategory | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Local', value: 'local' },
  { label: 'Regional', value: 'regional' },
  { label: 'Global', value: 'global' },
  { label: 'Traffic', value: 'traffic' },
  { label: 'Alert', value: 'alert' },
];

const REGIONS = ['', 'Southern Africa', 'Central Africa', 'East Africa', 'North Africa'];

export default function Reader() {
  const [category, setCategory] = useState<NewsCategory | undefined>(undefined);
  const [region, setRegion] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('news');
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [scripts, setScripts] = useState<RadioScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(true);

  const { items: newsItems, loading: newsLoading } = useNewsItems(region || undefined, category);
  const { alerts } = useAlerts(region || undefined);

  useEffect(() => {
    fetchStations().then(setStations);
  }, []);

  useEffect(() => {
    setScriptsLoading(true);
    fetchRadioScripts(region || undefined, category).then(data => {
      setScripts(data as RadioScript[]);
      setScriptsLoading(false);
    });
  }, [region, category]);

  const stationMap = useMemo(() => {
    const map = new Map<string, StationRecord>();
    for (const s of stations) map.set(s.name, s);
    return map;
  }, [stations]);

  const filteredNews = useMemo(() => {
    if (!region) return newsItems;
    return newsItems.filter(item => item.region === region);
  }, [newsItems, region]);

  const transcript = useMemo(() => {
    if (scripts.length === 0) return '';
    return scripts
      .map(s => s.script || '')
      .filter(Boolean)
      .join('\n\n');
  }, [scripts]);

  const [playingText, setPlayingText] = useState<string | null>(null);

  const handleListen = (text: string, voiceIdOverride?: string) => {
    // Toggle off if already playing same text
    if (playingText === text) {
      setPlayingText(null);
      return;
    }

    const apiKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || '';
    const voiceId = voiceIdOverride || (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string) || 'wBXNqKUATyqu0RtYt25i';

    setPlayingText(text);

    if (apiKey) {
      // Use browser-native fetch-based ElevenLabs client (not the Node SDK)
      import('../services/tts/elevenlabsBrowser').then(({ ElevenLabsBrowser }) => {
        const tts = new ElevenLabsBrowser(apiKey, voiceId);
        tts.onEnd = () => setPlayingText(null);
        tts.onError = (err) => {
          console.warn('[Reader] ElevenLabs TTS error — falling back to browser TTS:', err);
          setPlayingText(null);
          _fallbackSpeak(text, setPlayingText);
        };
        tts.speak(text);
      }).catch(() => {
        setPlayingText(null);
        _fallbackSpeak(text, setPlayingText);
      });
    } else {
      _fallbackSpeak(text, setPlayingText);
    }
  };



  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">AARN Reader</h1>
        <p className="text-sm text-text-secondary mt-1">News, transcripts, and broadcast archives</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border pb-1">
        {([
          { key: 'news' as FilterTab, label: 'News Feed' },
          { key: 'transcripts' as FilterTab, label: 'Transcripts' },
          { key: 'alerts' as FilterTab, label: 'Alerts' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters (shown for news tab) */}
      {activeTab === 'news' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value ? (c.value as NewsCategory) : undefined)}
                className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  (c.value === '' && !category) || category === c.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-hover'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-full bg-surface border border-border text-text-primary cursor-pointer appearance-none outline-none"
          >
            <option value="">All Regions</option>
            {REGIONS.filter(Boolean).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* News Feed Tab */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          {newsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-6 space-y-3">
                  <div className="h-4 bg-surface rounded w-1/3 animate-pulse" />
                  <div className="h-6 bg-surface rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-surface rounded w-full animate-pulse" />
                  <div className="h-4 bg-surface rounded w-2/3 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                <svg className="w-8 h-8 text-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <p className="text-text-secondary/50 text-sm">No news articles found</p>
              <p className="text-text-secondary/30 text-xs mt-1">Try adjusting filters or check back later</p>
            </div>
          ) : (
            filteredNews.map((item, i) => {
              const station = stations.find(s => s.region === item.region);
              const flag = station ? (station.image_url || getFlagEmoji(station.country_code)) : null;
              return (
                <article
                  key={item.id}
                  className="card p-6 animate-slide-up space-y-3"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    {flag && (
                      <span className="text-base leading-none">
                        {typeof flag === 'string' && flag.startsWith('http') ? (
                          <img src={flag} alt="" className="w-4 h-4 rounded-full inline-block" />
                        ) : (
                          flag
                        )}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-surface-hover capitalize">{item.category}</span>
                    <span>{item.region}</span>
                    <span className="ml-auto">
                      {new Date(item.ingested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-bold text-text-primary leading-snug">{item.title}</h2>

                  {/* Description */}
                  {item.description && (
                    <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
                      {item.description.replace(/<[^>]*>/g, '').substring(0, 300)}
                    </p>
                  )}

                  {/* Content (expandable) */}
                  {item.content && (
                    <details className="group">
                      <summary className="text-xs text-primary cursor-pointer hover:text-primary-light transition-colors select-none">
                        Read full article
                      </summary>
                      <div className="mt-3 text-sm text-text-primary leading-relaxed prose-custom">
                        {item.content.replace(/<[^>]*>/g, '').split('\n').filter(Boolean).map((p, j) => (
                          <p key={j} className="mb-3 last:mb-0">{p}</p>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleListen(`${item.title}. ${item.description || item.content || ''}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-medium cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Listen
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Source →
                    </a>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      item.is_processed
                        ? 'bg-success/15 text-success'
                        : 'bg-yellow-500/15 text-yellow-600'
                    }`}>
                      {item.is_processed ? 'Broadcast' : 'Pending'}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Transcripts Tab */}
      {activeTab === 'transcripts' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-text-primary mb-1">Live Broadcast Transcripts</h2>
            <p className="text-sm text-text-secondary mb-4">
              Recent transcripts from radio broadcasts{region ? ` in ${region}` : ''}
              {category ? ` · ${category}` : ''}
            </p>

            {scriptsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-surface rounded animate-pulse" />
                ))}
              </div>
            ) : scripts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary/50 text-sm">No transcripts available yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {scripts.map((script, i) => {
                  const station = stationMap.get(script.region);
                  const flag = station ? getFlagEmoji(station.country_code) : null;
                  return (
                    <div key={script.id} className="p-4 rounded-xl bg-surface space-y-2 animate-slide-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                        {flag && <span>{flag}</span>}
                        <span className="capitalize">{script.category}</span>
                        <span>{script.region}</span>
                        <span className="ml-auto">
                          {new Date(script.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {script.script || ''}
                      </p>
                      <button
                        onClick={() => handleListen(script.script || '')}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-light transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Listen to transcript
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full transcript view */}
          {transcript && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Full Transcript History
              </h3>
              <div className="bg-surface rounded-xl p-4 max-h-80 overflow-y-auto">
                <pre className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                  {transcript}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                <svg className="w-8 h-8 text-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-text-secondary/50 text-sm">No alerts</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div
                key={alert.id}
                className={`card p-5 animate-slide-up border-l-4 ${
                  alert.severity === 'critical' ? 'border-l-alert' :
                  alert.severity === 'high' ? 'border-l-alert/70' :
                  alert.severity === 'medium' ? 'border-l-yellow-500' :
                  'border-l-yellow-400'
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">🚨</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        {alert.title}
                      </span>
                      <span className="text-[10px] uppercase text-text-secondary/60">{alert.severity}</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-text-secondary/60">
                      <span>{alert.region}</span>
                      <span>·</span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                      <button
                        onClick={() => handleListen(`${alert.title}. ${alert.message}`)}
                        className="ml-auto flex items-center gap-1 text-primary hover:text-primary-light transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Listen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
