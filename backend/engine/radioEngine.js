// backend/engine/radioEngine.js
// Top-level orchestrator — event-driven, coordinates all engine modules.

import { ENGINE_VERSION, SEGMENT_TYPES, DEFAULT_STATE, VOICE_IDS } from './constants.js';
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
import { supabase } from '../supabaseClient.js';
import {
  generateEventScript,
  generateBulletinIntro,
  generateBulletinApology,
  generateTrafficIntro,
  generateNewsIntro,
  generateWeatherIntro,
  generateMusicIntro,
  generateMusicOutro,
  generateStationIdText,
  generateTimeAnnouncement,
} from '../providers/scriptGenerator.js';

class RadioEngine {
  constructor() {
    this.channels = new Map(); // channelId -> channelState
    this.running = false;
    this.refreshInterval = null;
    this.backgroundRotationInterval = null;
    this.pendingTimers = new Map(); // channelId -> setTimeout handle
    this._pendingTrack = null; // { channelId, track } — track announced via intro, pending playback
    this._recentlyPlayed = new Map(); // channelId -> Map<eventId, timestamp> — in-memory dedup safety net
    this._consecutiveContent = new Map(); // channelId -> count — forces music after 2 consecutive content segments
  }

  /**
   * Start the radio engine.
   * @param {import('http').Server} httpServer - Optional HTTP server for WebSocket attachment
   */
  async start(httpServer) {
    console.log(`[${new Date().toISOString()}] [radioEngine] Starting Radio Engine v${ENGINE_VERSION}`);

    // Load all configuration from DB
    await Promise.all([
      stationController.refreshCache(),
      contentNormalizer.refreshCache(),
      audioManager.loadAudioConfig(),
      languageController.loadVoices(),
    ]);

    let channels = stationController.getAllChannels();
    console.log(`[${new Date().toISOString()}] [radioEngine] Loaded ${channels.length} channels: ${channels.map(c => c.channel_id).join(', ')}`);
    if (channels.length === 0) {
      console.log(`[${new Date().toISOString()}] [radioEngine] No channels in station_channels — attempting auto-seed...`);
      const seeded = await this.autoSeedChannels();
      if (!seeded) {
        console.warn(`[radioEngine] Auto-seed failed. Engine idle.`);
        return;
      }
      // Reload caches after seeding
      await Promise.all([
        stationController.refreshCache(),
        languageController.loadVoices(),
      ]);
      channels = stationController.getAllChannels();
      if (channels.length === 0) {
        console.warn(`[radioEngine] Still no channels after auto-seed. Engine idle.`);
        return;
      }
      console.log(`[${new Date().toISOString()}] [radioEngine] Auto-seeded ${channels.length} channels: ${channels.map(c => c.channel_id).join(', ')}`);
    }

    // Ensure voices exist for all channels — seed if missing
    await this.ensureVoices(channels);

    // Ensure global-main channel exists (for frequency-dial/global frontend channels)
    await this.ensureGlobalMainChannel(channels);

    // Re-read channels in case we added global-main
    await stationController.refreshCache();
    channels = stationController.getAllChannels();

    // Initialize state for each channel
    for (const ch of channels) {
      const state = playbackController.createChannelState(ch.channel_id, ch.station_id, ch.language || 'fr');
      this.channels.set(ch.channel_id, state);
      console.log(`[${new Date().toISOString()}] [radioEngine] Channel: ${ch.channel_id} (station=${ch.station_id}, lang=${ch.language || 'fr'})`);
    }

    // Start event listener
    eventListener.startEventListener((event) => this.onNewContent(event));

    // Start scheduler — uses refreshed channels (includes global-main if now created)
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

    // Start background music rotation (every 1 hour)
    this.backgroundRotationInterval = setInterval(() => this.rotateBackgroundMusic(), 1 * 60 * 60 * 1000);

    this.running = true;
    console.log(`[${new Date().toISOString()}] [radioEngine] Engine started with ${channels.length} channels`);

    // Start WebSocket server if HTTP server is available
    if (httpServer) {
      radioWsServer.startRadioWsServer(httpServer, '/ws/radio');
    }

    // Write initial background music for each channel in parallel
    await Promise.all(channels.map(ch =>
      this.writeBackgroundSegment(ch.channel_id).catch(err =>
        console.error(`[radioEngine] Initial background failed for ${ch.channel_id}:`, err.message)
      )
    ));

    // Dispatch first content via priority chain for each channel
    for (const ch of channels) {
      setImmediate(() => {
        this.dispatchNextContent(ch.channel_id).catch(err => {
          console.error(`[${new Date().toISOString()}] [radioEngine] Initial dispatch failed for ${ch.channel_id}:`, err.message);
        });
      });
    }
  }

