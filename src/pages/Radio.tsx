import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import RadioControlsSheet from '../components/player/RadioControlsSheet';
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

  // Channel ID for the backend engine — maps to backend channel_id format
  // Backend channels: 'kinshasa-main', 'goma-main', 'lubumbashi-main', 'global-main'
  const channelId = useMemo(() => {
    if (channelOverride) return 'global-main';
    if (drcRegion) return `${drcRegion.slug}-main`;
    return station.id;
  }, [channelOverride, drcRegion, station]);

  const [userStarted, setUserStarted] = useState(false);
  const [skipToLive, setSkipToLive] = useState(false);
  const latestVersionRef = useRef(0);
  const { nowPlaying, error: nowPlayingError, refetch: refetchNowPlaying } = useNowPlaying({
    channelId,
    enabled: userStarted,
  });

  // Keep the ref in sync with the latest nowPlaying version
  useEffect(() => {
    if (nowPlaying?.version) {
      latestVersionRef.current = nowPlaying.version;
    }
  }, [nowPlaying?.version]);

  const handleTrackEnd = useCallback(() => {
    const versionAtEnd = latestVersionRef.current;

    let interval: ReturnType<typeof setInterval> | null = null;
    let pollCount = 0;
    const maxAttempts = 10; // 10 * 1.5s = 15 seconds

    const poll = async () => {
      pollCount++;
      await refetchNowPlaying();

      if (latestVersionRef.current > versionAtEnd) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        return;
      }

      if (pollCount >= maxAttempts && interval) {
        setSkipToLive(true);
        clearInterval(interval);
        interval = null;
      }
    };

    poll();
    interval = setInterval(poll, 1500);
  }, [refetchNowPlaying]);

  const audio = useAudioExecutor({ nowPlaying, enabled: userStarted, onTrackEnd: handleTrackEnd });

  // "Go Live" — skip to the latest segment
  const handleGoLive = useCallback(() => {
    setSkipToLive(true);
    refetchNowPlaying();
  }, [refetchNowPlaying]);

  // "Next" — skip to latest available segment
  const handleNext = useCallback(async () => {
    try {
      await fetch('/api/radio/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId }),
      });
    } catch {
      // fallback: just refetch
    }
    refetchNowPlaying();
  }, [channelId, refetchNowPlaying]);

  const isLive = userStarted && nowPlaying !== null && nowPlaying.segmentType !== 'silence';
  const isMusicMode = nowPlaying?.segmentType === 'ambient' && nowPlaying.audioType === 'stream';

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
    audio.resumeAudioContext();
    if (audio.isPaused) {
      audio.resume();
    } else if (audio.isPlaying) {
      audio.pause();
    } else {
      // Neither playing nor paused (dead state from bug #1)
      // Refresh to kickstart playback with current segment
      refetchNowPlaying();
    }
  }, [audio.isPaused, audio.isPlaying, audio.pause, audio.resume, audio.resumeAudioContext, refetchNowPlaying]);

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
    <div className="flex flex-col h-full min-h-0 select-none pb-4" style={themeVars}>
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
        className="sticky top-0 z-40 glass border-b transition-colors duration-500 shrink-0"
        style={{ borderColor: `color-mix(in srgb, var(--c-primary) 25%, transparent)` }}
      >
        <div className="w-full px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className={`${SOFT_BTN} flex items-center gap-1.5 text-text-secondary hover:text-text-primary min-h-9 -ml-1 pl-1 pr-2 rounded-lg`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-semibold">{isGlobal ? 'All Channels' : (isDrcBroadcast ? DRC_COUNTRY.name : 'All Countries')}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className={isLive ? 'rf-pulse rounded-full' : ''}>
              <LiveIndicator isLive={isLive} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto radio-scrollable-content max-w-lg mx-auto w-full px-3 py-3 space-y-3">
        <div className="space-y-3">
          <div className="text-center space-y-1 rf-fade-up">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border transition-shadow duration-500 shadow-sm"
              style={{
                borderColor: `color-mix(in srgb, var(--c-primary) 45%, transparent)`,
                boxShadow: isLive ? `0 0 15px -4px var(--c-glow)` : 'none',
              }}
            >
              {displayIcon}
            </div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">{displayName}</h1>
            {displaySubtitle && (
              <p className="text-[10px] text-text-secondary leading-none">{displaySubtitle}</p>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <BroadcastModeIndicator mode={mode} bulletinHour={null} />
            </div>
          </div>

          <div className="flex justify-center relative">
            <div
              className="absolute inset-0 m-auto w-28 h-28 rounded-full blur-xl opacity-35 pointer-events-none transition-opacity duration-700"
              style={{ background: theme.gradient, opacity: isLive ? 0.35 : 0.12 }}
            />
            <div className="relative touch-none" style={{ touchAction: 'none' }}>
              <FrequencyDial
                frequency={currentFreq}
                isActive={isLive}
                onChange={handleFrequencyChange}
              />
            </div>
          </div>

          <div className="flex justify-center py-0.5">
            <AudioVisualizer isPlaying={audio.isPlaying} analyser={audio.getAnalyser()} size="medium" />
          </div>

          {!userStarted && (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <button
                onClick={() => {
                  setUserStarted(true);
                  audio.resumeAudioContext();
                }}
                className={`${SOFT_BTN} inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-[11px] font-bold shadow-md bg-red-600 hover:bg-red-500 shadow-red-600/30 active:scale-95 transition-all cursor-pointer`}
              >
                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Stream
              </button>
              {nowPlayingError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-[10px] text-red-400">
                  Connection error: {nowPlayingError}
                </div>
              )}
            </div>
          )}

          {userStarted && (
            <div className="space-y-2">
              <AudioPlayerBar
                title={nowPlaying?.title ?? 'Radio Lezo — Background'}
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
            </div>
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
      </div>

      <RadioControlsSheet
        volume={volume}
        onVolumeChange={handleVolumeChange}
        timeInfo={timeInfo}
        isLive={isLive}
        onGoLive={handleGoLive}
        showGoLive={isLive && skipToLive && !!nowPlaying?.nextTitle}
      />
    </div>
  );
}