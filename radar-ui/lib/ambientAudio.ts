/**
 * AmbientAudioManager
 *
 * Synthesizes a minimal radar ambient soundscape using the Web Audio API.
 * No audio files — all sounds are generated programmatically.
 *
 * Sound design:
 *   • Field hum  — white noise → 2nd-order Butterworth lowpass @ 160 Hz.
 *                  Adds a barely-perceptible background presence.
 *   • Sonar pulse — sine oscillator (220 Hz base) with a soft ADSR envelope.
 *                  Pitch varies ±4% per pulse to avoid robotic repetition.
 *   • Echo shimmer — a second pulse at -6 semitones fired 380 ms later,
 *                   at 40% of the primary pulse volume.
 *
 * Pulse cadence: every 11–13 s (random jitter), loosely matching the 12-second
 * visual sonar sweep animation without rigid frame-level synchronisation.
 *
 * All gain values are intentionally very low so the layer is felt rather than heard.
 */

// Singleton — instantiated once per page lifecycle.
let _instance: AmbientAudioManager | null = null;

export function getAmbientAudio(): AmbientAudioManager {
  if (!_instance) _instance = new AmbientAudioManager();
  return _instance;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HUM_FREQ          = 160;   // Hz — lowpass cutoff for field hum
const HUM_GAIN          = 0.012; // very faint presence
const PULSE_BASE_FREQ   = 220;   // Hz — base sonar tone (A3, warm)
const PULSE_PEAK_GAIN   = 0.065; // peak envelope gain
const PULSE_ATTACK      = 0.06;  // seconds
const PULSE_SUSTAIN     = 0.22;  // seconds
const PULSE_RELEASE     = 1.80;  // seconds — long slow fade
const ECHO_DELAY        = 0.38;  // seconds after primary pulse
const ECHO_SEMITONES    = -6;    // relative pitch of echo
const ECHO_GAIN_RATIO   = 0.38;  // echo volume relative to primary
const PULSE_INTERVAL_MS = 12000; // nominal interval (ms)
const PULSE_JITTER_MS   = 1500;  // ± random jitter (ms)
const PITCH_JITTER      = 0.04;  // ± fractional pitch variation per pulse

// ── Manager ───────────────────────────────────────────────────────────────────

export class AmbientAudioManager {
  private ctx:        AudioContext | null = null;
  private master:     GainNode | null     = null;
  private humSource:  AudioBufferSourceNode | null = null;
  private humGain:    GainNode | null     = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _running    = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._running) return;

    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }

      // AudioContext may be suspended if created before a user gesture.
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      // Master output gain — allows a global fade-out on stop().
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(1, this.ctx.currentTime);
      this.master.connect(this.ctx.destination);

      this._startHum();
      this._schedulePulse(800); // first pulse shortly after activation
      this._running = true;
    } catch {
      // AudioContext blocked or unavailable — fail silently.
      this._running = false;
    }
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;

    // Fade master out smoothly over 1.2 s before tearing down nodes.
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 1.2);
    }

    if (this.pulseTimer !== null) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }

    // Defer node cleanup until the fade completes.
    setTimeout(() => this._teardown(), 1400);
  }

  get running(): boolean {
    return this._running;
  }

  // ── Field hum ──────────────────────────────────────────────────────────────

  private _startHum(): void {
    if (!this.ctx || !this.master) return;

    // White noise buffer (2 seconds, looped)
    const bufLen = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src    = this.ctx.createBufferSource();
    src.buffer   = buffer;
    src.loop     = true;

    // Two-pole lowpass filter — rolls off everything above HUM_FREQ
    const lp     = this.ctx.createBiquadFilter();
    lp.type      = "lowpass";
    lp.frequency.value = HUM_FREQ;
    lp.Q.value   = 0.5;

    // Secondary highpass at 60 Hz to remove sub-bass rumble
    const hp     = this.ctx.createBiquadFilter();
    hp.type      = "highpass";
    hp.frequency.value = 60;

    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.humGain.gain.linearRampToValueAtTime(HUM_GAIN, this.ctx.currentTime + 2.0);

    src.connect(lp);
    lp.connect(hp);
    hp.connect(this.humGain);
    this.humGain.connect(this.master);
    src.start();

    this.humSource = src;
  }

  // ── Sonar pulse ────────────────────────────────────────────────────────────

  private _firePulse(): void {
    if (!this.ctx || !this.master || !this._running) return;

    const now       = this.ctx.currentTime;
    // Slight pitch variation per pulse — avoids robotic repetition
    const pitchMult = 1 + (Math.random() * 2 - 1) * PITCH_JITTER;
    const freq      = PULSE_BASE_FREQ * pitchMult;

    this._singlePulse(now, freq, PULSE_PEAK_GAIN);

    // Echo shimmer — lower pitch, delayed, quieter
    const echoFreq = freq * Math.pow(2, ECHO_SEMITONES / 12);
    this._singlePulse(
      now + ECHO_DELAY,
      echoFreq,
      PULSE_PEAK_GAIN * ECHO_GAIN_RATIO
    );
  }

  private _singlePulse(startTime: number, freq: number, peakGain: number): void {
    if (!this.ctx || !this.master) return;

    const osc  = this.ctx.createOscillator();
    osc.type   = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    // Slight frequency droop during the pulse — more organic feel
    osc.frequency.linearRampToValueAtTime(freq * 0.97, startTime + PULSE_SUSTAIN);

    const env  = this.ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + PULSE_ATTACK);
    env.gain.setValueAtTime(peakGain, startTime + PULSE_ATTACK + PULSE_SUSTAIN);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + PULSE_ATTACK + PULSE_SUSTAIN + PULSE_RELEASE);

    // Very gentle low-pass on the pulse itself — softens any brightness
    const lp   = this.ctx.createBiquadFilter();
    lp.type    = "lowpass";
    lp.frequency.value = 800;
    lp.Q.value = 0.7;

    osc.connect(lp);
    lp.connect(env);
    env.connect(this.master);

    osc.start(startTime);
    osc.stop(startTime + PULSE_ATTACK + PULSE_SUSTAIN + PULSE_RELEASE + 0.1);
  }

  // ── Pulse scheduler ────────────────────────────────────────────────────────

  private _schedulePulse(delayMs: number): void {
    if (!this._running) return;
    this.pulseTimer = setTimeout(() => {
      this._firePulse();
      // Next interval: nominal ± random jitter
      const next = PULSE_INTERVAL_MS + (Math.random() * 2 - 1) * PULSE_JITTER_MS;
      this._schedulePulse(next);
    }, delayMs);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private _teardown(): void {
    try {
      this.humSource?.stop();
    } catch { /* may already be stopped */ }
    this.humSource = null;
    this.humGain   = null;
    this.master?.disconnect();
    this.master    = null;
    // Keep ctx alive for potential restart — closing and recreating is slow.
    // ctx.suspend() instead to release OS audio resources.
    this.ctx?.suspend().catch(() => {});
  }
}