  /**
   * Check if an event was recently played (in-memory safety net).
   */
  _wasRecentlyPlayed(channelId, eventId) {
    const channelSet = this._recentlyPlayed.get(channelId);
    if (!channelSet) return false;
    return channelSet.has(eventId);
  }

  /**
   * Mark an event as recently played (in-memory, 30-minute TTL).
   */
  _markRecentlyPlayed(channelId, eventId) {
    if (!this._recentlyPlayed.has(channelId)) {
      this._recentlyPlayed.set(channelId, new Map());
    }
    this._recentlyPlayed.get(channelId).set(eventId, Date.now());
  }

  /**
   * Prune recently played entries older than 30 minutes.
   */
  _pruneRecentlyPlayed() {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [, channelMap] of this._recentlyPlayed) {
      for (const [eventId, ts] of channelMap) {
        if (ts < cutoff) channelMap.delete(eventId);
      }
    }
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
   * Resolve voice for a content segment.
   */
  resolveVoice(stationId, channel, contentType, language) {
    const channelLang = channel?.language || language || 'fr';

    if (contentType === 'traffic') {
      const lang = (channelLang === 'sw' || channelLang === 'ln') ? channelLang : 'fr';
      return {
        language: lang,
        voice: languageController.resolveVoice(stationId, lang, 'formal')
          || { voice_id: VOICE_IDS.SWAHILI_FEMALE, language: lang, style: 'formal' },
      };
    }

    if (contentType === 'alert' || contentType === 'bulletin') {
      return {
        language: 'fr',
        voice: languageController.resolveVoice(stationId, 'fr', 'bulletin')
          || { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', style: 'bulletin' },
      };
    }

    let voice = languageController.resolveVoice(stationId, channelLang, 'formal');
    if (!voice && channel?.primary_voice_id) {
      voice = { voice_id: channel.primary_voice_id, language: channelLang, style: 'formal' };
    }
    return { language: channelLang, voice };
  }

  /**
   * Write a background music segment (ambient type).
   * Plays on the background layer — ducked when foreground TTS plays.
   * After the track finishes, dispatches next content via priority chain.
   * @param {object} [next] - Optional pre-selected track (used after a matching intro was played)
   */
  async writeBackgroundSegment(channelId, next) {
    try {
      if (!next) {
        // Check for a pending track from a previously-announced intro
        const pendingKey = `${channelId}`;
        if (this._pendingTrack && this._pendingTrack.channelId === channelId) {
          next = this._pendingTrack.track;
          this._pendingTrack = null;
        }
      }
      if (!next) {
        next = await queueManager.getNextBackgroundTrack(channelId);
      }
      if (!next) {
        console.warn(`[radioEngine] No background tracks available for ${channelId}`);
        return;
      }

      const state = this.channels.get(channelId);
      const channel = stationController.getChannel(channelId);
      const stationName = channel?.name || channel?.station_name || 'Radio Lezo';

      const rawUrl = next.audio_url || '';
      const trackName = next.title || decodeURIComponent(rawUrl.split('?')[0].substring(rawUrl.split('?')[0].lastIndexOf('/') + 1)).replace(/\.[^/.]+$/, '');
      const durationSeconds = next.duration_seconds || 180;

      console.log(`[${new Date().toISOString()}] [radioEngine] Background segment for ${channelId}: ${trackName} (${durationSeconds}s)`);

      this.updateCurrentSegment(channelId, {
        segment_type: SEGMENT_TYPES.AMBIENT,
        segment_id: `bg-${Date.now()}`,
        audio_url: next.audio_url,
        audio_type: 'stream',
        title: `${stationName} — ${trackName}`,
        duration_seconds: durationSeconds,
        language: state?.language || 'fr',
        voice_id: null,
        transition_type: 'crossfade',
        description: 'Background Music',
      });

      // After background track finishes, dispatch next content via priority chain
      this.scheduleNextContent(channelId, durationSeconds * 1000);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [radioEngine] writeBackgroundSegment failed for ${channelId}:`, err.message);
    }
  }

  /**
   * Schedule the next content dispatch after a delay.
   * Cancels any existing pending timer for the same channel.
   * The resulting dispatch is NOT marked as an interrupt (natural end-of-segment).
   */
  scheduleNextContent(channelId, delayMs) {
    const existing = this.pendingTimers.get(channelId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pendingTimers.delete(channelId);
      if (!this.running) return;
      this.dispatchNextContent(channelId, false).catch(err =>
        console.error(`[radioEngine] dispatchNextContent failed for ${channelId}:`, err.message)
      );
    }, delayMs);
    this.pendingTimers.set(channelId, timer);
  }

  /**
   * Dispatch next content via priority chain.
   * Called after a segment ends (background track or foreground TTS).
   *
   * @param {string} channelId
   * @param {boolean} [isInterrupt=false] - true when a cron-scheduled bulletin fired mid-track
   *
   * Priority:
   *   1. Traffic events (LezoTraffic)
   *   2. News events
   *   3. Weather events
   *   4. Next background music track
   */
  async dispatchNextContent(channelId, isInterrupt = false) {
    if (!this.running) return;

    try {
      await this._dispatchNextContentInner(channelId, isInterrupt);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [radioEngine] dispatchNextContent FAILED for ${channelId}:`, err.message);
      // GUARANTEED FALLBACK: never go silent — write background music directly
      try {
        const { getCurrentEntertainmentMusicUrl } = await import('./constants.js');
        const url = await getCurrentEntertainmentMusicUrl();
        const state = this.channels.get(channelId);
        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.AMBIENT,
          segment_id: `fallback-${Date.now()}`,
          audio_url: url,
          audio_type: 'stream',
          title: `Radio Lezo — Fallback`,
          duration_seconds: 180,
          language: state?.language || 'fr',
          voice_id: null,
          transition_type: 'crossfade',
          description: 'Fallback Music',
        });
        this.scheduleNextContent(channelId, 180 * 1000);
      } catch (fallbackErr) {
        console.error(`[${new Date().toISOString()}] [radioEngine] Even fallback failed for ${channelId}:`, fallbackErr.message);
        // Last resort: retry in 30 seconds
        this.scheduleNextContent(channelId, 30 * 1000);
      }
    }
  }

  async _dispatchNextContentInner(channelId, isInterrupt = false) {
    const state = this.channels.get(channelId);
    const channel = stationController.getChannel(channelId);
    if (!state || !channel) return;

    const language = channel.language || state.language || 'fr';
    const stationId = state.stationId || channel.station_id;
    const stationName = channel.name || channel.station_name || 'Radio Lezo';

    // If a music intro just played and the actual track is pending, play it now
    if (!isInterrupt && this._pendingTrack && this._pendingTrack.channelId === channelId) {
      const pending = this._pendingTrack;
      this._pendingTrack = null;
      await this.writeBackgroundSegment(channelId, pending.track);
      return;
    }

    // Build in-memory dedup set for this channel
    this._pruneRecentlyPlayed();
    const excludeIds = this._recentlyPlayed.get(channelId)
      ? new Set(this._recentlyPlayed.get(channelId).keys())
      : new Set();

    // Force music after 2 consecutive content segments (prevents queue starvation)
    const consecCount = this._consecutiveContent.get(channelId) || 0;
    const forceMusic = consecCount >= 2;
    if (forceMusic) {
      console.log(`[radioEngine] ${channelId}: forcing music after ${consecCount} consecutive content segments`);
    }

    const nextContent = await queueManager.getNextContent(channelId, language, 3, excludeIds, forceMusic);

    if (!nextContent || nextContent.type === 'music') {
      // Reset consecutive content counter
      this._consecutiveContent.set(channelId, 0);

      // No priority content — play next background music track

      // Play outro for the track that just finished (if it was a background track)
      const finishedSegment = state.currentSegment;
      if (finishedSegment?.segment_type === SEGMENT_TYPES.AMBIENT && finishedSegment.title) {
        const title = finishedSegment.title;
        const cleanName = title.includes('—') ? title.split('—')[1].trim() : title.replace(`${stationName} — `, '');
        const outroText = generateMusicOutro(language, cleanName, stationName);
        const outroVoice = this.resolveVoice(stationId, channel, 'bulletin', language);
        if (outroVoice.voice && outroText) {
          const ttsResult = await ttsGenerator.getOrGenerate(outroText, outroVoice.voice.voice_id, language);
          if (ttsResult) {
            const outroDuration = Math.ceil(outroText.length / 15) + 1;
            this.updateCurrentSegment(channelId, {
              segment_type: SEGMENT_TYPES.ANNOUNCEMENT,
              segment_id: `music-outro-${Date.now()}`,
              audio_url: ttsResult.audioUrl,
              audio_type: 'tts',
              title: `${stationName} — Outro`,
              duration_seconds: outroDuration,
              language,
              voice_id: outroVoice.voice.voice_id,
              transition_type: 'crossfade',
              description: `That was: ${cleanName}`,
            });
            this.scheduleNextContent(channelId, outroDuration * 1000);
            return;
          }
        }
      }

      if (nextContent?.musicTrack) {
        // Generate intro announcement for the track
        const track = nextContent.musicTrack;
        const trackName = track.title || 'Music';
        const introText = generateMusicIntro(language, trackName, stationName);
        const voice = this.resolveVoice(stationId, channel, 'bulletin', language);

        if (voice.voice) {
          const ttsResult = await ttsGenerator.getOrGenerate(introText, voice.voice.voice_id, language);
          if (ttsResult) {
            const introDuration = Math.ceil(introText.length / 15) + 1;
            this.updateCurrentSegment(channelId, {
              segment_type: SEGMENT_TYPES.ANNOUNCEMENT,
              segment_id: `music-intro-${Date.now()}`,
              audio_url: ttsResult.audioUrl,
              audio_type: 'tts',
              title: `${stationName} — ${trackName}`,
              duration_seconds: introDuration,
              language,
              voice_id: voice.voice.voice_id,
              transition_type: 'duck',
              description: `Up next: ${trackName}`,
            });
            // After intro, play the EXACT track that was announced
            this.scheduleNextContent(channelId, introDuration * 1000);
            this._pendingTrack = { channelId, track };
            return;
          }
        }

        // Fall through if intro TTS fails
        this.writeBackgroundSegment(channelId);
      } else {
        this.writeBackgroundSegment(channelId);
      }
      return;
    }

    // Priority content: traffic, news, or weather
    const events = nextContent.events || [];
    if (events.length === 0) {
      this.writeBackgroundSegment(channelId);
      return;
    }

    // Determine transition type and voice
    const contentType = nextContent.type;
    const voice = this.resolveVoice(stationId, channel, contentType, language);

    if (!voice.voice) {
      console.warn(`[radioEngine] No voice for ${contentType} on ${channelId}`);
      this.writeBackgroundSegment(channelId);
      return;
    }

    // Generate apology ONLY if this was a scheduled bulletin interrupting a playing track
    let apologeticPrefix = '';
    if (isInterrupt) {
      apologeticPrefix = generateBulletinApology(voice.language, stationName) + ' ';
    }

    // Generate content intro
    let contentIntro;
    switch (contentType) {
      case 'traffic':
        contentIntro = generateTrafficIntro(voice.language, stationName);
        break;
      case 'news':
        contentIntro = generateNewsIntro(voice.language, stationName);
        break;
      case 'weather':
        contentIntro = generateWeatherIntro(voice.language, stationName);
        break;
      default:
        contentIntro = generateBulletinIntro(voice.language, stationName, events.length);
    }

    // Generate event scripts
    const eventScripts = events.map(e => generateEventScript(e, voice.language));
    const contentText = `${contentIntro} ${eventScripts.join('. ')}`;
    const fullText = `${apologeticPrefix}${contentText}`;

    console.log(`[${new Date().toISOString()}] [radioEngine] Generating ${contentType} TTS for ${channelId} (${fullText.length} chars)`);

    const ttsResult = await ttsGenerator.getOrGenerate(fullText, voice.voice.voice_id, voice.language);
    if (!ttsResult) {
      console.warn(`[${new Date().toISOString()}] [radioEngine] TTS generation failed for ${contentType} on ${channelId} — playing background`);
      this.writeBackgroundSegment(channelId);
      return;
    }

    const durationSeconds = Math.ceil(fullText.length / 15) + 2;
    const topEvent = events[0] || {};

    this.updateCurrentSegment(channelId, {
      segment_type: contentType === 'traffic' ? SEGMENT_TYPES.BULLETIN : SEGMENT_TYPES.BULLETIN,
      segment_id: `${contentType}-${Date.now()}`,
      audio_url: ttsResult.audioUrl,
      audio_type: 'tts',
      title: `${stationName} — ${contentType === 'traffic' ? 'Traffic Update' : contentType === 'weather' ? 'Weather' : 'News Update'}`,
      duration_seconds: durationSeconds,
      language: voice.language,
      voice_id: voice.voice.voice_id,
      transition_type: 'duck',
      duck_volume: 0.06,
      provider: topEvent.provider || null,
      city: topEvent.city || null,
      province: topEvent.province || null,
      description: fullText.substring(0, 500),
    });

    // Track consecutive content segments (reset to 0 when music plays)
    this._consecutiveContent.set(channelId, (this._consecutiveContent.get(channelId) || 0) + 1);

    // Mark events as played
    for (const event of events) {
      await queueManager.markPlayed(channelId, 'event', event.id, stationId);
      this._markRecentlyPlayed(channelId, event.id);
      const { data: linkedScripts } = await supabase
        .from('radio_scripts')
        .select('id')
        .eq('news_item_id', event.id);
      if (linkedScripts && linkedScripts.length > 0) {
        await supabase.from('radio_scripts').update({ is_read: true }).in('id', linkedScripts.map(s => s.id));
      }
    }

    // Clean old played items
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    await supabase.from('queue_played_items').delete().eq('channel_id', channelId).lt('created_at', sixHoursAgo);

    // After TTS finishes, dispatch next content
    this.scheduleNextContent(channelId, durationSeconds * 1000);
  }

  /**
   * Trigger a bulletin (called by scheduler). Delegates to dispatchNextContent as an interrupt.
   * Cancels any pending natural-end timer so both don't fire for the same channel.
   */
  async triggerBulletin(data) {
    const { channelId } = data;
    console.log(`[${new Date().toISOString()}] [radioEngine] Bulletin triggered for ${channelId}: ${data.label}`);

    const existing = this.pendingTimers.get(channelId);
    if (existing) {
      clearTimeout(existing);
      this.pendingTimers.delete(channelId);
    }

    await this.dispatchNextContent(channelId, true);
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
        const durationSeconds = 5;
        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.JINGLE,
          segment_id: `station-id-${Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: `Station ID - ${stationName}`,
          duration_seconds: durationSeconds,
          language,
          voice_id: voice.voice_id,
        });
        
        // Resume background music after station ID finishes
        setTimeout(() => {
          this.writeBackgroundSegment(channelId);
        }, durationSeconds * 1000);
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
        const durationSeconds = 8;
        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.ANNOUNCEMENT,
          segment_id: `time-${Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: `Time: ${hour}:${String(minute).padStart(2, '0')}`,
          duration_seconds: durationSeconds,
          language,
          voice_id: voice.voice_id,
        });
        
        // Resume background music after time announcement finishes
        setTimeout(() => {
          this.writeBackgroundSegment(channelId);
        }, durationSeconds * 1000);
      }
    }
  }

  /**
   * Auto-seed station_channels and station_voices for DR Congo on first run.
   * Returns true if seeding succeeded.
   */
  async autoSeedChannels() {
    try {
      // Find DR Congo station — try multiple strategies
      let station = null;
      const queries = [
        supabase.from('stations').select('id, name').eq('country_code', 'CD').limit(1),
        supabase.from('stations').select('id, name').ilike('name', '%congo%').limit(1),
        supabase.from('stations').select('id, name').limit(1),
      ];
      for (const q of queries) {
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          station = data[0];
          break;
        }
      }
      if (!station) {
        console.error(`[radioEngine] Auto-seed: No station found in stations table`);
        return false;
      }
      console.log(`[radioEngine] Auto-seed: Found station ${station.name} (${station.id})`);

      // Seed voices per DRC station/region & bulletin requirements:
      // Kinshasa (Lingala): uTB2ynnsQgtJDou6IulW
      // Goma / Lubumbashi (Swahili): 2tSJpap7gXlgDV2bauu0
      // Bulletins / Alerts (French): 3IyGWZwOTNraZr1Tz0fI
      const voices = [
        { voice_id: VOICE_IDS.KINSHASA_LINGALA, language: 'ln', gender: 'male', style: 'formal', is_primary: true },
        { voice_id: VOICE_IDS.SWAHILI_FEMALE, language: 'sw', gender: 'female', style: 'formal', is_primary: true },
        { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', gender: 'male', style: 'bulletin', is_primary: true },
        { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', gender: 'male', style: 'alert', is_primary: true },
      ];
      for (const v of voices) {
        await supabase.from('station_voices').upsert({
          station_id: station.id,
          voice_id: v.voice_id,
          language: v.language,
          gender: v.gender,
          style: v.style,
          is_primary: v.is_primary,
        }, { onConflict: 'station_id,language,voice_id' });
      }
      console.log(`[radioEngine] Auto-seeded ${voices.length} voices`);

      // Seed channels
      const channelDefs = [
        { channel_id: 'kinshasa-main', name: 'Kinshasa Main', lang: 'ln', freq: 88.1, emoji: '🇨🇩', desc: 'Primary Kinshasa broadcast channel in Lingala' },
        { channel_id: 'goma-main', name: 'Goma Main', lang: 'sw', freq: 92.5, emoji: '🌋', desc: 'Primary Goma broadcast channel in Swahili' },
        { channel_id: 'lubumbashi-main', name: 'Lubumbashi Main', lang: 'sw', freq: 95.3, emoji: '⛏️', desc: 'Primary Lubumbashi broadcast channel in Swahili' },
        { channel_id: 'global-main', name: 'Global Main', lang: 'fr', freq: 94.1, emoji: '🌍', desc: 'Global news and entertainment channel' },
      ];
      const voiceMap = {};
      for (const v of voices) voiceMap[v.language] = v.voice_id;

      for (const ch of channelDefs) {
        await supabase.from('station_channels').upsert({
          station_id: station.id,
          channel_id: ch.channel_id,
          name: ch.name,
          description: ch.desc,
          frequency: ch.freq,
          emoji: ch.emoji,
          language: ch.lang,
          primary_voice_id: voiceMap[ch.lang] || null,
          is_active: true,
          priority: 1,
        }, { onConflict: 'channel_id' });
      }
      console.log(`[radioEngine] Auto-seeded ${channelDefs.length} channels (including global-main)`);

      // Clean stale UUID-based radio_station_state rows
      const { data: staleRows } = await supabase.from('radio_station_state').select('channel_id');
      const validIds = new Set(channelDefs.map(c => c.channel_id));
      const staleIds = (staleRows || []).filter(r => !validIds.has(r.channel_id)).map(r => r.channel_id);
      if (staleIds.length > 0) {
        for (let i = 0; i < staleIds.length; i += 50) {
          const batch = staleIds.slice(i, i + 50);
          await supabase.from('radio_station_state').delete().in('channel_id', batch);
        }
        console.log(`[radioEngine] Auto-seed: cleaned ${staleIds.length} stale state rows`);
      }

      return true;
    } catch (err) {
      console.error(`[radioEngine] Auto-seed failed:`, err.message);
      return false;
    }
  }

  /**
   * Ensure voices exist for all channels. Seeds them if missing.
   */
  async ensureVoices(channels) {
    const voiceDefs = [
      { voice_id: VOICE_IDS.KINSHASA_LINGALA, language: 'ln', gender: 'male', style: 'formal', is_primary: true },
      { voice_id: VOICE_IDS.SWAHILI_FEMALE, language: 'sw', gender: 'female', style: 'formal', is_primary: true },
      { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', gender: 'male', style: 'bulletin', is_primary: true },
      { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', gender: 'male', style: 'alert', is_primary: true },
    ];

    // Check if any voice exists for any channel's station
    const stationIds = [...new Set(channels.map(c => c.station_id))];
    for (const stationId of stationIds) {
      const { data: existing } = await supabase
        .from('station_voices')
        .select('id')
        .eq('station_id', stationId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[${new Date().toISOString()}] [radioEngine] Voices already exist for station ${stationId}`);
        continue;
      }

      // Seed voices for this station
      console.log(`[${new Date().toISOString()}] [radioEngine] Seeding voices for station ${stationId}`);
      for (const v of voiceDefs) {
        await supabase.from('station_voices').upsert({
          station_id: stationId,
          voice_id: v.voice_id,
          language: v.language,
          gender: v.gender,
          style: v.style,
          is_primary: v.is_primary,
        }, { onConflict: 'station_id,language,voice_id' });
      }
    }

    // Always reload voice cache after ensuring voices
    await languageController.loadVoices();
    console.log(`[${new Date().toISOString()}] [radioEngine] Voice cache reloaded (${languageController.getVoiceCacheSize?.() || 'unknown'} entries)`);
  }

  /**
   * Ensure the global-main channel exists in station_channels.
   * Creates it under the first available station if missing.
   */
  async ensureGlobalMainChannel(channels) {
    const hasGlobalMain = channels.some(c => c.channel_id === 'global-main');
    if (hasGlobalMain) return;

    console.log(`[${new Date().toISOString()}] [radioEngine] global-main channel missing — creating...`);
    const stationIds = [...new Set(channels.map(c => c.station_id))];
    if (stationIds.length === 0) return;

    const stationId = stationIds[0];
    const { error } = await supabase.from('station_channels').upsert({
      station_id: stationId,
      channel_id: 'global-main',
      name: 'Global Main',
      description: 'Global news and entertainment channel',
      frequency: 94.1,
      emoji: '🌍',
      language: 'fr',
      primary_voice_id: VOICE_IDS.FRENCH_ADAM,
      is_active: true,
      priority: 1,
    }, { onConflict: 'channel_id' });

    if (error) {
      console.error(`[radioEngine] Failed to create global-main channel:`, error.message);
    } else {
      console.log(`[${new Date().toISOString()}] [radioEngine] Created global-main channel under station ${stationId}`);
    }
  }

  /**
   * Refresh background music for all channels — dispatches next content via priority chain.
   * Used by the periodic rotation interval.
   */
  rotateBackgroundMusic() {
    if (!this.running) return;
    console.log(`[${new Date().toISOString()}] [radioEngine] Rotating background music for ${this.channels.size} channels`);
    for (const channelId of this.channels.keys()) {
      this.dispatchNextContent(channelId).catch(err =>
        console.error(`[radioEngine] rotateBackgroundMusic failed for ${channelId}:`, err.message)
      );
    }
  }

  /**
   * Update the current segment for a channel.
   */
  async updateCurrentSegment(channelId, segmentData) {
    const state = this.channels.get(channelId);
    if (!state) {
      console.warn(`[${new Date().toISOString()}] [radioEngine] updateCurrentSegment: no state for ${channelId}`);
      return;
    }

    state.nextSegment = { ...state.currentSegment };
    state.currentSegment = { ...DEFAULT_STATE, ...segmentData };
    state.startedAt = new Date().toISOString();
    state.version += 1;

    console.log(`[${new Date().toISOString()}] [radioEngine] Writing state for ${channelId}: type=${segmentData.segment_type}, title=${segmentData.title?.substring(0, 60)}`);
    await playbackController.updateState(channelId, state);
    await playbackController.logPlayback(channelId, state.currentSegment, state.stationId);
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
      this._pruneRecentlyPlayed();
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
    if (this.backgroundRotationInterval) clearInterval(this.backgroundRotationInterval);
    console.log(`[${new Date().toISOString()}] [radioEngine] Engine stopped`);
  }
}

let engineInstance = null;

export function getEngine() {
  if (!engineInstance) engineInstance = new RadioEngine();
  return engineInstance;
}

export async function startEngine(httpServer) {
  const engine = getEngine();
  await engine.start(httpServer);
  return engine;
}

export async function stopEngine() {
  if (engineInstance) {
    await engineInstance.stop();
    engineInstance = null;
  }
}
