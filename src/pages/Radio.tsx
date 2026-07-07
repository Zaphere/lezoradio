import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { StationRecord, VoiceOption, BroadcastMode } from '../lib/types';
import { getChannel, newsCategoryForChannel, slugify, CHANNELS, getGlobalChannelBySlug } from '../lib/channels';
import type { Channel } from '../lib/channels';
import { useRadioEngine } from '../hooks/useRadioEngine';
import { useNewsItems } from '../hooks/useSupabase';
import { fetchStations, pruneOldData, fetchRadioScripts } from '../lib/supabase';
import { filterNewsForStation } from '../lib/stationNewsFilter';
import { getFlagEmoji } from '../lib/types';
import type { DCRegion } from '../lib/drcRegions';
import { DRC_COUNTRY, getRegionBySlug, isPrimeTime } from '../lib/drcRegions';
import { resolveTimezone } from '../lib/stationTime';
import { useStationClock } from '../hooks/useStationClock';
import { useFrenchBulletin } from '../hooks/useFrenchBulletin';
import { getBroadcastMode, getBulletinScriptForHour, FRENCH_BULLETIN_INTRO_SCRIPT } from '../lib/frenchBulletin';
import { useBroadcastFlowSupervisor } from '../hooks/useBroadcastFlowSupervisor';
import { saveSeekPosition, loadSeekPosition } from '../lib/seekPositions';

