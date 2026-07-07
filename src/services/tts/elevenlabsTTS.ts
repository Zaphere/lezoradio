import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { ITTSProvider, PlaybackState, VoiceOption } from '../../lib/types';

const CACHE_MAX_ENTRIES = 8;
const CACHE_MAX_CHARS = 300;

interface CacheEntry {
  blob: Blob;
  url: string;
  size: number;
}

export class ElevenLabsTTS implements ITTSProvider {
  private client: ElevenLabsClient;
  private _voiceId: string;
  private _lang = 'fr';
  private _modelId = 'eleven_multilingual_v2';
  private _rate = 1;
  private _volume = 1;
  private _state: PlaybackState = 'idle';
  private _cachedVoices: VoiceOption[] = [];
  private _voicesPromise: Promise<void> | null = null;
  private _lastText = '';

  private currentAudio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheQueue: string[] = [];

  onEnd?: () => void;
  onError?: (err: unknown) => void;

  constructor(apiKey: string, voiceId: string) {
    this.client = new ElevenLabsClient({ apiKey });
    this._voiceId = voiceId;
  }

  private cacheKey(text: string): string {
    return `${this._voiceId}:${text}`;
  }

  private addToCache(text: string, blob: Blob, url: string): void {
    if (text.length > CACHE_MAX_CHARS) return;
    const key = this.cacheKey(text);
    if (this.cache.has(key)) return;

    while (this.cacheQueue.length >= CACHE_MAX_ENTRIES) {
      const oldest = this.cacheQueue.shift();
      if (oldest) {
        const entry = this.cache.get(oldest);
        if (entry) {
          URL.revokeObjectURL(entry.url);
          this.cache.delete(oldest);
        }
      }
    }

    this.cache.set(key, { blob, url, size: text.length });
    this.cacheQueue.push(key);
  }

  private getFromCache(text: string): string | null {
    const key = this.cacheKey(text);
    const entry = this.cache.get(key);
    if (!entry) return null;
    const audio = new Audio(entry.url);
    audio.volume = this._volume;
    audio.playbackRate = this._rate;
    this.currentAudio = audio;
    this.currentUrl = entry.url;
    audio.onended = () => {
      this.currentAudio = null;
      this._state = 'idle';
      this.onEnd?.();
    };
    audio.onerror = () => {
      this.currentAudio = null;
      this._state = 'idle';
      this.onError?.(new Error('Cached audio playback failed'));
    };
    void audio.play();
    return entry.url;
  }

  private wrapInSSML(text: string): string {
    if (text.startsWith('<speak>')) return text;
    const withPauses = text
      .replace(/\.( |$)/g, '.<break time="350ms"/>$1')
      .replace(/\!( |$)/g, '!<break time="450ms"/>$1')
      .replace(/\?( |$)/g, '?<break time="450ms"/>$1');
    return `<speak>${withPauses}</speak>`;
  }

  speak(text: string): void {
    this.stop();
    this._state = 'speaking';

    const cached = this.getFromCache(text);
    if (cached) return;

    const ssmlText = this.wrapInSSML(text);

    this.client.textToSpeech
      .convert(this._voiceId, {
        text: ssmlText,
        modelId: this._modelId,
        outputFormat: 'mp3_44100_128',
        languageCode: this._lang,
        previousText: this._lastText || undefined,
        voiceSettings: {
          stability: 0.35,
          similarityBoost: 0.75,
          style: 0.25,
          useSpeakerBoost: true,
        },
      })
      .then(async (stream) => {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value as unknown as Uint8Array);
        }

        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        this.currentUrl = url;

        this.addToCache(text, blob, url);

        const audio = new Audio(url);
        audio.volume = this._volume;
        audio.playbackRate = this._rate;

        audio.onended = () => {
          this.cleanup(url);
          this._state = 'idle';
          this.onEnd?.();
        };

        audio.onerror = () => {
          this.cleanup(url);
          this._state = 'idle';
          this.onError?.(new Error('Audio playback failed'));
        };

        this.currentAudio = audio;
        await audio.play();
      })
      .catch((err) => {
        this._state = 'idle';
        this.onError?.(err);
      });
  }

  setLastText(text: string): void {
    this._lastText = text;
  }

  pause(): void {
    if (this.currentAudio && this._state === 'speaking') {
      this.currentAudio.pause();
      this._state = 'paused';
    }
  }

  resume(): void {
    if (this.currentAudio && this._state === 'paused') {
      this.currentAudio.play().catch(() => {});
      this._state = 'speaking';
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentUrl && !this.isUrlCached(this.currentUrl)) {
      URL.revokeObjectURL(this.currentUrl);
    }
    this.currentUrl = null;
    this._state = 'idle';
  }

  private isUrlCached(url: string): boolean {
    for (const entry of this.cache.values()) {
      if (entry.url === url) return true;
    }
    return false;
  }

  clearCache(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.cacheQueue = [];
  }

  setRate(rate: number): void {
    this._rate = rate;
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
    }
  }

  setVolume(volume: number): void {
    this._volume = volume;
    if (this.currentAudio) {
      this.currentAudio.volume = volume;
    }
  }

  setVoice(voice: VoiceOption): void {
    this._voiceId = voice.providerVoiceId || voice.voiceURI || this._voiceId;
    if (voice.lang) {
      this._lang = voice.lang;
    }
  }

  getVoices(): VoiceOption[] {
    if (this._cachedVoices.length === 0 && !this._voicesPromise) {
      this._voicesPromise = this.client.voices
        .getAll()
        .then((resp) => {
          this._cachedVoices = resp.voices.map((v) => ({
            name: v.name || v.voiceId,
            lang: v.verifiedLanguages?.[0]?.locale || v.verifiedLanguages?.[0]?.language || 'en',
            voiceURI: v.voiceId,
            localService: false,
            provider: 'elevenlabs' as const,
            providerVoiceId: v.voiceId,
          }));
        })
        .catch(() => {
          this._cachedVoices = [];
        });
    }
    return this._cachedVoices;
  }

  getState(): PlaybackState {
    return this._state;
  }

  getCurrentTime(): number {
    return this.currentAudio?.currentTime ?? 0;
  }

  getDuration(): number {
    if (this.currentAudio && Number.isFinite(this.currentAudio.duration)) {
      return this.currentAudio.duration;
    }
    return 0;
  }

  seek(time: number): void {
    if (this.currentAudio) {
      this.currentAudio.currentTime = time;
    }
  }

  private cleanup(url: string): void {
    this.currentAudio = null;
    if (!this.isUrlCached(url)) {
      URL.revokeObjectURL(url);
    }
    this.currentUrl = null;
  }
}
