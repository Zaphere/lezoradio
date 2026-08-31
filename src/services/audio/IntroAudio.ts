const INTRO_URL = '/api/content/storage?bucket=introaudio&file=LezzoTrafficappIntro.mp3';

/** Speech starts this many seconds before the intro ends (overlap). */
const SPEECH_OVERLAP_SECONDS = 2.5;
/** Minimum intro playback before speech can start. */
const MIN_INTRO_BEFORE_SPEECH = 2;
/** Intro level once speech begins. */
const DUCKED_VOLUME = 0.18;

export class IntroAudio {
  private audio: HTMLAudioElement;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private cueFired = false;
  private masterVolume = 1;
  private playing = false;

  constructor() {
    this.audio = new Audio(INTRO_URL);
    this.audio.preload = 'auto';
    this.audio.volume = this.masterVolume;
  }

  preload(): void {
    this.audio.load();
  }

  /** Start intro immediately; call `onSpeechCue` when speech should overlay. */
  play(onSpeechCue: () => void): void {
    this.stop(false);
    this.cueFired = false;

    const fireCue = () => {
      if (this.cueFired) return;
      this.cueFired = true;
      this.clearTimer();
      this.audio.volume = this.masterVolume * DUCKED_VOLUME;
      onSpeechCue();
    };

    const scheduleCue = () => {
      const duration = this.audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        this.speechTimer = setTimeout(fireCue, 3000);
        return;
      }

      const cueAt = Math.max(MIN_INTRO_BEFORE_SPEECH, duration - SPEECH_OVERLAP_SECONDS);
      const delayMs = Math.max(0, (cueAt - this.audio.currentTime) * 1000);
      this.speechTimer = setTimeout(fireCue, delayMs);
    };

    this.playing = true;
    this.audio.currentTime = 0;
    this.audio.volume = this.masterVolume;

    const startPlayback = () => {
      scheduleCue();
      void this.audio.play().catch(() => fireCue());
    };

    if (this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      this.audio.addEventListener('canplay', startPlayback, { once: true });
      this.audio.load();
    }
  }

  pause(): void {
    if (!this.playing) return;
    this.audio.pause();
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
  }

  resume(onSpeechCue?: () => void): void {
    if (!this.playing) return;
    if (!this.cueFired && onSpeechCue) {
      const duration = this.audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const cueAt = Math.max(MIN_INTRO_BEFORE_SPEECH, duration - SPEECH_OVERLAP_SECONDS);
        const delayMs = Math.max(0, (cueAt - this.audio.currentTime) * 1000);
        this.speechTimer = setTimeout(() => {
          if (this.cueFired) return;
          this.cueFired = true;
          this.audio.volume = this.masterVolume * DUCKED_VOLUME;
          onSpeechCue();
        }, delayMs);
      }
    }
    void this.audio.play().catch(() => undefined);
  }

  stop(fade = true): void {
    this.clearTimer();
    if (!this.playing && this.audio.paused) return;

    const finish = () => {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.volume = this.masterVolume;
      this.playing = false;
      this.cueFired = false;
    };

    if (fade && !this.audio.paused) {
      const startVol = this.audio.volume;
      const steps = 8;
      let step = 0;
      const interval = setInterval(() => {
        step += 1;
        this.audio.volume = startVol * (1 - step / steps);
        if (step >= steps) {
          clearInterval(interval);
          finish();
        }
      }, 40);
    } else {
      finish();
    }
  }

  setVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.playing && this.cueFired) {
      this.audio.volume = volume * DUCKED_VOLUME;
    } else {
      this.audio.volume = volume;
    }
  }

  get isPlaying(): boolean {
    return this.playing && !this.audio.paused;
  }

  get isActive(): boolean {
    return this.playing;
  }

  /** Skip jingle and jump straight to speech cue. */
  skip(onSpeechCue?: () => void): void {
    this.clearTimer();
    if (!this.cueFired) {
      this.cueFired = true;
      onSpeechCue?.();
    }
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = this.masterVolume;
    this.playing = false;
  }

  private clearTimer(): void {
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
  }
}
