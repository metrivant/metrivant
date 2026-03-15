"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function playSonarPing() {
  try {
    const ctx  = new AudioContext();
    const t    = ctx.currentTime;

    // ── Primary ping tone: low, resonant sine (ship sonar characteristic) ──
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = "sine";
    // Deep fundamental ~260 Hz — resonates like a submarine sonar
    ping.frequency.setValueAtTime(260, t);
    ping.frequency.exponentialRampToValueAtTime(180, t + 2.4);
    pingGain.gain.setValueAtTime(0, t);
    pingGain.gain.linearRampToValueAtTime(0.18, t + 0.04);   // sharp attack
    pingGain.gain.setValueAtTime(0.18, t + 0.08);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 2.4); // long resonant decay
    ping.connect(pingGain);

    // ── Reverb simulation: short comb filter via two delayed echoes ──
    // Echo 1: ~120 ms delay at lower amplitude
    const delay1 = ctx.createDelay(0.3);
    delay1.delayTime.value = 0.12;
    const echo1Gain = ctx.createGain();
    echo1Gain.gain.value = 0.35;
    pingGain.connect(delay1);
    delay1.connect(echo1Gain);

    // Echo 2: ~260 ms delay (second reflection, even softer)
    const delay2 = ctx.createDelay(0.4);
    delay2.delayTime.value = 0.26;
    const echo2Gain = ctx.createGain();
    echo2Gain.gain.value = 0.18;
    echo1Gain.connect(delay2);
    delay2.connect(echo2Gain);

    // ── Subtle harmonic overtone: fifth above (390 Hz) at low volume ──
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(390, t);
    overtone.frequency.exponentialRampToValueAtTime(270, t + 1.2);
    overtoneGain.gain.setValueAtTime(0, t);
    overtoneGain.gain.linearRampToValueAtTime(0.045, t + 0.05);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    overtone.connect(overtoneGain);

    // ── Route all to destination ──
    pingGain.connect(ctx.destination);
    echo1Gain.connect(ctx.destination);
    echo2Gain.connect(ctx.destination);
    overtoneGain.connect(ctx.destination);

    ping.start(t);      ping.stop(t + 2.4);
    overtone.start(t);  overtone.stop(t + 1.2);
  } catch { /* AudioContext unavailable — silent fail */ }
}

// Animated radar logo for the landing page hero.
// Sweep arm rotates continuously; rings pulse at staggered intervals.
// Click triggers a sonar ping sound + expanding pulse ring.
export default function LandingLogo() {
  const [pulseKey, setPulseKey] = useState(0);
  const [pulsing,  setPulsing]  = useState(false);

  function handleClick() {
    playSonarPing();
    setPulseKey((k) => k + 1);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 900);
  }

  return (
    <div
      className="relative mb-5 flex cursor-pointer items-center justify-center select-none"
      onClick={handleClick}
      role="button"
      aria-label="Ping radar"
    >
      {/* Outer ambient glow */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 120,
          height: 120,
          background: "radial-gradient(circle, rgba(46,230,166,0.12) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg width="72" height="72" viewBox="0 0 46 46" fill="none" aria-label="Metrivant radar">
        <defs>
          <radialGradient id="ll-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2EE6A6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2EE6A6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core fill */}
        <circle cx="23" cy="23" r="21.5" fill="url(#ll-core)" />

        {/* Ring 1 — slowest pulse */}
        <motion.circle
          cx="23" cy="23" r="21.5"
          stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0"
          animate={{ strokeOpacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />

        {/* Ring 2 */}
        <motion.circle
          cx="23" cy="23" r="15"
          stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0"
          animate={{ strokeOpacity: [0.10, 0.32, 0.10] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />

        {/* Ring 3 */}
        <motion.circle
          cx="23" cy="23" r="9"
          stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0.12, 0.38, 0.12] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        />

        {/* Ring 4 — innermost, fastest pulse */}
        <motion.circle
          cx="23" cy="23" r="4"
          stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0.18, 0.55, 0.18] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
        />

        {/* Rotating sweep group */}
        <motion.g
          style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear", repeatType: "loop" }}
        >
          {/* Sweep wedge */}
          <path
            d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z"
            fill="#2EE6A6"
            fillOpacity="0.08"
          />
          {/* Sweep arm */}
          <line
            x1="23" y1="23" x2="38.2" y2="9.8"
            stroke="#2EE6A6" strokeWidth="1.2" strokeOpacity="0.70"
          />
          {/* Blip on sweep tip */}
          <motion.circle
            cx="38.2" cy="9.8" r="1.4"
            fill="#2EE6A6"
            animate={{ fillOpacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>

        {/* Cardinal ticks */}
        <line x1="23" y1="1.5"  x2="23" y2="4.5"  stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="44.5" y1="23" x2="41.5" y2="23" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="23" y1="44.5" x2="23" y2="41.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="1.5" y1="23"  x2="4.5" y2="23"  stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.22" />

        {/* Centre dot */}
        <motion.circle
          cx="23" cy="23" r="2"
          fill="#2EE6A6"
          animate={{ fillOpacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Click pulse — expands outward from centre */}
        <AnimatePresence>
          {pulsing && (
            <motion.circle
              key={pulseKey}
              cx="23" cy="23"
              r={2}
              fill="none"
              stroke="#2EE6A6"
              strokeWidth="1.2"
              initial={{ r: 2, strokeOpacity: 0.85, scale: 1 }}
              animate={{ r: 26, strokeOpacity: 0, scale: 1 }}
              exit={{}}
              transition={{ duration: 0.85, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
