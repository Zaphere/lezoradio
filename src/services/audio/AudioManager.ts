import { TIMING } from '../../lib/timing';

type AudioLayerId = 'intro' | 'background' | 'track';

interface LayerState {
  element: HTMLAudioElement | null;
  volume: number;
  fadeTimer: ReturnType<typeof setInterval> | null;
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'fading-in' | 'fading-out';
}

export class AudioManager {
  private layers: Record<AudioLayerId, LayerState> = {
    intro: { element: null, volume: 1, fadeTimer: null, state: 'idle' },
    background: { element: null, volume: TIMING.BACKGROUND_VOLUME, fadeTimer: null, state: 'idle' },
    track: { element: null, volume: 1, fadeTimer: null, state: 'idle' },
  };

  private masterVolume = 1;
  private onTrackEnd: (() => void) | null = null;

  setTrackEndCallback(cb: (() => void) | null): void {
    this.onTrackEnd = cb;
  }

  private clearFade(layerId: AudioLayerId): void {
    const layer = this.layers[layerId];
    if (layer.fadeTimer) {
      clearInterval(layer.fadeTimer);
      layer.fadeTimer = null;
    }
  }

  private applyVolume(layerId: AudioLayerId): void {
    const layer = this.layers[layerId];
    if (layer.element) {
      layer.element.volume = Math.max(0, Math.min(1, layer.volume * this.masterVolume));
    }
  }

  private fadeTo(
    layerId: AudioLayerId,
    target: number,
    durationMs: number,
    onComplete?: () => void,
  ): void {
    const layer = this.layers[layerId];
    if (!layer.element) {
      onComplete?.();
      return;
    }

    this.clearFade(layerId);
    const start = layer.volume;

    if (durationMs <= 0 || Math.abs(target - start) < 0.01) {
      layer.volume = target;
      layer.state = target > 0 ? 'playing' : 'idle';
      this.applyVolume(layerId);
      onComplete?.();
      return;
    }

    layer.state = target > start ? 'fading-in' : 'fading-out';
    const steps = Math.max(1, Math.round(durationMs / TIMING.FADE_STEP_MS));
    let step = 0;

    layer.fadeTimer = setInterval(() => {
      step++;
      if (!layer.element) {
        this.clearFade(layerId);
        return;
      }
      const progress = Math.min(1, step / steps);
      layer.volume = start + (target - start) * progress;
      this.applyVolume(layerId);

      if (step >= steps) {
        layer.volume = target;
        layer.state = target > 0 ? 'playing' : 'idle';
        this.applyVolume(layerId);
        this.clearFade(layerId);
        onComplete?.();
      }
    }, TIMING.FADE_STEP_MS);
  }

  /* ─── Intro Layer ─── */

  playIntro(url: string, onCue?: () => void): void {
    this.stopIntro(false);

    let cueFired = false;
    const fireCue = () => {
      if (cueFired) return;
      cueFired = true;
      onCue?.();
    };

    const layer = this.layers.intro;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0;
    layer.element = audio;
    layer.state = 'loading';

    const scheduleCue = () => {
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        setTimeout(fireCue, 3000);
        return;
      }
      const cueTime = duration * TIMING.INTRO_CUE_PERCENT;
      const delayMs = Math.max(0, (cueTime - audio.currentTime) * 1000);
      setTimeout(() => {
        if (layer.element === audio && layer.state !== 'idle') {
          fireCue();
        }
      }, delayMs);
    };

    const startPlayback = () => {
      layer.state = 'playing';
      this.fadeTo('intro', 1, 500);
      void audio.play().catch(() => {});
      scheduleCue();
    };

