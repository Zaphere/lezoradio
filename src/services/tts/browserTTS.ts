import type { ITTSProvider, PlaybackState, VoiceOption } from '../../lib/types';

const VOICE_KEY = 'aarn-selected-voice';
const RATE_KEY = 'aarn-tts-rate';
const VOLUME_KEY = 'aarn-tts-volume';

export class BrowserTTS implements ITTSProvider {
  private synth: SpeechSynthesis | null = null;
  private _rate: number = 1;
  private _volume: number = 1;
  private _voice: VoiceOption | null = null;
  private _state: PlaybackState = 'idle';

  onEnd?: () => void;
  onError?: (err: any) => void;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
    this._rate = parseFloat(localStorage.getItem(RATE_KEY) || '1');
    this._volume = parseFloat(localStorage.getItem(VOLUME_KEY) || '1');
    const saved = localStorage.getItem(VOICE_KEY);
    if (saved) {
      try {
        this._voice = JSON.parse(saved);
      } catch { /* ignore */ }
    }
  }

  speak(text: string): void {
    if (!this.synth) {
      this._state = 'speaking';
      setTimeout(() => {
        this._state = 'idle';
        this.onEnd?.();
      }, text.length * 60);
      return;
    }

    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this._rate;
    utterance.volume = this._volume;
    utterance.pitch = 1;

    if (this._voice) {
      const voices = this.synth.getVoices();
      const match = voices.find((v) => v.voiceURI === this._voice!.voiceURI);
      if (match) utterance.voice = match;
    }

    utterance.onstart = () => {
      this._state = 'speaking';
    };

    utterance.onend = () => {
      this._state = 'idle';
      this.onEnd?.();
    };

    utterance.onerror = (e) => {
      this._state = 'idle';
      this.onError?.(e);
    };

    this.synth.speak(utterance);
  }

  pause(): void {
    this.synth?.pause();
    this._state = 'paused';
  }

  resume(): void {
    this.synth?.resume();
    this._state = 'speaking';
  }

  stop(): void {
    this.synth?.cancel();
    this._state = 'idle';
  }

  setRate(rate: number): void {
    this._rate = rate;
    localStorage.setItem(RATE_KEY, String(rate));
  }

  setVolume(volume: number): void {
    this._volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }

  setVoice(voice: VoiceOption): void {
    this._voice = voice;
    localStorage.setItem(VOICE_KEY, JSON.stringify(voice));
  }

  getVoices(): VoiceOption[] {
    if (!this.synth) return [];
    return this.synth.getVoices().map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      localService: v.localService,
      provider: 'browser' as const,
    }));
  }

  getState(): PlaybackState {
    return this._state;
  }

  get rate(): number {
    return this._rate;
  }

  get volume(): number {
    return this._volume;
  }

  get voice(): VoiceOption | null {
    return this._voice;
  }
}
