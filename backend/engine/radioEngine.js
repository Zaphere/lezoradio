// backend/engine/radioEngine.js
// Top-level orchestrator — event-driven, coordinates all engine modules.

import { ENGINE_VERSION, SEGMENT_TYPES, DEFAULT_STATE } from './constants.js';
import * as stationController from './stationController.js';
import * as languageController from './languageController.js';
import * as contentNormalizer from './contentNormalizer.js';
import * as audioManager from './audioManager.js';
import * as queueManager from './queueManager.js';
import * as playbackController from './playbackController.js';
import * as eventListener from './eventListener.js';
import * as eventScheduler from './eventScheduler.js';
import * as ttsGenerator from './ttsGenerator.js';
import * as radioWsServer from './radioWsServer.js';
import {
  generateEventScript,
  generateBulletinIntro,
  generateStationIdText,
  generateTimeAnnouncement,
} from '../providers/scriptGenerator.js';

class RadioEngine {
  constructor() {
    this.channels = new Map(); // channelId -> channelState
    this.running = false;
    this.refreshInterval = null;
  }

  /**
   * Start the radio engine.
   */
  async start() {
    console.log(`[${new Date().toISOString()}] [radioEngine] Starting Radio Engine v${ENGINE_VERSION}`);

    // Load all configuration from DB
    await Promise.all([
      stationController.refreshCache(),
      contentNormalizer.refreshCache(),
      audioManager.loadAudioConfig(),
      languageController.loadVoices(),
    ]);

    const channels = stationController.getAllChannels();
    if (channels.length === 0) {
      console.warn(`[radioEngine] No active channels found. Engine idle.`);
      return;
    }

    // Initialize state for each channel
    for (const ch of channels) {
      const state = playbackController.createChannelState(ch.channel_id, ch.station_id, ch.language || 'fr');
      this.channels.set(ch.channel_id, state);
    }

    // Start event listener
    eventListener.startEventListener((event) => this.onNewContent(event));

    // Start scheduler
    eventScheduler.setCallbacks({
      onBulletin: (data) => this.triggerBulletin(data),
      onStationId: (data) => this.triggerStationId(data),
      onTimeAnnouncement: (data) => this.triggerTimeAnnouncement(data),
    });
    await eventScheduler.scheduleBulletins();
    eventScheduler.scheduleStationIds(channels, this.getEngineConfig());
    eventScheduler.scheduleTimeAnnouncements(channels);

    // Start periodic refresh
    this.refreshInterval = setInterval(() => this.refresh(), 5 * 60 * 1000);

    this.running = true;
    console.log(`[${new Date().toISOString()}] [radioEngine] Engine started with ${channels.length} channels`);
  }

  /**
   * Get engine config from DB (or defaults).
   */
  getEngineConfig() {
    return {
      station_id_interval_min_ms: 1200000,
      station_id_interval_max_ms: 1800000,
      time_announcement_interval_min_ms: 1800000,
      time_announcement_interval_max_ms: 1800000,
      silence_threshold_ms: 3500,
      recovery_check_interval_ms: 2000,
    };
  }

  /**
   * Handle new content arriving from a provider.
   */
  async onNewContent(event) {
    console.log(`[${new Date().toISOString()}] [radioEngine] New content: ${event.id} (${event.category}) from ${event.provider}`);

    const normalized = contentNormalizer.normalizeItem(event.provider, event);

    for (const [channelId, channelState] of this.channels) {
      const channel = stationController.getChannel(channelId);
      if (!channel) continue;
      if (this.shouldRouteToChannel(normalized, channel)) {
        console.log(`[radioEngine] Routing ${event.id} to ${channelId}`);
      }
    }
  }

  /**
   * Check if a normalized event should be routed to a channel.
   */
  shouldRouteToChannel(event, channel) {
    if (channel.language && event.language && channel.language !== event.language) {
      return false;
    }
    if (channel.region && event.province && channel.region !== event.province) {
      return false;
    }
    return true;
  }

