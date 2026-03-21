"use client";

/**
 * IntelligencePulse — 45-second engagement feature (circular radar design)
 *
 * After 45s:
 *   Phase 0: Small circular radar appears bottom-right (120px)
 *   Phase 1: Signal + movement text orbits the radar
 *   Phase 2: Circle expands large (480px), centered on screen
 *   Phase 3: Hover logo → "Enter Metrivant", click → electrical flicker → /signup
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const SESSION_KEY = "mv_intel_pulse_shown";
const DELAY_MS = 45_000;
const ACCENT = "#00B4FF";

// ── Electrical pulse sound ──────────────────────────────────────────────────

function playElectricalPulse() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const osc = ctx.createOscillator();
    const oscG = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(1200, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.4);
    oscG.gain.setValueAtTime(0, t + 0.05);
    oscG.gain.linearRampToValueAtTime(0.08, t + 0.06);
    oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
    osc.connect(oscG); oscG.connect(ctx.destination);
    noise.start(t); osc.start(t + 0.05); osc.stop(t + 0.45);
    setTimeout(() => void ctx.close(), 500);
  } catch { /* silent */ }
}

// ── Animated radar SVG ──────────────────────────────────────────────────────

function PulseRadar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <defs>
        <radialGradient id="ip-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="23" cy="23" r="21.5" fill="url(#ip-core)" />
      <motion.circle cx="23" cy="23" r="21.5" stroke={ACCENT} strokeWidth="1" strokeOpacity="0"
        animate={{ strokeOpacity: [0.15, 0.45, 0.15] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle cx="23" cy="23" r="15" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0"
        animate={{ strokeOpacity: [0.10, 0.32, 0.10] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      <motion.circle cx="23" cy="23" r="9" stroke={ACCENT} strokeWidth="0.7" strokeOpacity="0"
        animate={{ strokeOpacity: [0.12, 0.38, 0.12] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.circle cx="23" cy="23" r="4" stroke={ACCENT} strokeWidth="0.7" strokeOpacity="0"
        animate={{ strokeOpacity: [0.18, 0.55, 0.18] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
      />
      <motion.g style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear", repeatType: "loop" }}
      >
        <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill={ACCENT} fillOpacity="0.08" />
        <line x1="23" y1="23" x2="38.2" y2="9.8" stroke={ACCENT} strokeWidth="1.2" strokeOpacity="0.70" />
        <motion.circle cx="38.2" cy="9.8" r="1.4" fill={ACCENT}
          animate={{ fillOpacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.g>
      <motion.circle cx="31" cy="10" r="1.2" fill={ACCENT}
        animate={{ fillOpacity: [0, 0.7, 0.7, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle cx="12" cy="30" r="1.0" fill={ACCENT}
        animate={{ fillOpacity: [0, 0.5, 0.5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
      />
      <motion.circle cx="35" cy="28" r="0.9" fill={ACCENT}
        animate={{ fillOpacity: [0, 0.6, 0.6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 3.2 }}
      />
      <line x1="23" y1="1.5" x2="23" y2="4.5" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.22" />
      <line x1="44.5" y1="23" x2="41.5" y2="23" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.22" />
      <line x1="23" y1="44.5" x2="23" y2="41.5" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.22" />
      <line x1="1.5" y1="23" x2="4.5" y2="23" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.22" />
      <motion.circle cx="23" cy="23" r="2" fill={ACCENT}
        animate={{ fillOpacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function IntelligencePulse() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [firing, setFiring] = useState(false);
  const [flickerOpacity, setFlickerOpacity] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timers = [
      setTimeout(() => setPhase(1), 2200),
      setTimeout(() => setPhase(2), 5500),
      setTimeout(() => setPhase(3), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const handleEnter = useCallback(() => {
    if (firing) return;
    setFiring(true);
    playElectricalPulse();
    const steps = [0.1, 1, 0.2, 0.9, 0.05, 1, 0.15, 0.8, 0, 1];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) { setFlickerOpacity(steps[i]); i++; }
      else { clearInterval(interval); router.push("/signup"); }
    }, 60);
  }, [firing, router]);

  const isExpanded = phase >= 2;
  // Circle sizes
  const smallSize = 120;
  const largeSize = 480;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — only when expanded */}
          {isExpanded && (
            <motion.div
              className="fixed inset-0 z-[99]"
              style={{ background: "rgba(0,2,0,0.60)", backdropFilter: "blur(2px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVisible(false)}
            />
          )}

          <motion.div
            className="fixed z-[100] flex items-center justify-center"
            style={{ opacity: flickerOpacity }}
            animate={
              isExpanded
                ? {
                    width: largeSize, height: largeSize,
                    right: "calc(50% - 240px)", bottom: "calc(50% - 240px)",
                    borderRadius: "50%",
                  }
                : {
                    width: smallSize, height: smallSize,
                    right: 24, bottom: 24,
                    borderRadius: "50%",
                  }
            }
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Circular panel */}
            <motion.div
              className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
              style={{
                borderRadius: "50%",
                background: "#020208",
                border: `1px solid rgba(0,180,255,${isExpanded ? 0.25 : 0.15})`,
                boxShadow: isExpanded
                  ? "0 0 80px rgba(0,180,255,0.10), 0 0 200px rgba(0,180,255,0.04), inset 0 0 60px rgba(0,180,255,0.03)"
                  : "0 0 30px rgba(0,180,255,0.08), inset 0 0 20px rgba(0,180,255,0.02)",
              }}
              layout
            >
              {/* Concentric ring decorations */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute rounded-full border"
                  style={{
                    width: isExpanded ? "85%" : "80%",
                    height: isExpanded ? "85%" : "80%",
                    borderColor: "rgba(0,180,255,0.06)",
                  }}
                />
                {isExpanded && (
                  <div
                    className="absolute rounded-full border"
                    style={{ width: "65%", height: "65%", borderColor: "rgba(0,180,255,0.04)" }}
                  />
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => setVisible(false)}
                className="absolute right-[15%] top-[12%] z-20 flex h-5 w-5 items-center justify-center rounded-full bg-[#070d07]/80 text-slate-600 transition-colors hover:text-white"
                aria-label="Dismiss"
                style={{ display: isExpanded ? "flex" : "none" }}
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>

              {/* Radar logo */}
              <div
                className="relative z-10 flex cursor-pointer flex-col items-center"
                onMouseEnter={() => phase >= 3 && setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onClick={() => phase >= 3 ? handleEnter() : undefined}
              >
                <PulseRadar size={isExpanded ? 160 : 64} />

                {/* "Enter Metrivant" on hover — phase 3 */}
                <AnimatePresence>
                  {phase >= 3 && hovering && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 rounded-full border border-[#00B4FF]/30 px-5 py-1.5"
                      style={{
                        fontFamily: "var(--font-orbitron)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: ACCENT,
                        background: "rgba(0,180,255,0.06)",
                        textShadow: "0 0 12px rgba(0,180,255,0.4)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Enter Metrivant
                    </motion.div>
                  )}
                </AnimatePresence>

                {phase >= 3 && !hovering && isExpanded && (
                  <div
                    className="mt-2 text-[9px] uppercase tracking-[0.2em] text-slate-600"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                  >
                    Hover to enter
                  </div>
                )}
              </div>

              {/* Signal info — phase 1+, only in expanded */}
              <AnimatePresence>
                {phase >= 1 && isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute bottom-[18%] z-10 flex flex-col items-center gap-1.5 px-12"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-[#f59e0b]" />
                      <span className="text-[10px] text-white" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        Pricing structure changed
                      </span>
                      <span className="text-[9px] font-semibold" style={{ color: ACCENT, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        0.82
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M2 10l4-4 3 2 3-5" stroke={ACCENT} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-orbitron)", color: ACCENT }}>
                        Repositioning detected
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom text — expanded only */}
              {isExpanded && phase >= 3 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-[8%] text-[10px] text-slate-600"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                >
                  24/7 for your competitors
                </motion.p>
              )}

              {/* Electrical pulse overlay */}
              <AnimatePresence>
                {firing && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-30 rounded-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.3, 0.1, 0.4, 0] }}
                    transition={{ duration: 0.6, times: [0, 0.1, 0.3, 0.5, 1] }}
                    style={{
                      background: `radial-gradient(circle at center, rgba(0,180,255,0.30) 0%, transparent 70%)`,
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
