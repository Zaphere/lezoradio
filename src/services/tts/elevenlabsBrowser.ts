/**
 * Browser-native ElevenLabs TTS client.
 * Uses fetch() directly — no Node.js SDK dependency.
 * The @elevenlabs/elevenlabs-js package is server-only and must NOT be used in the browser.
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export interface ElevenLabsBrowserOptions {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  rate?: number;
  volume?: number;
}

export class ElevenLabsBrowser {
  private apiKey: string;
  private voiceId: string;
  private options: Required<ElevenLabsBrowserOptions>;
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private _state: 'idle' | 'loading' | 'speaking' | 'paused' = 'idle';

  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onStart?: () => void;

  constructor(apiKey: string, voiceId: string, options: ElevenLabsBrowserOptions = {}) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.options = {
      stability: options.stability ?? 0.35,
      similarityBoost: options.similarityBoost ?? 0.75,
      style: options.style ?? 0.25,
      useSpeakerBoost: options.useSpeakerBoost ?? true,
      rate: options.rate ?? 1.0,
      volume: options.volume ?? 1.0,
    };
  }

  get state() {
    return this._state;
  }

  async speak(text: string): Promise<void> {
    this.stop();
    this._state = 'loading';

    try {
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: DEFAULT_MODEL,
            voice_settings: {
              stability: this.options.stability,
              similarity_boost: this.options.similarityBoost,
              style: this.options.style,
              use_speaker_boost: this.options.useSpeakerBoost,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      audio.volume = this.options.volume;
      audio.playbackRate = this.options.rate;
      this.currentAudio = audio;

      audio.oncanplay = () => {
        if (this._state === 'loading') {
          this._state = 'speaking';
          this.onStart?.();
        }
      };

      audio.onended = () => {
        this._cleanup();
        this._state = 'idle';
        this.onEnd?.();
      };

      audio.onerror = (e) => {
        this._cleanup();
        this._state = 'idle';
        this.onError?.(e);
      };

      await audio.play();
      this._state = 'speaking';
      this.onStart?.();
    } catch (err) {
      this._state = 'idle';
      this.onError?.(err);
    }
  }

  pause(): void {
    if (this.currentAudio && this._state === 'speaking') {
      this.currentAudio.pause();
      this._state = 'paused';
    }
  }

  resume(): void {
    if (this.currentAudio && this._state === 'paused') {
      this.currentAudio.play().catch((e) => this.onError?.(e));
      this._state = 'speaking';
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }
    this._cleanup();
    this._state = 'idle';
  }

  setVolume(volume: number): void {
    this.options.volume = volume;
    if (this.currentAudio) this.currentAudio.volume = volume;
  }

  setRate(rate: number): void {
    this.options.rate = rate;
    if (this.currentAudio) this.currentAudio.playbackRate = rate;
  }

  setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }

  getCurrentTime(): number {
    return this.currentAudio?.currentTime ?? 0;
  }

  getDuration(): number {
    const d = this.currentAudio?.duration;
    return d && Number.isFinite(d) ? d : 0;
  }

  private _cleanup(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }
}
