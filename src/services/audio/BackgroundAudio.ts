const BG_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/introaudio/backgroundmusic.mp3`;

const DEFAULT_VOLUME = 0.12;
const FADE_MS = 900;

export class BackgroundAudio {
  private audio: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.audio = new Audio(BG_URL);
    this.audio.loop = true;
    this.audio.volume = 0;
    this.audio.preload = 'auto';

    const seekAndPlay = () => {
      if (!this.audio) return;
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.audio.currentTime = Math.random() * this.audio.duration;
      }
      void this.audio.play().catch(() => {});
      this.fadeTo(DEFAULT_VOLUME);
    };

    if (this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      seekAndPlay();
    } else {
      this.audio.addEventListener('canplay', seekAndPlay, { once: true });
      this.audio.load();
    }
  }

  stop(fade = true): void {
    if (!this.started) return;
    this.started = false;

    if (!this.audio) return;

    if (fade) {
      this.fadeTo(0, () => this.cleanup());
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.clearFade();
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }

  private fadeTo(target: number, onComplete?: () => void): void {
    if (!this.audio) {
      onComplete?.();
      return;
    }
    this.clearFade();

    const start = this.audio.volume;
    const steps = Math.max(1, Math.round(FADE_MS / 40));
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step += 1;
      if (!this.audio) {
        this.clearFade();
        return;
      }
      const progress = Math.min(1, step / steps);
      this.audio.volume = start + (target - start) * progress;
      if (step >= steps) {
        this.audio.volume = target;
        this.clearFade();
        onComplete?.();
      }
    }, 40);
  }

  private clearFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  get isPlaying(): boolean {
    return this.started && !!this.audio && !this.audio.paused;
  }
}
