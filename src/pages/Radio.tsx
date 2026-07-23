import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { StationRecord, BroadcastMode, NewsCategory } from '../lib/types';
import { getChannel, newsCategoryForChannel, slugify, CHANNELS, getGlobalChannelBySlug } from '../lib/channels';
import type { Channel } from '../lib/channels';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { useAudioExecutor } from '../hooks/useAudioExecutor';
import { useNewsItems } from '../hooks/useSupabase';
import { fetchStations, pruneOldData } from '../lib/supabase';
import { filterNewsForStation } from '../lib/stationNewsFilter';
import { getFlagEmoji } from '../lib/types';
import type { DCRegion } from '../lib/drcRegions';
import { DRC_COUNTRY, getRegionBySlug } from '../lib/drcRegions';
import { resolveTimezone } from '../lib/stationTime';
import { useStationClock } from '../hooks/useStationClock';
import { getCountryTheme } from '../lib/countryTheme';

import LiveIndicator from '../components/LiveIndicator';
import AudioVisualizer from '../components/AudioVisualizer';
import FrequencyDial from '../components/FrequencyDial';
import VolumeControl from '../components/player/VolumeControl';
import StationClock from '../components/player/StationClock';
import BroadcastModeIndicator from '../components/player/BroadcastModeIndicator';
import AudioPlayerBar from '../components/player/AudioPlayerBar';
import NewsFeedPreview from '../components/NewsFeedPreview';

// Shared soft-interaction classes — used on every tappable control so
// buttons feel consistent across mobile / tablet / desktop.
const SOFT_BTN =
  'rf-press touch-manipulation select-none';