import LiveIndicator from '../components/LiveIndicator';
import AudioVisualizer from '../components/AudioVisualizer';
import FrequencyDial from '../components/FrequencyDial';
import VolumeControl from '../components/player/VolumeControl';
import StationClock from '../components/player/StationClock';
import BroadcastModeIndicator from '../components/player/BroadcastModeIndicator';
import AudioPlayerBar from '../components/player/AudioPlayerBar';
import TranscriptDisplay from '../components/TranscriptDisplay';
import { newsItemToSpeech, stripHtml } from '../lib/newsText';

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
  const [, setLastUpdate] = useState(Date.now());
  const [, setBulletinActive] = useState(false);
  const isGlobal = !!channelOverride;

  const currentTimeRef = useRef(0);
  const currentItemIdRef = useRef<string | null>(null);
  const engineIsLiveRef = useRef(false);
  const bulletinLockRef = useRef(false);
  const markCompleteRef = useRef<() => void>(() => {});

  const channel = getChannel(currentFreq) ?? CHANNELS[0];

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

  const timezone = useMemo(
    () => resolveTimezone(station.timezone, station.country_code, drcRegion?.slug),
    [station.timezone, station.country_code, drcRegion?.slug],
  );
  const isDrcBroadcast = !!drcRegion;

  const channelNewsCat = useMemo(() => newsCategoryForChannel(channel), [channel]);
  const { items: allItems, refetch: refetchNews } = useNewsItems(undefined, channelNewsCat);
  const filteredNews = useMemo(
    () => filterNewsForStation(allItems, station, channelNewsCat),
    [allItems, station, channelNewsCat],
  );

  const engine = useRadioEngine({
    stationId: station.id,
    stationName: station.name,
    stationRegion: station.region,
    newsCategory: channelNewsCat,
  });

  const handleFrequencyChange = useCallback((freq: string) => {
    setCurrentFreq(freq);
    if (engine.isLive) {
      engine.requestChannelSwitch();
    }
  }, [engine.isLive, engine.requestChannelSwitch]);

  const { isLive: engineIsLive, setFeedItems, stop: engineStop, start: engineStart } = engine;

  useEffect(() => {
    if (!channel.isMusic) {
      setFeedItems(filteredNews);
    }
  }, [filteredNews, channel.frequency, channel.isMusic, setFeedItems]);

  useEffect(() => {
    if (channel.isMusic && engineIsLive) {
      engineStop();
      engineStart();
    }
  }, [channel.frequency, channel.isMusic, engineIsLive, engineStop, engineStart]);

  useEffect(() => {
    if (!engine.isLive) return;
    refetchNews();
    const interval = setInterval(refetchNews, 15000);
    return () => clearInterval(interval);
  }, [currentFreq, engine.isLive, refetchNews]);

  const [volume, setVolume] = useState(1);

  const handleGoLive = useCallback(() => {
    engine.goLive();
  }, [engine.goLive]);

  const handleStartRadio = useCallback(async () => {
    try {
      await refetchNews();
    } catch (err) {
      console.warn('Failed to refetch news on start:', err);
    }
    engine.start();
  }, [refetchNews, engine.start]);

  const handleSelectIndex = useCallback((index: number) => {
    engine.jumpToIndex(index);
    const item = engine.playlist[index];
    if (item) {
      const saved = loadSeekPosition(station.id, item.id);
      if (saved > 0) {
        setTimeout(() => engine.seek(saved), 200);
      }
    }
  }, [engine.jumpToIndex, engine.playlist, engine.seek, station.id]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    engine.setVolume(v);
  }, [engine.setVolume]);

  const handlePlayPause = useCallback(() => {
    if (engine.state === 'speaking') {
      engine.pause();
    } else if (engine.state === 'paused') {
      engine.resume();
    }
  }, [engine.state, engine.pause, engine.resume]);

  const handleSeek = useCallback((time: number) => {
    engine.seek(time);
    if (currentItemIdRef.current) {
      saveSeekPosition(station.id, currentItemIdRef.current, time);
    }
  }, [engine.seek, station.id]);

  const handlePrev = useCallback(() => {
    const idx = engine.currentIndex - 1;
    if (idx >= 0) handleSelectIndex(idx);
  }, [engine.currentIndex, handleSelectIndex]);

  const handleNext = useCallback(() => {
    const idx = engine.currentIndex + 1;
    if (idx < engine.playlist.length) handleSelectIndex(idx);
  }, [engine.currentIndex, engine.playlist.length, handleSelectIndex]);

  useEffect(() => { engineIsLiveRef.current = engine.isLive; }, [engine.isLive]);
  useEffect(() => { currentTimeRef.current = engine.currentTime; }, [engine.currentTime]);
  useEffect(() => { currentItemIdRef.current = engine.currentItem?.id ?? null; }, [engine.currentItem]);

  const isCurrentlyPrimeTime = isPrimeTime();
  useEffect(() => {
    if (!isDrcBroadcast || !drcRegion) return;
    if (!engine.isLive) return;
    const useFrench = isCurrentlyPrimeTime;
    const voiceId = useFrench
      ? '3IyGWZwOTNraZr1Tz0fI'
      : (drcRegion.language === 'lingala' ? '2tSJpap7gXlgDV2bauu0' : '3IyGWZwOTNraZr1Tz0fI');
    const voiceName = useFrench ? 'French' : (drcRegion.language === 'lingala' ? 'Lingala' : 'French');
    engine.setVoice({
      name: voiceName,
      lang: 'fr',
      voiceURI: voiceId,
      localService: false,
      provider: 'elevenlabs',
      providerVoiceId: voiceId,
    } satisfies VoiceOption);
  }, [isDrcBroadcast, drcRegion?.slug, engine.isLive, isCurrentlyPrimeTime]);

  const timeInfo = useStationClock(timezone);

  const handleBulletinTrigger = useCallback((hour: number) => {
    if (bulletinLockRef.current) return;
    bulletinLockRef.current = true;
    setBulletinActive(true);
    fetchRadioScripts(station.region || undefined).then(scripts => {
      const newsCount = scripts.length;
      const bulletinScript = getBulletinScriptForHour(hour, station.name, newsCount);
      engine.speakBulletin(bulletinScript, FRENCH_BULLETIN_INTRO_SCRIPT);
      setTimeout(() => {
        bulletinLockRef.current = false;
        setBulletinActive(false);
        markCompleteRef.current();
      }, 60000);
    });
  }, [station.name, station.region, engine.speakBulletin]);

  const bulletin = useFrenchBulletin({
    timezone,
    stationId: station.id,
    isLive: engine.isLive,
    onTrigger: handleBulletinTrigger,
  });

  useEffect(() => {
    markCompleteRef.current = bulletin.markComplete;
  }, [bulletin.markComplete]);

  const handleFetchScripts = useCallback(async () => {
    try {
      await fetchRadioScripts(station.region || undefined);
      refetchNews();
    } catch {
      /* ignore */
    }
  }, [station.region, refetchNews]);

  const { status: bfsStatus } = useBroadcastFlowSupervisor({
    stationId: station.id,
    stationName: station.name,
    isLive: engine.isLive,
    broadcastState: engine.broadcastState,
    voiceState: engine.state,
    isMusicMode: engine.isMusicMode,
    queueLength: engine.queue.length,
    playlistLength: engine.playlist.length,
    isBehindLive: engine.isBehindLive,
    speak: engine.speak,
    fetchScripts: handleFetchScripts,
    onBridgeModeEnter: () => {},
    onBridgeModeExit: () => {},
    isPlaybackLocked: engine.isPlaybackLocked,
  });

  const mode = useMemo<BroadcastMode>(() => getBroadcastMode(
    engine.broadcastState,
    bulletin.activeBulletinHour !== null,
    !!engine.activeAlert,
    engine.isMusicMode,
    engine.isLive,
  ), [engine.broadcastState, bulletin.activeBulletinHour, engine.activeAlert, engine.isMusicMode, engine.isLive]);

  const nextSegmentLabel = useMemo<string>(() => {
    if (!engine.isLive) return '';
    if (engine.isMusicMode) return 'Music playing';
    if (bulletin.isPlaying) return 'Bulletin in progress';
    if (engine.isBehindLive) return 'Catching up...';
    return `Next: ${bulletin.nextBulletinTime}`;
  }, [engine.isLive, engine.isMusicMode, bulletin.isPlaying, bulletin.nextBulletinTime, engine.isBehindLive]);

  useEffect(() => {
    pruneOldData();
    const interval = setInterval(pruneOldData, 3600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!engine.isLive || engine.state !== 'speaking') return;
    const interval = setInterval(() => {
      if (currentItemIdRef.current) {
        saveSeekPosition(station.id, currentItemIdRef.current, engine.currentTime);
      }
      setLastUpdate(Date.now());
    }, 3000);
    return () => clearInterval(interval);
  }, [engine.isLive, engine.state, station.id]);

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => { try { engine.stop(); } catch {} navigate('/'); }}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{isGlobal ? 'All Channels' : (isDrcBroadcast ? DRC_COUNTRY.name : 'All Countries')}</span>
          </button>

          <div className="flex items-center gap-3">
            <StationClock timeInfo={timeInfo} />
            <VolumeControl volume={volume} onChange={handleVolumeChange} />
            <LiveIndicator isLive={engine.isLive} />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface border border-border">
            {displayIcon}
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
          {displaySubtitle && (
            <p className="text-sm text-text-secondary">{displaySubtitle}</p>
          )}
          <div className="flex items-center justify-center gap-2">
            <BroadcastModeIndicator mode={mode} bulletinHour={bulletin.activeBulletinHour} />
            {bfsStatus !== 'monitoring' && (
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                {bfsStatus}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <FrequencyDial
            frequency={currentFreq}
            isActive={engine.isLive}
            onChange={handleFrequencyChange}
          />
        </div>

        <div className="flex justify-center">
          <AudioVisualizer isPlaying={engine.state === 'speaking' || !!engine.entertainmentTrack} size="large" />
        </div>

        {engine.isLive && engine.playlist.length > 0 && (
          <>
            <AudioPlayerBar
              title={engine.currentItem?.title ?? (engine.isMusicMode && engine.entertainmentTrack ? `Music: ${engine.entertainmentTrack}` : 'No story playing')}
              subtitle={engine.isMusicMode ? undefined : (engine.currentItem?.category ? `[${engine.currentItem.category}]` : undefined)}
              isPlaying={engine.state === 'speaking'}
              isPaused={engine.state === 'paused'}
              currentTime={engine.currentTime}
              duration={engine.duration}
              hasPrev={engine.currentIndex > 0}
              hasNext={engine.currentIndex < engine.playlist.length - 1}
              onPlayPause={handlePlayPause}
              onPrev={handlePrev}
              onNext={handleNext}
              onSeek={handleSeek}
            />

            {engine.currentItem && !engine.isMusicMode && (
              <div className="card p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Presenter Script
                  </h3>
                  <span className="text-[10px] text-text-secondary">
                    Story {engine.currentIndex + 1} of {engine.playlist.length}
                  </span>
                </div>

                <div className="bg-surface rounded-xl p-3">
                  <p className="text-sm font-semibold text-text-primary mb-1">
                    {engine.currentItem.title}
                  </p>
                  {engine.currentItem.category && (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium uppercase mb-2">
                      {engine.currentItem.category}
                    </span>
                  )}
                  <div className="max-h-48 overflow-y-auto">
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {stripHtml(engine.currentItem.description || engine.currentItem.content || '') || 'No content'}
                    </p>
                  </div>
                </div>

                {engine.state === 'speaking' && (
                  <TranscriptDisplay
                    text={newsItemToSpeech(engine.currentItem)}
                    isPlaying={engine.state === 'speaking'}
                  />
                )}

                {engine.playlist.length > 1 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Running Order
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {engine.playlist.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectIndex(i)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                            i === engine.currentIndex
                              ? 'bg-primary/15 text-primary font-medium'
                              :                           i < engine.currentIndex
                              ? 'bg-surface-hover/50 text-text-secondary/50 line-through'
                              : 'bg-surface text-text-secondary hover:bg-surface-hover'
                          }`}
                        >
                          <span className="mr-2 opacity-50">{(i + 1).toString().padStart(2, '0')}</span>
                          {item.title}
                          <span className="ml-2 text-[10px] opacity-50">[{item.category}]</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!engine.isLive && (
          <div className="flex justify-center">
            <button
              onClick={handleStartRadio}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start
            </button>
          </div>
        )}

        {engine.isLive && engine.isBehindLive && engine.playlist.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Behind live — catching up
              </span>
              <button
                onClick={handleGoLive}
                className="px-3 py-1 rounded-lg bg-primary text-white text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Go Live
              </button>
            </div>
          </div>
        )}

        {engine.dbReady === false && (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-400">
            Database not ready.
          </div>
        )}

        {!engine.isLive && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
            Click <strong>Start</strong> to go live.
          </div>
        )}

        {engine.isMusicMode && engine.isLive && (
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-400 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>
              Playing music
              {engine.entertainmentTrack ? ` — ${engine.entertainmentTrack}` : ''}
            </span>
          </div>
        )}

        {engine.isLive && engine.state === 'idle' && !engine.isMusicMode && (
          <div className="rounded-xl bg-surface border border-border/50 p-3 text-xs text-text-secondary">
            Live but no content yet. Run the backend ingestion service to fetch RSS feeds.
          </div>
        )}

        {typeof window !== 'undefined' && !window.speechSynthesis && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            Speech synthesis not available.
          </div>
        )}

        {nextSegmentLabel && (
          <div className="text-center text-xs text-text-secondary">
            {nextSegmentLabel}
          </div>
        )}
      </div>
    </div>
  );
}
