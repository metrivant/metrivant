"use client";

import Link from "next/link";

// Plays a soft sign-in chime — single sine tone with heavy reverb (delay feedback)
// and an aggressive lowpass filter (low treble). Fires on first user gesture.
// Uses raw Web Audio API inline — no dependency on the app's AudioManager,
// since the landing page is outside the authenticated shell.
function playSigninChime(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // Primary tone — E4, soft and warm
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Delay reverb chain
    const delay = ctx.createDelay(1.0);
    const fb    = ctx.createGain();
    const wet   = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.linearRampToValueAtTime(316, t + 0.5); // subtle downward drift

    // Aggressive lowpass — cuts treble sharply (warm, muffled)
    filt.type = "lowpass";
    filt.frequency.value = 700;
    filt.Q.value = 0.6;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.10, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    // Long reverb — 380ms delay, high feedback ratio
    delay.delayTime.value = 0.38;
    fb.gain.setValueAtTime(0.45, t);
    fb.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); // taper off
    wet.gain.value = 0.28;

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.60);

    // Second harmonic — octave up, very faint, adds shimmer
    const osc2  = ctx.createOscillator();
    const filt2 = ctx.createBiquadFilter();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, t + 0.02);
    osc2.frequency.linearRampToValueAtTime(632, t + 0.45);

    filt2.type = "lowpass";
    filt2.frequency.value = 500;

    gain2.gain.setValueAtTime(0, t + 0.02);
    gain2.gain.linearRampToValueAtTime(0.028, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);

    osc2.connect(filt2);
    filt2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.02);
    osc2.stop(t + 0.45);

    // Auto-close context after reverb tail fades
    setTimeout(() => { void ctx.close(); }, 2500);
  } catch {
    // Audio errors never surface to the user
  }
}

export default function LandingCTAButtons() {
  return (
    <div className="mt-8 flex items-center gap-3">
      <Link
        href="/signup"
        onClick={playSigninChime}
        className="cta-pulse rounded-full bg-[#00B4FF] px-8 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        Start free trial
      </Link>
      <Link
        href="/login"
        onClick={playSigninChime}
        className="px-4 py-2.5 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-300"
      >
        Sign in
      </Link>
    </div>
  );
}
