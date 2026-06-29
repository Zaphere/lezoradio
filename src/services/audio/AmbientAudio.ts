export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private playing = false;

  start(): void {
    if (this.playing) return;

    try {
      this.ctx = new AudioContext();

      // Gentle ambient pad: layered low-frequency tones
      const tones = [
        { freq: 55, gain: 0.08 },   // A1
        { freq: 65.4, gain: 0.06 },  // C2
        { freq: 82.4, gain: 0.04 },  // E2
        { freq: 110, gain: 0.03 },   // A2 (faint overtone)
      ];

      for (const t of tones) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = t.freq;

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(t.gain, this.ctx.currentTime + 2);
        gain.gain.linearRampToValueAtTime(t.gain * 0.6, this.ctx.currentTime + 6);

        // Slow vibrato for warmth
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.3;
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        this.oscillators.push(osc);
        this.gainNodes.push(gain);
        this.playing = true;
      }
    } catch {
      // AudioContext not available — silently degrade
    }
  }

  stop(): void {
    if (!this.playing) return;

    try {
      const now = this.ctx!.currentTime;
      for (const gain of this.gainNodes) {
        gain.gain.linearRampToValueAtTime(0, now + 1);
      }

      setTimeout(() => {
        for (const osc of this.oscillators) {
          try { osc.stop(); } catch { /* already stopped */ }
        }
        this.oscillators = [];
        this.gainNodes = [];
        try { this.ctx?.close(); } catch { /* ignore */ }
        this.ctx = null;
        this.playing = false;
      }, 1100);
    } catch {
      this.playing = false;
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}
