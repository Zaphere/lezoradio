// backend/engine/radioEngine.js
// Top-level orchestrator — event-driven, coordinates all engine modules.

import { ENGINE_VERSION, SEGMENT_TYPES, DEFAULT_STATE, VOICE_IDS, getCurrentEntertainmentMusicUrl } from './constants.js';
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
  generateStationIdText,
  generateTimeAnnouncement,
} from '../providers/scriptGenerator.js';

class RadioEngine {
  constructor() {
    this.channels = new Map(); // channelId -> channelState
    this.running = false;
    this.refreshInterval = null;
    this.backgroundRotationInterval = null;
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

    // Initialize state for each channel
    for (const ch of channels) {
      const state = playbackController.createChannelState(ch.channel_id, ch.station_id, ch.language || 'fr');
      this.channels.set(ch.channel_id, state);
      console.log(`[${new Date().toISOString()}] [radioEngine] Channel: ${ch.channel_id} (station=${ch.station_id}, lang=${ch.language || 'fr'})`);
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

    // Start background music rotation (every 1 hour)
    this.backgroundRotationInterval = setInterval(() => this.rotateBackgroundMusic(), 1 * 60 * 60 * 1000);

    this.running = true;
    console.log(`[${new Date().toISOString()}] [radioEngine] Engine started with ${channels.length} channels`);

    // Start WebSocket server if HTTP server is available
    if (httpServer) {
      radioWsServer.startRadioWsServer(httpServer, '/ws/radio');
    }

    // Write initial ambient (background music) for each channel so frontend has something to play
    for (const ch of channels) {
      this.writeAmbientSegment(ch.channel_id);
    }

    // Trigger initial bulletins so there's content for the first listener
    for (const ch of channels) {
      this.triggerBulletin({
        channelId: ch.channel_id,
        stationId: ch.station_id,
        label: `${ch.station_name || 'Radio Lezo'} - Initial Bulletin`,
        bulletinId: `initial-${Date.now()}`,
      }).catch(err => {
        console.error(`[${new Date().toISOString()}] [radioEngine] Initial bulletin failed for ${ch.channel_id}:`, err.message);
      });
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
   * Trigger a bulletin for a channel — uses scriptGenerator, not hardcoded text.
   */
  resolveBulletinVoice(stationId, channel, events, bulletinId) {
    const channelLang = channel?.language || 'fr';
    const hasAlerts = events.some(e => e.category === 'alert' || e.category === 'emergency');
    const trafficOnly = events.length > 0 && events.every(
      e => e.category === 'traffic' || e.provider === 'lezotraffic',
    );
    const isScheduledNews = bulletinId
      && !String(bulletinId).startsWith('auto-')
      && !String(bulletinId).startsWith('initial-');

    if (hasAlerts) {
      return {
        language: 'fr',
        voice: languageController.resolveVoice(stationId, 'fr', 'alert')
          || languageController.resolveVoice(stationId, 'fr', 'bulletin')
          || { voice_id: VOICE_IDS.FRENCH_ADAM, language: 'fr', style: 'alert' },
      };
    }

    if (trafficOnly && channelLang === 'sw') {
      return {
        language: 'sw',
        voice: languageController.resolveVoice(stationId, 'sw', 'formal')
          || { voice_id: VOICE_IDS.SWAHILI_FEMALE, language: 'sw', style: 'formal' },
      };
    }

    if (isScheduledNews) {
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

  async triggerBulletin(data) {
    const { channelId, stationId, label, bulletinId } = data;
    console.log(`[${new Date().toISOString()}] [radioEngine] Bulletin triggered for ${channelId}: ${label}`);

    const channel = stationController.getChannel(channelId);
    const stationName = channel?.station_name || 'Radio Lezo';

    // Limit to 3 events per bulletin to avoid exceeding ElevenLabs 5000 character limit
    const events = await queueManager.getUnplayedEvents(channelId, 3);
    const { language, voice } = this.resolveBulletinVoice(stationId, channel, events, bulletinId);

    if (voice) {
      console.log(`[${new Date().toISOString()}] [radioEngine] Bulletin voice: ${voice.voice_id} (${language}) for ${channelId}`);
    }
    console.log(`[${new Date().toISOString()}] [radioEngine] Found ${events.length} unplayed events for ${channelId}`);

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
      console.log(`[${new Date().toISOString()}] [radioEngine] TTS voice resolved: ${voice.voice_id} for ${channelId}/${language}`);
      const ttsResult = await ttsGenerator.getOrGenerate(bulletinText, voice.voice_id, language);

      if (ttsResult) {
        console.log(`[${new Date().toISOString()}] [radioEngine] TTS generated for ${channelId}: ${ttsResult.audioUrl?.substring(0, 80)}`);
        const topEvent = events[0] || {};

        // Estimate duration based on text length (avg 15 chars/sec + 2s buffer)
        const durationSeconds = Math.ceil(bulletinText.length / 15) + 2;
        console.log(`[${new Date().toISOString()}] [radioEngine] Estimated bulletin duration: ${durationSeconds}s (${bulletinText.length} chars)`);

        this.updateCurrentSegment(channelId, {
          segment_type: SEGMENT_TYPES.BULLETIN,
          segment_id: `bulletin-${bulletinId || Date.now()}`,
          audio_url: ttsResult.audioUrl,
          audio_type: 'tts',
          title: label || `${stationName} Bulletin`,
          duration_seconds: durationSeconds,
          language,
          voice_id: voice.voice_id,
          // Source attribution
          provider: topEvent.provider || null,
          city: topEvent.city || null,
          province: topEvent.province || null,
          description: bulletinText.substring(0, 500),
        });

        // Mark events as played PER CHANNEL (do NOT mark global status as 'processed' —
        // that would starve all future bulletins. queue_played_items handles per-channel tracking.)
        for (const event of events) {
          await queueManager.markPlayed(channelId, 'event', event.id);
          // Also mark linked radio_scripts as read
          const { data: linkedScripts } = await supabase
            .from('radio_scripts')
            .select('id')
            .eq('news_item_id', event.id);
          if (linkedScripts && linkedScripts.length > 0) {
            const scriptIds = linkedScripts.map(s => s.id);
            await supabase.from('radio_scripts').update({ is_read: true }).in('id', scriptIds);
          }
        }

        // Clear queue_played_items older than 6 hours so articles can recycle
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('queue_played_items')
          .delete()
          .eq('channel_id', channelId)
          .lt('created_at', sixHoursAgo);

        // Auto-revert to entertainment after bulletin finishes
        setTimeout(() => {
          this.writeEntertainmentSegment(channelId).catch(err =>
            console.error(`[radioEngine] Post-bulletin entertainment failed for ${channelId}:`, err.message)
          );
        }, durationSeconds * 1000);

      } else {
        console.warn(`[${new Date().toISOString()}] [radioEngine] TTS generation failed for ${channelId} — reverting to entertainment to maintain cycle`);
        this.writeEntertainmentSegment(channelId).catch(err =>
          console.error(`[radioEngine] Entertainment fallback failed for ${channelId}:`, err.message)
        );
      }
    } else {
      console.warn(`[${new Date().toISOString()}] [radioEngine] No voice found for ${channelId}/${language} (stationId=${stationId}) — reverting to entertainment`);
      this.writeEntertainmentSegment(channelId).catch(err =>
        console.error(`[radioEngine] Entertainment fallback (no-voice) failed for ${channelId}:`, err.message)
      );
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
        
        // Auto-revert to ambient music after station ID finishes
        setTimeout(() => {
          this.writeAmbientSegment(channelId);
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
        
        // Auto-revert to ambient music after time announcement finishes
        setTimeout(() => {
          this.writeAmbientSegment(channelId);
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
      // Bulletins / Alerts (French): wBXNqKUATyqu0RtYt25i
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
      console.log(`[radioEngine] Auto-seeded ${channelDefs.length} channels`);

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
   * Write an Entertainment segment (music/podcast track from Music bucket) for a channel.
   * Plays on the TRACK layer so controls (play/pause/seek) work.
   * After the entertainment track ends, the next news bulletin is triggered automatically.
   * All async operations are fully guarded — this method NEVER throws.
   */
  async writeEntertainmentSegment(channelId) {
    try {
      const bgUrl = await getCurrentEntertainmentMusicUrl();
      const state = this.channels.get(channelId);
      const channel = stationController.getChannel(channelId);
      const stationName = channel?.name || channel?.station_name || 'Radio Lezo';
      const stationId = state?.stationId || channel?.station_id;

      const trackName = decodeURIComponent(bgUrl.substring(bgUrl.lastIndexOf('/') + 1));
      console.log(`[${new Date().toISOString()}] [radioEngine] Writing Entertainment segment for ${channelId}: ${trackName}`);

      // Entertainment plays for 3 minutes, then we trigger next bulletin
      const entertainmentDurationSeconds = 180;

      this.updateCurrentSegment(channelId, {
        segment_type: SEGMENT_TYPES.TRACK,
        segment_id: `entertainment-${Date.now()}`,
        audio_url: bgUrl,
        audio_type: 'stream',
        title: `${stationName} — ${trackName.replace(/\.[^/.]+$/, '')}`,
        duration_seconds: entertainmentDurationSeconds,
        language: state?.language || 'fr',
        voice_id: null,
        transition_type: 'crossfade',
        description: 'Entertainment & Music',
      });

      // After entertainment finishes, automatically trigger the next bulletin
      setTimeout(() => {
        if (!this.running) return;
        console.log(`[${new Date().toISOString()}] [radioEngine] Entertainment ended for ${channelId}, triggering next bulletin`);
        this.triggerBulletin({
          channelId,
          stationId,
          label: `${stationName} — News Update`,
          bulletinId: `auto-${Date.now()}`,
        }).catch(err => {
          console.error(`[radioEngine] Auto-bulletin failed for ${channelId}:`, err.message);
          this.writeEntertainmentSegment(channelId).catch(e =>
            console.error(`[radioEngine] Fallback entertainment also failed for ${channelId}:`, e.message)
          );
        });
      }, entertainmentDurationSeconds * 1000);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [radioEngine] writeEntertainmentSegment failed for ${channelId}:`, err.message);
    }
  }

  /**
   * Legacy alias — all callers of writeAmbientSegment now route to writeEntertainmentSegment.
   */
  writeAmbientSegment(channelId) {
    return this.writeEntertainmentSegment(channelId).catch(err =>
      console.error(`[radioEngine] writeAmbientSegment failed for ${channelId}:`, err.message)
    );
  }

  /**
   * Rotate entertainment music across all channels.
   */
  rotateBackgroundMusic() {
    if (!this.running) return;
    console.log(`[${new Date().toISOString()}] [radioEngine] Rotating entertainment music for ${this.channels.size} channels`);
    for (const channelId of this.channels.keys()) {
      this.writeEntertainmentSegment(channelId);
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
