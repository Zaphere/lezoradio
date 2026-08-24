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
    if (playingText === text) {
      setPlayingText(null);
      return;
    }

    const apiKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || '';
    const voiceId = voiceIdOverride || (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string) || '3IyGWZwOTNraZr1Tz0fI';

    setPlayingText(text);

    if (apiKey) {
      import('../services/tts/elevenlabsBrowser').then(({ ElevenLabsBrowser }) => {
        const tts = new ElevenLabsBrowser(apiKey, voiceId);
        tts.onEnd = () => setPlayingText(null);
        tts.onError = (err) => {
          console.warn('[Reader] ElevenLabs TTS error \u2014 falling back to browser TTS:', err);
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
        <h1 className="text-[32px] font-bold text-[#111111] dark:text-[#F1F5F9] tracking-tight">AARN Reader</h1>
        <p className="text-base text-[#555555] dark:text-[#94A3B8] mt-1">News, transcripts, and broadcast archives</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-[#EEEEEE] dark:border-white/10 pb-0">
        {([
          { key: 'news' as FilterTab, label: 'News Feed' },
          { key: 'transcripts' as FilterTab, label: 'Transcripts' },
          { key: 'alerts' as FilterTab, label: 'Alerts' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'text-[#00A651] bg-[#00A651]/5'
                : 'text-[#555555] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters (shown for news tab) */}
      {activeTab === 'news' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 overflow-x-auto">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value ? (c.value as NewsCategory) : undefined)}
                className={`px-3.5 py-1.5 text-sm rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  (c.value === '' && !category) || category === c.value
                    ? 'bg-[#00A651] text-white shadow-[0_2px_8px_rgba(0,166,81,0.3)]'
                    : 'text-[#555555] dark:text-[#94A3B8] bg-[#F8F8F8] dark:bg-white/10 hover:bg-[#00A651]/10 hover:text-[#00A651]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="px-4 py-1.5 text-sm rounded-full bg-[#F8F8F8] dark:bg-white/10 text-[#111111] dark:text-[#F1F5F9] cursor-pointer appearance-none outline-none"
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
                <div key={i} className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] p-6 space-y-3">
                  <div className="h-4 bg-[#F8F8F8] dark:bg-white/5 rounded w-1/3 animate-pulse" />
                  <div className="h-6 bg-[#F8F8F8] dark:bg-white/5 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-[#F8F8F8] dark:bg-white/5 rounded w-full animate-pulse" />
                  <div className="h-4 bg-[#F8F8F8] dark:bg-white/5 rounded w-2/3 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F8F8F8] dark:bg-white/5 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#555555]/50 dark:text-[#94A3B8]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <p className="text-[#555555]/50 dark:text-[#94A3B8]/50 text-base">No news articles found</p>
              <p className="text-[#555555]/30 dark:text-[#94A3B8]/30 text-sm mt-1">Try adjusting filters or check back later</p>
            </div>
          ) : (
            filteredNews.map((item, i) => {
              const station = stations.find(s => s.region === item.region);
              const flag = station ? (station.image_url || getFlagEmoji(station.country_code)) : null;
              return (
                <article
                  key={item.id}
                  className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6 animate-slide-up space-y-3"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Meta */}
                  <div className="flex items-center gap-2 text-sm text-[#555555] dark:text-[#94A3B8]">
                    {flag && (
                      <span className="text-base leading-none">
                        {typeof flag === 'string' && flag.startsWith('http') ? (
                          <img src={flag} alt="" className="w-4 h-4 rounded-full inline-block" />
                        ) : (
                          flag
                        )}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F0F0F0] dark:bg-white/10 capitalize">{item.category}</span>
                    <span>{item.region}</span>
                    <span className="ml-auto">
                      {new Date(item.ingested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-[#111111] dark:text-[#F1F5F9] leading-snug">{item.title}</h2>

                  {/* Description */}
                  {item.description && (
                    <p className="text-base text-[#555555] dark:text-[#94A3B8] leading-relaxed line-clamp-3">
                      {item.description.replace(/<[^>]*>/g, '').substring(0, 300)}
                    </p>
                  )}

                  {/* Content (expandable) */}
                  {item.content && (
                    <details className="group">
                      <summary className="text-sm text-[#00A651] cursor-pointer hover:text-[#00C45E] transition-colors select-none font-medium">
                        Read full article
                      </summary>
                      <div className="mt-3 text-base text-[#111111] dark:text-[#F1F5F9] leading-relaxed prose-custom">
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
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#00A651]/10 text-[#00A651] hover:bg-[#00A651]/20 transition-all text-sm font-medium cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Listen
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#555555] dark:text-[#94A3B8] hover:text-[#00A651] transition-colors"
                    >
                      Source \u2192
                    </a>
                    <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      item.is_processed
                        ? 'bg-[#00A651]/15 text-[#00A651]'
                        : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
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
          <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6">
            <h2 className="text-xl font-bold text-[#111111] dark:text-[#F1F5F9] mb-1">Live Broadcast Transcripts</h2>
            <p className="text-base text-[#555555] dark:text-[#94A3B8] mb-4">
              Recent transcripts from radio broadcasts{region ? ` in ${region}` : ''}
              {category ? ` \u00B7 ${category}` : ''}
            </p>

            {scriptsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#F8F8F8] dark:bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : scripts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#555555]/50 dark:text-[#94A3B8]/50 text-base">No transcripts available yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {scripts.map((script, i) => {
                  const station = stationMap.get(script.region);
                  const flag = station ? getFlagEmoji(station.country_code) : null;
                  return (
                    <div key={script.id} className="p-4 rounded-2xl bg-[#F8F8F8] dark:bg-white/5 space-y-2 animate-slide-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <div className="flex items-center gap-2 text-xs text-[#555555] dark:text-[#94A3B8]">
                        {flag && <span>{flag}</span>}
                        <span className="capitalize">{script.category}</span>
                        <span>{script.region}</span>
                        <span className="ml-auto">
                          {new Date(script.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-base text-[#111111] dark:text-[#F1F5F9] leading-relaxed">
                        {script.script || ''}
                      </p>
                      <button
                        onClick={() => handleListen(script.script || '')}
                        className="flex items-center gap-1.5 text-sm text-[#00A651] hover:text-[#00C45E] transition-colors cursor-pointer font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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
            <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6">
              <h3 className="text-base font-semibold text-[#555555] dark:text-[#94A3B8] mb-3">
                Full Transcript History
              </h3>
              <div className="bg-[#F8F8F8] dark:bg-white/5 rounded-2xl p-4 max-h-80 overflow-y-auto">
                <pre className="text-base text-[#111111] dark:text-[#F1F5F9] leading-relaxed whitespace-pre-wrap font-sans">
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F8F8F8] dark:bg-white/5 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#555555]/50 dark:text-[#94A3B8]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-[#555555]/50 dark:text-[#94A3B8]/50 text-base">No alerts</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div
                key={alert.id}
                className={`bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-5 animate-slide-up overflow-hidden`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 self-stretch rounded-full shrink-0 ${
                    alert.severity === 'critical' ? 'bg-[#D62828]' :
                    alert.severity === 'high' ? 'bg-[#D62828]/70' :
                    alert.severity === 'medium' ? 'bg-yellow-500' :
                    'bg-yellow-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-[#111111] dark:text-[#F1F5F9]">
                        {alert.title}
                      </span>
                      <span className="text-xs text-[#555555]/60 dark:text-[#94A3B8]/60 uppercase">{alert.severity}</span>
                    </div>
                    <p className="text-base text-[#555555] dark:text-[#94A3B8] leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-[#555555]/60 dark:text-[#94A3B8]/60">
                      <span>{alert.region}</span>
                      <span>\u00B7</span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                      <button
                        onClick={() => handleListen(`${alert.title}. ${alert.message}`)}
                        className="ml-auto flex items-center gap-1 text-[#00A651] hover:text-[#00C45E] transition-colors cursor-pointer font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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