    audio.addEventListener('ended', fireCue);

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      audio.addEventListener('canplay', startPlayback, { once: true });
      audio.load();
    }
  }

  stopIntro(fade = true): void {
    const layer = this.layers.intro;
    const audio = layer.element;
    if (!audio) return;

    this.clearFade('intro');

    if (fade && !audio.paused) {
      this.fadeTo('intro', 0, TIMING.INTRO_DUCK_DURATION, () => {
        audio.pause();
        audio.currentTime = 0;
        layer.element = null;
        layer.state = 'idle';
        layer.volume = 1;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      layer.element = null;
      layer.state = 'idle';
      layer.volume = 1;
    }
  }

  get isIntroPlaying(): boolean {
    const layer = this.layers.intro;
    return layer.state !== 'idle' && !!layer.element;
  }

  /* ─── Background Layer ─── */

  startBackground(url: string): void {
    const existing = this.layers.background;
    if (existing.element) {
      if (existing.state !== 'idle') return;
      this.stopBackground(false);
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;

    const startPlayback = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.random() * audio.duration;
      }
      void audio.play().catch(() => {});
      this.fadeTo('background', TIMING.BACKGROUND_VOLUME, TIMING.BACKGROUND_FADE_IN);
    };

    existing.element = audio;
    existing.state = 'loading';

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      audio.addEventListener('canplay', startPlayback, { once: true });
      audio.load();
    }
  }

  stopBackground(fade = true): void {
    const layer = this.layers.background;
    const audio = layer.element;
    if (!audio) return;

    this.clearFade('background');

    if (fade) {
      this.fadeTo('background', 0, TIMING.BACKGROUND_FADE_OUT, () => {
        audio.pause();
        audio.currentTime = 0;
        layer.element = null;
        layer.state = 'idle';
        layer.volume = TIMING.BACKGROUND_VOLUME;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      layer.element = null;
      layer.state = 'idle';
      layer.volume = TIMING.BACKGROUND_VOLUME;
    }
  }

  duckBackground(duration = TIMING.INTRO_DUCK_DURATION): void {
    const layer = this.layers.background;
    if (!layer.element) return;
    this.fadeTo('background', TIMING.DUCKED_BACKGROUND_VOLUME, duration);
  }

  restoreBackground(duration = TIMING.BACKGROUND_FADE_IN): void {
    const layer = this.layers.background;
    if (!layer.element) return;
    this.fadeTo('background', TIMING.BACKGROUND_VOLUME, duration);
  }

  get isBackgroundPlaying(): boolean {
    const layer = this.layers.background;
    return layer.state !== 'idle' && !!layer.element;
  }

  /* ─── Track Layer ─── */

  playTrack(url: string): void {
    this.stopTrack(false);

    const layer = this.layers.track;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0;
    layer.element = audio;
    layer.state = 'loading';

    const handleEnded = () => {
      layer.state = 'idle';
      this.fadeTo('track', 0, 700, () => {
        audio.pause();
        audio.currentTime = 0;
        layer.element = null;
        setTimeout(() => this.onTrackEnd?.(), TIMING.PRE_TRACK_GAP_MS);
      });
    };

    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', () => handleEnded(), { once: true });

    const startPlayback = () => {
      layer.state = 'playing';
      this.fadeTo('track', 1, 700);
      void audio!.play().catch(() => handleEnded());
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      audio.addEventListener('canplay', startPlayback, { once: true });
      audio.load();
    }
  }

  stopTrack(fade = true): void {
    const layer = this.layers.track;
    const audio = layer.element;
    if (!audio) {
      layer.state = 'idle';
      return;
    }

    this.clearFade('track');

    if (fade && !audio.paused) {
      this.fadeTo('track', 0, 700, () => {
        audio.pause();
        audio.currentTime = 0;
        layer.element = null;
        layer.state = 'idle';
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      layer.element = null;
      layer.state = 'idle';
    }
  }

  get isTrackPlaying(): boolean {
    const layer = this.layers.track;
    return layer.state !== 'idle' && !!layer.element;
  }

  /* ─── Global ─── */

  fadeOutAll(duration: number, onComplete?: () => void): void {
    const layers: AudioLayerId[] = ['intro', 'background', 'track'];
    let remaining = layers.length;

    for (const id of layers) {
      const layer = this.layers[id];
      if (layer.element && layer.state !== 'idle') {
        this.fadeTo(id, 0, duration, () => {
          const audio = layer.element;
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
          layer.element = null;
          layer.state = 'idle';
          remaining--;
          if (remaining <= 0) onComplete?.();
        });
      } else {
        layer.element = null;
        layer.state = 'idle';
        remaining--;
        if (remaining <= 0) onComplete?.();
      }
    }
  }

  pauseAll(): void {
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      const layer = this.layers[id];
      const audio = layer.element;
      if (!audio || audio.paused) continue;
      audio.pause();
      this.clearFade(id);
      layer.state = 'paused';
    }
  }

  resumeAll(): void {
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      const layer = this.layers[id];
      const audio = layer.element;
      if (!audio || layer.state !== 'paused') continue;
      layer.state = 'playing';
      void audio.play().catch(() => undefined);
      this.applyVolume(id);
    }
  }

  stopAll(): void {
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      const layer = this.layers[id];
      if (layer.element) {
        layer.element.pause();
        layer.element.currentTime = 0;
        layer.element = null;
      }
      this.clearFade(id);
      layer.state = 'idle';
      layer.volume = id === 'background' ? TIMING.BACKGROUND_VOLUME : 1;
    }
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = vol;
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      this.applyVolume(id);
    }
  }

  get isAnythingPlaying(): boolean {
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      const layer = this.layers[id];
      if (layer.state === 'playing' || layer.state === 'fading-in' || layer.state === 'fading-out') return true;
    }
    return false;
  }

  get isAnythingPaused(): boolean {
    for (const id of ['intro', 'background', 'track'] as AudioLayerId[]) {
      const layer = this.layers[id];
      if (layer.state === 'paused') return true;
    }
    return false;
  }

  getTrackElement(): HTMLAudioElement | null {
    return this.layers.track.element;
  }

  dispose(): void {
    this.stopAll();
    this.onTrackEnd = null;
  }
}