export default function Radio() {
  const { countrySlug, channelSlug } = useParams<{ countrySlug: string; channelSlug: string }>();
  const navigate = useNavigate();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [channelOverride, setChannelOverride] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [drcRegion, setDrcRegion] = useState<DCRegion | null>(null);

  useEffect(() => {
    if (channelSlug) {
      const ch = getGlobalChannelBySlug(channelSlug);
      if (ch) {
        setChannelOverride(ch);
        setDrcRegion(null);
        const dummyStation: StationRecord = {
          id: ch.frequency,
          name: ch.name,
          country: ch.name,
          country_code: '',
          region: '',
          language: '',
          image_url: undefined,
          is_active: true,
          priority: 0,
          created_at: '',
          updated_at: '',
        };
        setStation(dummyStation);
      } else {
        navigate('/', { replace: true });
      }
      setLoading(false);
      return;
    }

    if (countrySlug && countrySlug.startsWith('drc-')) {
      const regionSlug = countrySlug.replace('drc-', '');
      const region = getRegionBySlug(regionSlug);
      if (region) {
        setDrcRegion(region);
        const drcStation: StationRecord = {
          id: region.id,
          name: `${DRC_COUNTRY.name} - ${region.name}`,
          country: DRC_COUNTRY.name,
          country_code: DRC_COUNTRY.countryCode,
          region: region.slug,
          language: region.language,
          image_url: undefined,
          is_active: true,
          priority: 0,
          created_at: '',
          updated_at: '',
        };
        setStation(drcStation);
        setLoading(false);
        return;
      }
      navigate('/', { replace: true });
      return;
    }

    fetchStations().then(all => {
      const found = all.find(s => slugify(s.name) === countrySlug);
      setStation(found ?? null);
      setDrcRegion(null);
      setLoading(false);
    });
  }, [countrySlug, channelSlug, navigate]);

  useEffect(() => {
    if (!loading && !station) navigate('/', { replace: true });
  }, [loading, station, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!station) return null;

  return <RadioPage station={station} channelOverride={channelOverride} drcRegion={drcRegion} />;
}

function RadioPage({ station, channelOverride, drcRegion }: { station: StationRecord; channelOverride: Channel | null; drcRegion?: DCRegion | null }) {
  const navigate = useNavigate();
  const [currentFreq, setCurrentFreq] = useState(channelOverride?.frequency ?? '88.1');
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<NewsCategory | undefined>(undefined);
  const isGlobal = !!channelOverride;

  const channel = getChannel(currentFreq) ?? CHANNELS[0];

  // Channel ID for the backend engine — maps region slug to the backend's channel_id format
  // Backend uses 'kinshasa-main', 'goma-main', 'lubumbashi-main'
  const channelId = useMemo(() => {
    if (channelOverride) return channelOverride.frequency;
    if (drcRegion) return `${drcRegion.slug}-main`;
    return station.id;
  }, [channelOverride, drcRegion, station]);

  const [userStarted, setUserStarted] = useState(false);
  const [skipToLive, setSkipToLive] = useState(false);
  const { nowPlaying, isConnected, error: nowPlayingError, refetch: refetchNowPlaying } = useNowPlaying({
    channelId,
    enabled: userStarted,
  });

  const handleTrackEnd = useCallback(() => {
    // When a segment ends, re-fetch to check for the next one
    refetchNowPlaying();
  }, [refetchNowPlaying]);

  const audio = useAudioExecutor({ nowPlaying, enabled: userStarted, onTrackEnd: handleTrackEnd });

  // "Go Live" — skip to the latest segment
  const handleGoLive = useCallback(() => {
    setSkipToLive(true);
    refetchNowPlaying();
  }, [refetchNowPlaying]);

  // "Next" — skip to latest available segment
  const handleNext = useCallback(() => {
    refetchNowPlaying();
  }, [refetchNowPlaying]);

  const isLive = userStarted && nowPlaying !== null && nowPlaying.segmentType !== 'silence';
  const isMusicMode = nowPlaying?.segmentType === 'track' && nowPlaying.audioType === 'ambient';

  const displayEmoji = isGlobal ? channelOverride!.emoji
    : drcRegion ? drcRegion.emoji
      : (station.image_url ? undefined : getFlagEmoji(station.country_code));
  const displayImage = isGlobal ? undefined : drcRegion ? undefined : station.image_url;
  const displayName = drcRegion ? `${DRC_COUNTRY.name} \u2014 ${drcRegion.name}` : station.name;
  const displaySubtitle = isGlobal ? channelOverride!.description
    : drcRegion ? drcRegion.description
      : station.region;
  const displayIcon = displayImage
    ? <img src={displayImage} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
    : <span className="text-3xl">{displayEmoji}</span>;

  const theme = useMemo(
    () => getCountryTheme(station.country_code, displayName, drcRegion?.slug ?? null),
    [station.country_code, displayName, drcRegion?.slug],
  );
  const themeVars = useMemo<CSSProperties>(() => ({
    '--c-primary': theme.primary,
    '--c-secondary': theme.secondary,
    '--c-accent': theme.accent,
    '--c-glow': theme.glow,
  } as CSSProperties), [theme]);

  const timezone = useMemo(
    () => resolveTimezone(station.timezone, station.country_code, drcRegion?.slug),
    [station.timezone, station.country_code, drcRegion?.slug],
  );
  const isDrcBroadcast = !!drcRegion;

  const channelNewsCat = useMemo(() => newsCategoryForChannel(channel), [channel]);
  const { items: allItems, loading: newsLoading } = useNewsItems(undefined, channelNewsCat);
  const filteredNews = useMemo(
    () => filterNewsForStation(allItems, station, channelNewsCat),
    [allItems, station, channelNewsCat],
  );
  const displayNews = useMemo(() => {
    if (!newsCategoryFilter) return filteredNews;
    return filteredNews.filter(item => item.category === newsCategoryFilter);
  }, [filteredNews, newsCategoryFilter]);

  const timeInfo = useStationClock(timezone);

  const [volume, setVolume] = useState(1);

  const handleFrequencyChange = useCallback((freq: string) => {
    setCurrentFreq(freq);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    audio.setVolume(v);
  }, [audio.setVolume]);

  const handlePlayPause = useCallback(() => {
    if (audio.isPaused) {
      audio.resume();
    } else if (audio.isPlaying) {
      audio.pause();
    }
  }, [audio.isPlaying, audio.isPaused, audio.pause, audio.resume]);

  const handleSeek = useCallback((time: number) => {
    audio.seek(time);
  }, [audio.seek]);

  useEffect(() => {
    pruneOldData();
    const interval = setInterval(pruneOldData, 3600000);
    return () => clearInterval(interval);
  }, []);

  const mode = useMemo<BroadcastMode>(() => {
    if (!isLive) return 'IDLE';
    if (isMusicMode) return 'MUSIC_FILL';
    if (nowPlaying?.segmentType === 'bulletin') return 'GLOBAL_BULLETIN';
    return 'LIVE_NEWS';
  }, [isLive, isMusicMode, nowPlaying?.segmentType]);

  const nextSegmentLabel = useMemo<string>(() => {
    if (!isLive) return '';
    if (nowPlaying?.nextTitle) return `Next: ${nowPlaying.nextTitle}`;
    return '';
  }, [isLive, nowPlaying?.nextTitle]);

  return (
    <div className="min-h-screen pb-20" style={themeVars}>
      <style>{`
        @keyframes rf-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rf-pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 var(--c-glow); } 50% { box-shadow: 0 0 0 8px transparent; } }
        .rf-fade-up { animation: rf-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .rf-pulse { animation: rf-pulse-ring 2.4s ease-in-out infinite; }
        .rf-press {
          transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 180ms ease, filter 180ms ease, background-color 180ms ease;
        }
        .rf-press:hover { filter: brightness(1.08); }
        .rf-press:active { transform: scale(0.92); filter: brightness(0.96); }
        @media (prefers-reduced-motion: reduce) {
          .rf-fade-up, .rf-pulse, .rf-press { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div
        className="sticky top-0 z-40 glass border-b transition-colors duration-500"
        style={{ borderColor: `color-mix(in srgb, var(--c-primary) 25%, transparent)` }}
      >
        <div className="max-w-lg md:max-w-3xl lg:max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className={`${SOFT_BTN} flex items-center gap-2 text-text-secondary hover:text-text-primary min-h-11 -ml-1 pl-1 pr-2 rounded-lg`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{isGlobal ? 'All Channels' : (isDrcBroadcast ? DRC_COUNTRY.name : 'All Countries')}</span>
          </button>

          <div className="flex items-center gap-3">
            <StationClock timeInfo={timeInfo} />
            <VolumeControl volume={volume} onChange={handleVolumeChange} />
            <span className={isLive ? 'rf-pulse rounded-full' : ''}>
              <LiveIndicator isLive={isLive} />
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg md:max-w-3xl mx-auto px-4 py-6 md:grid md:grid-cols-[1fr_300px] md:gap-6 md:items-start lg:block lg:max-w-lg">
        <div className="space-y-6">
          <div className="text-center space-y-2 rf-fade-up">
            <div
              className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface border transition-shadow duration-500"
              style={{
                borderColor: `color-mix(in srgb, var(--c-primary) 45%, transparent)`,
                boxShadow: isLive ? `0 0 24px -6px var(--c-glow)` : 'none',
              }}
            >
              {displayIcon}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{displayName}</h1>
            {displaySubtitle && (
              <p className="text-sm text-text-secondary">{displaySubtitle}</p>
            )}
            <div className="flex items-center justify-center gap-2">
              <BroadcastModeIndicator mode={mode} bulletinHour={null} />
            </div>
          </div>

          <div className="flex justify-center relative">
            <div
              className="absolute inset-0 m-auto w-40 h-40 rounded-full blur-2xl opacity-40 pointer-events-none transition-opacity duration-700"
              style={{ background: theme.gradient, opacity: isLive ? 0.4 : 0.15 }}
            />
            <div className="relative">
              <FrequencyDial
                frequency={currentFreq}
                isActive={isLive}
                onChange={handleFrequencyChange}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <AudioVisualizer isPlaying={audio.isPlaying} size="large" />
          </div>

          {isLive && nowPlaying && (
            <>
              {nowPlaying.description && (
                <div className="card p-4 space-y-3 rf-fade-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Now Playing
                    </h3>
                    {nowPlaying.provider && (
                      <span className="text-[10px] text-text-secondary">
                        via {nowPlaying.provider}
                      </span>
                    )}
                  </div>

                  <div className="bg-surface rounded-xl p-3">
                    <p className="text-sm font-semibold text-text-primary mb-1">
                      {nowPlaying.title}
                    </p>
                    {nowPlaying.city && (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase mb-2"
                        style={{ backgroundColor: `color-mix(in srgb, var(--c-primary) 15%, transparent)`, color: 'var(--c-primary)' }}
                      >
                        {nowPlaying.city}{nowPlaying.province ? `, ${nowPlaying.province}` : ''}
                      </span>
                    )}
                    <div className="max-h-48 overflow-y-auto">
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {nowPlaying.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!userStarted && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setUserStarted(true)}
                className={`${SOFT_BTN} inline-flex items-center gap-2 px-6 py-3 md:px-7 md:py-3.5 rounded-full text-white text-sm font-medium shadow-lg min-h-11`}
                style={{ background: theme.gradient, boxShadow: `0 8px 24px -8px var(--c-glow)` }}
              >
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Listening
              </button>
              {nowPlayingError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  Connection error: {nowPlayingError}
                </div>
              )}
            </div>
          )}

          {userStarted && (
            <>
              <AudioPlayerBar
                title={nowPlaying?.title ?? 'Connecting...'}
                subtitle={nowPlaying?.artist ?? undefined}
                isPlaying={audio.isPlaying}
                isPaused={audio.isPaused}
                currentTime={audio.currentTime}
                duration={audio.duration}
                hasPrev={false}
                hasNext={!skipToLive}
                onPlayPause={handlePlayPause}
                onPrev={() => {}}
                onNext={handleNext}
                onSeek={handleSeek}
              />

              {/* LIVE badge — visible when listening but behind the latest segment */}
              {isLive && skipToLive && nowPlaying?.nextTitle && (
                <button
                  onClick={handleGoLive}
                  className={`${SOFT_BTN} w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium min-h-11`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Go Live
                </button>
              )}

              {!isLive && (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
                  {isConnected
                    ? 'Waiting for the backend to start broadcasting...'
                    : 'Connecting to broadcast...'}
                </div>
              )}

              {isLive && isMusicMode && (
                <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-400 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span>Playing music</span>
                </div>
              )}
            </>
          )}

          <NewsFeedPreview
            items={displayNews}
            loading={newsLoading}
            category={newsCategoryFilter}
            stationName={displayName}
            onCategoryChange={setNewsCategoryFilter}
          />

          {nextSegmentLabel && (
            <div className="text-center text-xs text-text-secondary">
              {nextSegmentLabel}
            </div>
          )}
        </div>

        <aside className="hidden md:flex lg:hidden flex-col gap-4 sticky top-24 self-start rf-fade-up">
          <div
            className="rounded-2xl p-4 border border-border/50"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, var(--c-primary) 12%, transparent), transparent)` }}
          >
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Tablet Controls
            </h4>

            <label className="block text-[10px] text-text-secondary uppercase tracking-wider mb-1.5">
              Volume
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-[var(--c-primary)] cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {nextSegmentLabel && (
            <div className="rounded-2xl p-3 border border-border/50 bg-surface/50 text-center text-xs text-text-secondary">
              {nextSegmentLabel}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}