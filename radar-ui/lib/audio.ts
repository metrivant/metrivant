/**
 * Metrivant Audio Manager
 *
 * Minimal Web Audio API synthesizer — zero external files, zero loading state.
 * All sounds are generated procedurally via oscillators, noise, and envelopes.
 *
 * Rules:
 * - Default OFF. User must opt in.
 * - AudioContext created lazily on first play() call (user gesture required).
 * - All sound code is wrapped in try/catch — audio never blocks interaction.
 * - SSR-safe: all window access is guarded.
 */

const STORAGE_KEY = "mv_sound_enabled";

export type SoundName = "blip" | "echo" | "swoosh" | "alert" | "success" | "achieve" | "orbit-enter" | "orbit-exit" | "hint";

class AudioManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = false;
  private lastBlipAt: number = 0;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this._enabled = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage unavailable — default stays false
    }
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    this._persist();
    return this._enabled;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
    this._persist();
  }

  private _persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, this._enabled ? "1" : "0");
    } catch {}
  }

  private _ctx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      // Resume if browser suspended the context (common on first user gesture)
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  play(name: SoundName): void {
    if (!this._enabled) return;
    const ctx = this._ctx();
    if (!ctx) return;
    try {
      switch (name) {
        case "blip":          this._blip(ctx, 0);        break;
        case "echo":          this._echo(ctx);           break;
        case "swoosh":        this._swoosh(ctx);         break;
        case "alert":         this._alert(ctx);          break;
        case "success":       this._success(ctx);        break;
        case "achieve":       this._achieve(ctx);        break;
        case "orbit-enter": this._orbitEnter(ctx);   break;
        case "orbit-exit":  this._orbitExit(ctx);    break;
        case "hint":          this._hint(ctx);           break;
      }
    } catch {
      // Audio errors are never surfaced to the user
    }
  }

  /**
   * playBlip — pitch-relative radar node hover.
   * Small (low momentum) blips = higher pitch.
   * Large (high momentum) blips = lower pitch.
   * Momentum 0 → 660 Hz. Momentum 10+ → 220 Hz. Linear interpolation.
   */
  playBlip(momentum: number): void {
    if (!this._enabled) return;
    const ctx = this._ctx();
    if (!ctx) return;
    try {
      this._blip(ctx, momentum);
    } catch {
      // Audio errors are never surfaced to the user
    }
  }

  /**
   * BLIP — radar node hover.
   * Pitch scales inversely with momentum: low momentum = high pitch, high = low.
   * Frequency range: 660 Hz (momentum 0) → 220 Hz (momentum ≥ 10).
   * Debounced at 80ms to prevent rapid-fire noise when crossing multiple nodes.
   */
  private _blip(ctx: AudioContext, momentum: number): void {
    const now = Date.now();
    if (now - this.lastBlipAt < 80) return;
    this.lastBlipAt = now;

    const t = ctx.currentTime;

    // Map momentum → base frequency (linear, clamped 220–660 Hz)
    const baseFreq = Math.max(220, 660 - Math.min(momentum, 10) * 44);
    const sweepFreq = baseFreq + 60; // fixed 60 Hz upward sweep regardless of pitch

    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(sweepFreq, t + 0.065);

    filt.type = "lowpass";
    filt.frequency.value = 1800;
    filt.Q.value = 0.8;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * ECHO — node selection.
   * Airy sine with soft delay feedback. Spatial and premium-feeling.
   * Decay feedback tapers out to prevent infinite ringing.
   */
  private _echo(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const delay = ctx.createDelay(0.5);
    const fb    = ctx.createGain();
    const wet   = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(528, t);
    osc.frequency.linearRampToValueAtTime(498, t + 0.3);

    filt.type = "lowpass";
    filt.frequency.value = 1600;
    filt.Q.value = 1.0;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    delay.delayTime.value = 0.11;
    fb.gain.setValueAtTime(0.26, t);
    fb.gain.exponentialRampToValueAtTime(0.0001, t + 0.65); // taper off feedback loop
    wet.gain.value = 0.18;

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  /**
   * SWOOSH — mode transitions (observatory, gravity field, panel reveals).
   * Bandpass-filtered white noise sweeping upward in frequency. Implies motion.
   */
  private _swoosh(ctx: AudioContext): void {
    const t   = ctx.currentTime;
    const dur = 0.22;
    const bufLen = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = buf;

    filt.type = "bandpass";
    filt.frequency.setValueAtTime(180, t);
    filt.frequency.exponentialRampToValueAtTime(860, t + dur);
    filt.Q.value = 2.5;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.062, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);

    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /**
   * ALERT — critical strategic movement detected.
   * Two-tone soft chime (major third: A4 + C#5), staggered slightly.
   * Attention-grabbing but warm — not harsh or shrill.
   */
  private _alert(ctx: AudioContext): void {
    const t = ctx.currentTime;
    [440, 554].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const filt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const s = t + i * 0.045;

      osc.type = "sine";
      osc.frequency.value = freq;

      filt.type = "lowpass";
      filt.frequency.value = 2600;
      filt.Q.value = 0.7;

      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.11, s + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.55);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);

      osc.start(s);
      osc.stop(s + 0.62);
    });
  }

  /**
   * ACHIEVE — Intel Score achievement unlocked.
   * Soft ascending three-note arpeggio: C5 → E5 → G5 (major chord).
   * Each note fades gently. Warm, rewarding, non-jarring.
   */
  private _achieve(ctx: AudioContext): void {
    const t = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const filt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const s = t + i * 0.082;

      osc.type = "sine";
      osc.frequency.value = freq;

      filt.type = "lowpass";
      filt.frequency.value = 2800;
      filt.Q.value = 0.5;

      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.055, s + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.44);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);

      osc.start(s);
      osc.stop(s + 0.46);
    });
  }

  /**
   * SUCCESS — action confirmed (competitor tracked, save confirmed).
   * Short ascending two-note: A4 → E5. Restrained, positive.
   */
  private _success(ctx: AudioContext): void {
    const t = ctx.currentTime;
    [{ f: 440, s: 0 }, { f: 660, s: 0.1 }].forEach(({ f, s }) => {
      const osc  = ctx.createOscillator();
      const filt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const at = t + s;

      osc.type = "sine";
      osc.frequency.value = f;

      filt.type = "lowpass";
      filt.frequency.value = 2200;

      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.07, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);

      osc.start(at);
      osc.stop(at + 0.15);
    });
  }

  /**
   * ORBIT-ENTER — activate ORBIT mode.
   * Deep descending sine with a slow LFO wobble — implies mass and pull.
   * Two layers: low fundamental + subtle harmonic overtone.
   */
  private _orbitEnter(ctx: AudioContext): void {
    const t = ctx.currentTime;

    // Low fundamental — deep gravitational pull
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(110, t);
    osc1.frequency.exponentialRampToValueAtTime(68, t + 0.35);
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.4);

    // Harmonic layer — softer overtone for richness
    const osc2 = ctx.createOscillator();
    const filt2 = ctx.createBiquadFilter();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(220, t + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(136, t + 0.32);
    filt2.type = "lowpass";
    filt2.frequency.value = 600;
    gain2.gain.setValueAtTime(0, t + 0.02);
    gain2.gain.linearRampToValueAtTime(0.055, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc2.connect(filt2);
    filt2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.02);
    osc2.stop(t + 0.42);
  }

  /**
   * ORBIT-EXIT — return to standard mode.
   * Light ascending ping — nodes dispersing back to their orbits.
   * Higher and airier than orbit-enter; implies release/expansion.
   */
  private _orbitExit(ctx: AudioContext): void {
    const t = ctx.currentTime;

    // Primary ping — ascending chime
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    filt.type = "highpass";
    filt.frequency.value = 200;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.30);

    // Trailing shimmer — very soft high partial
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1040, t + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(820, t + 0.30);
    gain2.gain.setValueAtTime(0, t + 0.08);
    gain2.gain.linearRampToValueAtTime(0.025, t + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.35);
  }

  /**
   * HINT — tutorial panel appears.
   * Soft high-reverb shimmer: two gentle sine partials fading in slowly.
   * Implies discovery without demanding attention.
   */
  private _hint(ctx: AudioContext): void {
    const t = ctx.currentTime;
    [{ f: 740, delay: 0 }, { f: 988, delay: 0.08 }].forEach(({ f, delay }) => {
      const osc  = ctx.createOscillator();
      const filt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const wet  = ctx.createGain();
      const s    = t + delay;

      osc.type = "sine";
      osc.frequency.value = f;

      filt.type = "lowpass";
      filt.frequency.value = 2200;
      filt.Q.value = 0.5;

      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.038, s + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);

      const echo   = ctx.createDelay(0.4);
      const fbGain = ctx.createGain();
      echo.delayTime.value = 0.18;
      fbGain.gain.setValueAtTime(0.18, s);
      fbGain.gain.exponentialRampToValueAtTime(0.0001, s + 1.2);
      wet.gain.value = 0.22;

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      gain.connect(echo);
      echo.connect(fbGain);
      fbGain.connect(echo);
      echo.connect(wet);
      wet.connect(ctx.destination);

      osc.start(s);
      osc.stop(s + 1.5);
    });
  }
}

// ─── Client-side singleton ────────────────────────────────────────────────────
// SSR returns a no-op stub; client gets the real manager.
let _manager: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (typeof window === "undefined") {
    // SSR stub — none of these calls do anything
    return {
      isEnabled: false,
      toggle: () => false,
      setEnabled: () => {},
      play: () => {},
      playBlip: () => {},
    } as unknown as AudioManager;
  }
  if (!_manager) _manager = new AudioManager();
  return _manager;
}
