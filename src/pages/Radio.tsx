import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ContentSource, StationRecord } from '../lib/types';
import { getChannel, newsCategoryForChannel, slugify, CHANNELS, getGlobalChannelBySlug } from '../lib/channels';
import type { Channel } from '../lib/channels';
import { useRadioEngine } from '../hooks/useRadioEngine';
import { useNewsItems } from '../hooks/useSupabase';
import { fetchStations, fetchContentSources } from '../lib/supabase';
import { newsItemsToTranscript } from '../lib/newsText';
import { filterNewsForStation } from '../lib/stationNewsFilter';
import { getFlagEmoji } from '../lib/types';

import BroadcastTimeline from '../components/player/BroadcastTimeline';
import LiveIndicator from '../components/LiveIndicator';
import AudioVisualizer from '../components/AudioVisualizer';
import FrequencyDial from '../components/FrequencyDial';
import TranscriptDisplay from '../components/TranscriptDisplay';
import AlertBanner from '../components/AlertBanner';
import TestControls from '../components/TestControls';
import NewsFeedPreview from '../components/NewsFeedPreview';
import RssDiagnostics from '../components/diagnostics/RssDiagnostics';
import SpeedControl from '../components/player/SpeedControl';
import VolumeControl from '../components/player/VolumeControl';

export default function Radio() {
  const { countrySlug, channelSlug } = useParams<{ countrySlug: string; channelSlug: string }>();
  const navigate = useNavigate();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [channelOverride, setChannelOverride] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (channelSlug) {
      const ch = getGlobalChannelBySlug(channelSlug);
      if (ch) {
        setChannelOverride(ch);
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

    fetchStations().then(all => {
      const found = all.find(s => slugify(s.name) === countrySlug);
      setStation(found ?? null);
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

  return <RadioPage station={station} channelOverride={channelOverride} />;
}

function RadioPage({ station, channelOverride }: { station: StationRecord; channelOverride: Channel | null }) {
  const navigate = useNavigate();
  const [currentFreq, setCurrentFreq] = useState(channelOverride?.frequency ?? '88.1');
  const [showTranscript, setShowTranscript] = useState(true);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const isGlobal = !!channelOverride;

  const channel = getChannel(currentFreq) ?? CHANNELS[0];

  const displayEmoji = isGlobal ? channelOverride!.emoji : (station.image_url ? undefined : getFlagEmoji(station.country_code));
  const displayImage = isGlobal ? undefined : station.image_url;
  const displayName = station.name;
  const displaySubtitle = isGlobal ? channelOverride!.description : station.region;
  const displayIcon = displayImage
    ? <img src={displayImage} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
    : <span className="text-3xl">{displayEmoji}</span>;

  const channelNewsCat = useMemo(() => newsCategoryForChannel(channel), [channel]);
  const { items: allItems, loading: newsLoading, refetch: refetchNews } = useNewsItems(undefined, channelNewsCat);
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
  }, []);

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

  const [sources, setSources] = useState<ContentSource[]>([]);
  const [rate, setRate] = useState(0.85);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    fetchContentSources().then(setSources);
  }, []);

  const feedTranscript = newsItemsToTranscript(filteredNews);
  const transcriptText = engine.currentText
    || feedTranscript
    || (engine.isLive ? 'Listening for new content...' : 'Click Start Broadcast to begin');

  useEffect(() => {
    if (engine.isLive && engine.currentIndex >= 0 && engine.isBehindLive) {
      setIsFollowingLive(false);
    }
  }, [engine.isLive, engine.currentIndex, engine.isBehindLive]);

  useEffect(() => {
    if (engine.isLive && !engine.isBehindLive) {
      setIsFollowingLive(true);
    }
  }, [engine.isBehindLive, engine.isLive]);

  const handleGoLive = useCallback(() => {
    setIsFollowingLive(true);
    engine.goLive();
  }, [engine]);

  const handleSelectIndex = useCallback((index: number) => {
    setIsFollowingLive(false);
    engine.jumpToIndex(index);
  }, [engine]);

  const handleRateChange = (r: number) => {
    setRate(r);
    engine.setRate(r);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    engine.setVolume(v);
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => { engine.stop(); navigate('/'); }}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{isGlobal ? 'All Channels' : 'All Countries'}</span>
          </button>

          <div className="flex items-center gap-3">
            <SpeedControl rate={rate} onChange={handleRateChange} />
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

        {engine.dbReady === false && (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-400">
            Supabase tables not found. Use <strong>Simulate News</strong> and <strong>Trigger Alert</strong> below to test, or run the backend ingestion service.
          </div>
        )}

        {!engine.isLive && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
            Click <strong>Start Broadcast</strong> to go live.
          </div>
        )}

        {engine.isMusicMode && (
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-400 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>
              No updates — playing music
              {engine.entertainmentTrack ? ` — ${engine.entertainmentTrack}` : ''}
            </span>
          </div>
        )}

        {engine.isLive && engine.state === 'idle' && !engine.isMusicMode && (
          <div className="rounded-xl bg-surface border border-border/50 p-3 text-xs text-text-secondary">
            Live but no content yet. Run the backend ingestion service to fetch RSS feeds, or use <strong>Simulate News</strong> below. Music will play automatically.
          </div>
        )}

        {typeof window !== 'undefined' && !window.speechSynthesis && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            Speech synthesis not available. Try Chrome or Edge.
          </div>
        )}

        <AlertBanner alert={engine.activeAlert} />

        {engine.isLive && engine.isBehindLive && engine.playlist.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Catching up — you're behind live. Click <strong>Go Live</strong> below to jump to the latest.
            </span>
          </div>
        )}

        <RssDiagnostics sources={sources} />

        {engine.isLive && engine.playlist.length > 0 && (
          <BroadcastTimeline
            items={engine.playlist}
            currentIndex={engine.currentIndex}
            isFollowingLive={isFollowingLive}
            onSelectIndex={handleSelectIndex}
            onGoLive={handleGoLive}
          />
        )}

        {showTranscript && (
          <TranscriptDisplay
            text={transcriptText}
            isPlaying={engine.state === 'speaking'}
          />
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={engine.isLive ? engine.stop : engine.start}
            className={`flex-1 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              engine.isLive
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-primary/20 text-primary hover:bg-primary/30'
            }`}
          >
            {engine.isLive ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Stop Broadcast
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Broadcast
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </button>

        <TestControls
          onSimulateNews={engine.simulateNews}
          onTriggerAlert={engine.triggerAlert}
          onReset={engine.resetQueue}
        />

        <NewsFeedPreview
          items={filteredNews}
          loading={newsLoading}
          category={channelNewsCat}
          stationName={station.name}
          onCategoryChange={() => {}}
        />
      </div>
    </div>
  );
}
