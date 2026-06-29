const FADE_MS = 700;
const FADE_STEP_MS = 40;
const PRE_SPEECH_GAP_MS = 500;

export class TrackAudio {
  private audio: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private masterVolume = 1;
  private playing = false;

  play(url: string, onEnded: () => void): void {
    this.stop(false);

    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.volume = 0;

    const handleEnded = () => {
      this.fadeOut(() => {
        this.playing = false;
        this.gapTimer = setTimeout(onEnded, PRE_SPEECH_GAP_MS);
      });
    };

    this.audio.addEventListener('ended', handleEnded, { once: true });
    this.audio.addEventListener('error', () => handleEnded(), { once: true });

    const startPlayback = () => {
      this.playing = true;
      void this.audio!.play().catch(() => handleEnded());
      this.fadeTo(this.masterVolume);
    };

    if (this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      this.audio.addEventListener('canplay', startPlayback, { once: true });
      this.audio.load();
    }
  }

  stop(fade = true): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }

    if (!this.audio) {
      this.playing = false;
      return;
    }

    const audio = this.audio;
    this.audio = null;

    if (fade && !audio.paused) {
      this.fadeOut(() => {
        audio.pause();
        audio.currentTime = 0;
        this.playing = false;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      this.playing = false;
    }
  }

  setVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.audio && this.playing) {
      this.audio.volume = volume;
    }
  }

  get isPlaying(): boolean {
    return this.playing && !!this.audio && !this.audio.paused;
  }

  private fadeTo(target: number, onComplete?: () => void): void {
    if (!this.audio) return;
    this.clearFade();

    const start = this.audio.volume;
    const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step += 1;
      if (!this.audio) {
        this.clearFade();
        return;
      }
      const progress = step / steps;
      this.audio.volume = start + (target - start) * progress;
      if (step >= steps) {
        this.audio.volume = target;
        this.clearFade();
        onComplete?.();
      }
    }, FADE_STEP_MS);
  }

  private fadeOut(onComplete: () => void): void {
    if (!this.audio) {
      onComplete();
      return;
    }
    this.fadeTo(0, onComplete);
  }

  private clearFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}

export const PRE_TRACK_SPEECH_GAP_MS = PRE_SPEECH_GAP_MS;
