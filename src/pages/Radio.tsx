import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { StationRecord, BroadcastMode } from '../lib/types';
import { getChannel, slugify, getGlobalChannelBySlug } from '../lib/channels';
import type { Channel } from '../lib/channels';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { useAudioExecutor } from '../hooks/useAudioExecutor';
import { fetchStations, pruneOldData } from '../lib/supabase';
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

const SOFT_BTN = 'rf-press touch-manipulation select-none';

export default function Radio() {
  const { countrySlug, channelSlug } = useParams<{ countrySlug: string; channelSlug: string }>();
  const navigate = useNavigate();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [channelOverride, setChannelOverride] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [drcRegion, setDrcRegion] = useState<DCRegion | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (channelSlug) {
      const ch = getGlobalChannelBySlug(channelSlug);
      if (ch) {
        setChannelOverride(ch);
        setDrcRegion(null);
        setStation({
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
        });
      } else {
        navigate('/', { replace: true });
      }
      setLoading(false);
      return;
    }

    if (countrySlug?.startsWith('drc-')) {
      const regionSlug = countrySlug.replace('drc-', '');
      const region = getRegionBySlug(regionSlug);
      if (region) {
        setDrcRegion(region);
        setChannelOverride(null);
        setStation({
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
        });
        setLoading(false);
        return;
      }
      navigate('/', { replace: true });
      return;
    }

    fetchStations().then(all => {
      if (!isMounted) return;
      const found = all.find(s => slugify(s.name) === countrySlug);
      if (found) {
        setStation(found);
        setChannelOverride(null);
        setDrcRegion(null);
      } else {
        navigate('/', { replace: true });
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [countrySlug, channelSlug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 transition-colors duration-300">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!station) return null;

  return <RadioPage station={station} channelOverride={channelOverride} drcRegion={drcRegion} />;
}

function RadioPage({
  station,
  channelOverride,
  drcRegion,
}: {
  station: StationRecord;
  channelOverride: Channel | null;
  drcRegion?: DCRegion | null;
}) {
  const navigate = useNavigate();
  const [currentFreq, setCurrentFreq] = useState(channelOverride?.frequency ?? '88.1');
  const [userStarted, setUserStarted] = useState(false);
  const [skipToLive, setSkipToLive] = useState(false);
  const [volume, setVolume] = useState(1);

  const isGlobal = Boolean(channelOverride);

  const channelId = useMemo(() => {
    if (channelOverride) return 'global-main';
    if (drcRegion) return `${drcRegion.slug}-main`;
    return station.id;
  }, [channelOverride, drcRegion, station.id]);

  const latestVersionRef = useRef(0);
  const { nowPlaying, error: nowPlayingError, refetch: refetchNowPlaying } = useNowPlaying({
    channelId,
    enabled: userStarted,
  });

  useEffect(() => {
    if (nowPlaying?.version !== undefined) {
      latestVersionRef.current = nowPlaying.version;
    }
  }, [nowPlaying?.version]);

  useEffect(() => {
    if (!channelOverride) return;

    const freqChannel = getChannel(currentFreq);
    if (freqChannel && freqChannel.slug !== channelOverride.slug) {
      navigate(`/channel/${freqChannel.slug}`, { replace: true });
    }
  }, [currentFreq, channelOverride, navigate]);

  const handleTrackEnd = useCallback(() => {
    const versionAtEnd = latestVersionRef.current;
    let pollCount = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
      pollCount++;
      await refetchNowPlaying();

      if (latestVersionRef.current > versionAtEnd) {
        clearInterval(interval);
        return;
      }

      if (pollCount >= maxAttempts) {
        setSkipToLive(true);
        clearInterval(interval);
      }
    }, 1000);
  }, [refetchNowPlaying]);

  const audio = useAudioExecutor({ nowPlaying, enabled: userStarted, onTrackEnd: handleTrackEnd });

  const handleGoLive = useCallback(() => {
    setSkipToLive(true);
    refetchNowPlaying();
  }, [refetchNowPlaying]);

  const handleNext = useCallback(async () => {
    try {
      await fetch('/api/radio/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId }),
      });
    } catch {
      // Fallback silently
    }
    refetchNowPlaying();
  }, [channelId, refetchNowPlaying]);

  const isLive = userStarted && nowPlaying !== null && nowPlaying.segmentType !== 'silence';
  const isMusicMode = nowPlaying?.segmentType === 'ambient' && nowPlaying.audioType === 'stream';

  const displayEmoji = isGlobal
    ? channelOverride?.emoji
    : drcRegion
    ? drcRegion.emoji
    : station.image_url
    ? undefined
    : getFlagEmoji(station.country_code);

  const displayImage = !isGlobal && !drcRegion ? station.image_url : undefined;
  const displayName = drcRegion ? `${DRC_COUNTRY.name} \u2014 ${drcRegion.name}` : station.name;
  const displaySubtitle = isGlobal
    ? channelOverride?.description
    : drcRegion
    ? drcRegion.description
    : station.region;

  const displayIcon = displayImage ? (
    <img src={displayImage} alt={displayName} className="w-14 h-14 rounded-full object-cover shadow-sm" />
  ) : (
    <span className="text-4xl drop-shadow-xs">{displayEmoji}</span>
  );

  const theme = useMemo(
    () => getCountryTheme(station.country_code, displayName, drcRegion?.slug ?? null),
    [station.country_code, displayName, drcRegion?.slug],
  );

  const themeVars = useMemo<CSSProperties>(
    () =>
      ({
        '--c-primary': theme.primary,
        '--c-secondary': theme.secondary,
        '--c-accent': theme.accent,
        '--c-glow': theme.glow,
        '--c-gradient': theme.gradient,
      } as CSSProperties),
    [theme],
  );

  const timezone = useMemo(
    () => resolveTimezone(station.timezone, station.country_code, drcRegion?.slug),
    [station.timezone, station.country_code, drcRegion?.slug],
  );

  const isDrcBroadcast = Boolean(drcRegion);
  const timeInfo = useStationClock(timezone);

  const handleFrequencyChange = useCallback((freq: string) => {
    setCurrentFreq(freq);
  }, []);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      audio.setVolume(v);
    },
    [audio],
  );

  const handlePlayPause = useCallback(() => {
    audio.resumeAudioContext();
    if (audio.isPaused) {
      audio.resume();
    } else if (audio.isPlaying) {
      audio.pause();
    } else {
      refetchNowPlaying();
    }
  }, [audio, refetchNowPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      audio.seek(time);
    },
    [audio],
  );

  useEffect(() => {
    pruneOldData();
    const interval = setInterval(pruneOldData, 3600000);
    return () => clearInterval(interval);
  }, []);

  const isVoicePlaying =
    audio.isPlaying &&
    ['bulletin', 'tts', 'announcement', 'jingle'].includes(nowPlaying?.segmentType ?? '');

  const mode = useMemo<BroadcastMode>(() => {
    if (!isLive) return 'IDLE';
    if (isMusicMode) return 'MUSIC_FILL';
    if (nowPlaying?.segmentType === 'bulletin') return 'GLOBAL_BULLETIN';
    return 'LIVE_NEWS';
  }, [isLive, isMusicMode, nowPlaying?.segmentType]);

  const nextSegmentLabel = useMemo<string>(() => {
    if (!isLive || !nowPlaying?.nextTitle) return '';
    return `Up Next: ${nowPlaying.nextTitle}`;
  }, [isLive, nowPlaying?.nextTitle]);

  return (
    <div
      className="flex flex-col h-full min-h-screen select-none pb-6 transition-colors duration-500 relative overflow-hidden bg-slate-50 text-slate-800"
      style={{ ...themeVars }}
    >
      {/* Background Soft Radial Accent */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full blur-[100px] opacity-15 transition-all duration-1000"
        style={{ background: theme.gradient }}
      />

      <style>{`
        @keyframes rf-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rf-pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); } 50% { box-shadow: 0 0 0 10px transparent; } }
        .rf-fade-up { animation: rf-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rf-pulse { animation: rf-pulse-ring 2.4s ease-in-out infinite; }
        .rf-press {
          transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 180ms ease, filter 180ms ease, background-color 180ms ease;
        }
        .rf-press:hover { filter: brightness(1.05); }
        .rf-press:active { transform: scale(0.95); filter: brightness(0.95); }
        @media (prefers-reduced-motion: reduce) {
          .rf-fade-up, .rf-pulse, .rf-press { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-200/80 shadow-xs shrink-0">
        <div className="max-w-lg mx-auto w-full px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className={`${SOFT_BTN} flex items-center gap-2 text-slate-700 hover:text-indigo-600 bg-slate-100/80 hover:bg-slate-200/80 px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold tracking-wide transition-colors`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{isGlobal ? 'All Channels' : isDrcBroadcast ? DRC_COUNTRY.name : 'All Countries'}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className={isLive ? 'rf-pulse rounded-full' : ''}>
              <LiveIndicator isLive={isLive} />
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto radio-scrollable-content max-w-lg mx-auto w-full px-4 pt-6 pb-4 space-y-6 z-10">
        {/* Station Info Header */}
        <div className="text-center space-y-2.5 rf-fade-up">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full transition-all duration-700 relative overflow-hidden ring-4 ring-white shadow-xl"
            style={{
              background: theme.gradient,
              boxShadow: isLive
                ? `0 10px 25px -5px rgba(79, 70, 229, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.05)`
                : `0 8px 16px -4px rgba(0, 0, 0, 0.1)`,
            }}
          >
            <div className="absolute inset-0 bg-white/20 backdrop-blur-xs" />
            <span className="relative z-10 drop-shadow-xs">{displayIcon}</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {displayName}
            </h1>
            {displaySubtitle && (
              <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">
                {displaySubtitle}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <BroadcastModeIndicator mode={mode} bulletinHour={null} />
          </div>
        </div>

        {/* Dial Component */}
        <div className="flex justify-center relative py-2">
          <div
            className="absolute inset-0 m-auto w-40 h-40 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity duration-700 bg-indigo-500"
          />
          <div className="relative touch-none" style={{ touchAction: 'none' }}>
            <FrequencyDial
              frequency={currentFreq}
              isActive={isLive}
              onChange={handleFrequencyChange}
            />
          </div>
        </div>

        {/* Audio Visualizer Card */}
        <div className="flex flex-col items-center justify-center py-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          <AudioVisualizer isPlaying={audio.isPlaying} analyser={audio.getAnalyser()} size="medium" />
        </div>

        {/* Start Audio CTA */}
        {!userStarted && (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              onClick={() => {
                setUserStarted(true);
                audio.resumeAudioContext();
              }}
              className={`${SOFT_BTN} group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-white text-base font-bold tracking-wide transition-all bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 cursor-pointer active:scale-95 overflow-hidden`}
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Start Stream</span>
            </button>
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
              Click to connect stream
            </span>

            {nowPlayingError && (
              <div className="mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-xs font-medium text-red-600">
                Connection error: {nowPlayingError}
              </div>
            )}
          </div>
        )}

        {/* Controls and Script Display */}
        {userStarted && (
          <div className="space-y-4">
            {/* Embedded Player Bar Wrapper */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-sm">
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
                volume={volume}
                onVolumeChange={handleVolumeChange}
              />
            </div>

            {/* On Air Script Container */}
            {nowPlaying?.description &&
              nowPlaying.segmentType !== 'ambient' &&
              nowPlaying.segmentType !== 'silence' && (
                <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-600" />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isVoicePlaying ? 'bg-indigo-600 animate-pulse ring-4 ring-indigo-100' : 'bg-slate-300'
                        }`}
                      />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {isVoicePlaying ? 'On Air Script' : 'Script Ready'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-normal">
                    {nowPlaying.description}
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Up Next Notice */}
        {nextSegmentLabel && (
          <div className="text-center py-1">
            <span className="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200/60">
              {nextSegmentLabel}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Controls Sheet */}
      <RadioControlsSheet
        volume={volume}
        onVolumeChange={handleVolumeChange}
        timeInfo={timeInfo}
        isLive={isLive}
        onGoLive={handleGoLive}
        showGoLive={isLive && skipToLive && Boolean(nowPlaying?.nextTitle)}
      />
    </div>
  );
}