  /**
   * Trigger a bulletin for a channel — uses scriptGenerator, not hardcoded text.
   */
  async triggerBulletin(data) {
    const { channelId, stationId, label, bulletinId } = data;
    console.log(`[${new Date().toISOString()}] [radioEngine] Bulletin triggered for ${channelId}: ${label}`);

    const channel = stationController.getChannel(channelId);
    const language = channel?.language || this.channels.get(channelId)?.language || 'fr';
    const stationName = channel?.station_name || 'Radio Lezo';
    const voice = languageController.resolveVoice(stationId, language, 'bulletin');

    // Fetch unplayed events for this channel and generate scripts
    const events = await queueManager.getUnplayedEvents(channelId, 10);

    let bulletinText;
    if (events.length > 0) {
      // Generate bulletin intro + per-event scripts
      const intro = generateBulletinIntro(language, stationName, events.length);
      const eventScripts = events.map(e => generateEventScript(e, language));
      bulletinText = `${intro} ${eventScripts.join('. ')}`;
    } else {
      // Fallback: generic bulletin with no events
      bulletinText = generateBulletinIntro(language, stationName, 0);
    }

    if (voice) {
      const ttsResult = await ttsGenerator.getOrGenerate(bulletinText, voice.voice_id, language);
      if (ttsResult) {
        // Determine primary source attribution from top event
        const topEvent = events[0] || {};

        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.BULLETIN,
          segment_id: `bulletin-${bulletinId || Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: label || `${stationName} Bulletin`,
          duration_seconds: Math.max(30, events.length * 8),
          language,
          voice_id: voice.voice_id,
          // Source attribution
          provider: topEvent.provider || null,
          city: topEvent.city || null,
          province: topEvent.province || null,
          description: bulletinText.substring(0, 500),
        });

        // Mark events as played
        for (const event of events) {
          await queueManager.markPlayed(channelId, 'event', event.id, {
            provider: event.provider,
            category: event.category,
          });
        }
      }
    }
  }

  /**
   * Trigger a station ID jingle — uses scriptGenerator, not hardcoded text.
   */
  async triggerStationId(data) {
    const { channelId, stationId, stationName } = data;
    console.log(`[${new Date().toISOString()}] [radioEngine] Station ID for ${channelId}`);

    const channel = stationController.getChannel(channelId);
    const language = channel?.language || this.channels.get(channelId)?.language || 'fr';
    const voice = languageController.resolveVoice(stationId, language, 'station_id');

    const stationIdText = generateStationIdText(language, stationName || 'Radio Lezo');

    if (voice) {
      const ttsResult = await ttsGenerator.getOrGenerate(stationIdText, voice.voice_id, language);
      if (ttsResult) {
        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.JINGLE,
          segment_id: `station-id-${Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: `Station ID - ${stationName}`,
          duration_seconds: 5,
          language,
          voice_id: voice.voice_id,
        });
      }
    }
  }

  /**
   * Trigger a time announcement — uses scriptGenerator, not hardcoded text.
   */
  async triggerTimeAnnouncement(data) {
    const { channelId, stationId, timezone, hour, minute } = data;
    console.log(`[${new Date().toISOString()}] [radioEngine] Time announcement for ${channelId}: ${hour}:${String(minute).padStart(2, '0')}`);

    const channel = stationController.getChannel(channelId);
    const language = channel?.language || this.channels.get(channelId)?.language || 'fr';
    const voice = languageController.resolveVoice(stationId, language, 'announcement');

    const timeText = generateTimeAnnouncement(language, hour, minute);

    if (voice) {
      const ttsResult = await ttsGenerator.getOrGenerate(timeText, voice.voice_id, language);
      if (ttsResult) {
        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.ANNOUNCEMENT,
          segment_id: `time-${Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: `Time: ${hour}:${String(minute).padStart(2, '0')}`,
          duration_seconds: 8,
          language,
          voice_id: voice.voice_id,
        });
      }
    }
  }

  /**
   * Update the current segment for a channel.
   */
  async updateCurrentSegment(channelId, segmentData) {
    const state = this.channels.get(channelId);
    if (!state) return;

    state.nextSegment = { ...state.currentSegment };
    state.currentSegment = { ...DEFAULT_STATE, ...segmentData };
    state.startedAt = new Date().toISOString();
    state.version += 1;

    await playbackController.updateState(channelId, state);
    await playbackController.logPlayback(channelId, state.currentSegment);
    radioWsServer.broadcastState(channelId, this.formatStateForFrontend(state));
  }

  /**
   * Format state for frontend consumption — includes source attribution.
   */
  formatStateForFrontend(state) {
    return {
      channel_id: state.channelId,
      station_id: state.stationId,
      segment_type: state.currentSegment.segment_type,
      segment_id: state.currentSegment.segment_id,
      audio_url: state.currentSegment.audio_url,
      audio_type: state.currentSegment.audio_type,
      title: state.currentSegment.title,
      artist: state.currentSegment.artist,
      album: state.currentSegment.album,
      duration_seconds: state.currentSegment.duration_seconds,
      started_at: state.startedAt,
      transition_type: state.currentSegment.transition_type,
      transition_duration_ms: state.currentSegment.transition_duration_ms,
      duck_volume: state.currentSegment.duck_volume,
      next_segment_type: state.nextSegment?.segment_type,
      next_audio_url: state.nextSegment?.audio_url,
      next_title: state.nextSegment?.title,
      next_artist: state.nextSegment?.artist,
      next_duration_seconds: state.nextSegment?.duration_seconds,
      language: state.language,
      voice_id: state.currentSegment.voice_id,
      // Source attribution
      provider: state.currentSegment.provider || null,
      city: state.currentSegment.city || null,
      province: state.currentSegment.province || null,
      description: state.currentSegment.description || null,
      version: state.version,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Periodic refresh of caches.
   */
  async refresh() {
    try {
      await Promise.all([
        stationController.refreshCache(),
        contentNormalizer.refreshCache(),
        audioManager.loadAudioConfig(),
        languageController.loadVoices(),
      ]);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [radioEngine] Refresh error:`, err.message);
    }
  }

  /**
   * Stop the engine gracefully.
   */
  async stop() {
    console.log(`[${new Date().toISOString()}] [radioEngine] Stopping engine...`);
    this.running = false;
    eventListener.stopEventListener();
    eventScheduler.stopAll();
    radioWsServer.stopRadioWsServer();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    console.log(`[${new Date().toISOString()}] [radioEngine] Engine stopped`);
  }
}

let engineInstance = null;

export function getEngine() {
  if (!engineInstance) engineInstance = new RadioEngine();
  return engineInstance;
}

export async function startEngine() {
  const engine = getEngine();
  await engine.start();
  return engine;
}

export async function stopEngine() {
  if (engineInstance) {
    await engineInstance.stop();
    engineInstance = null;
  }
}
