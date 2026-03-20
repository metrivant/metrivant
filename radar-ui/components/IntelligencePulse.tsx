"use client";

/**
 * IntelligencePulse — 45-second engagement feature
 *
 * After 45s on the landing page:
 *   Phase 0: Small card with animated radar logo slides up from bottom-right
 *   Phase 1: Signal + movement info appears in the card
 *   Phase 2: Card expands into a full side panel
 *   Phase 3: Logo becomes "Enter Metrivant" on hover → click triggers electrical
 *            pulse + flicker → redirects to /signup
 *
 * Session-gated: shows once per visit (sessionStorage).
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
    // Zap: white noise burst through bandpass
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
    // Ding tail
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

// ── Animated radar SVG (reuses LandingLogo pattern) ─────────────────────────

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
      {/* Signal nodes */}
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
      {/* Cardinal ticks */}
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
  // 0 = small card with radar logo
  // 1 = signal + movement info appears
  // 2 = expand to side panel
  // 3 = "Enter Metrivant" CTA active
  const [hovering, setHovering] = useState(false);
  const [firing, setFiring] = useState(false); // electrical pulse state
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

  // Phase progression
  useEffect(() => {
    if (!visible) return;
    const timers = [
      setTimeout(() => setPhase(1), 2000),
      setTimeout(() => setPhase(2), 5000),
      setTimeout(() => setPhase(3), 6500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const handleEnter = useCallback(() => {
    if (firing) return;
    setFiring(true);
    playElectricalPulse();
    // Flicker sequence: rapid opacity toggling
    const steps = [0.1, 1, 0.2, 0.9, 0.05, 1, 0.15, 0.8, 0, 1];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setFlickerOpacity(steps[i]);
        i++;
      } else {
        clearInterval(interval);
        // Navigate after flicker completes
        router.push("/signup");
      }
    }, 60);
  }, [firing, router]);

  function handleDismiss() {
    setVisible(false);
  }

  // Layout variants
  const isExpanded = phase >= 2;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-[100]"
          style={{ opacity: flickerOpacity }}
          initial={false}
          animate={
            isExpanded
              ? { right: 0, bottom: 0, top: 0, width: 420 }
              : { right: 24, bottom: 24, top: "auto", width: 280 }
          }
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="relative flex h-full flex-col overflow-hidden border-l bg-[#020208]"
            style={{
              borderColor: isExpanded ? "rgba(0,180,255,0.15)" : "transparent",
              borderRadius: isExpanded ? 0 : 16,
              border: isExpanded ? undefined : "1px solid rgba(0,180,255,0.20)",
              boxShadow: isExpanded
                ? "-24px 0 80px rgba(0,0,0,0.85), 0 0 60px rgba(0,180,255,0.06)"
                : "0 0 40px rgba(0,180,255,0.08), 0 8px 24px rgba(0,0,0,0.5)",
            }}
            layout
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px] z-10"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.50), transparent)" }}
            />

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#1a2030] bg-[#070d07] text-slate-500 transition-colors hover:text-white"
              aria-label="Dismiss"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            {/* Content */}
            <div className={`flex flex-1 flex-col ${isExpanded ? "justify-center px-8" : "justify-center px-5 py-5"}`}>

              {/* Radar logo — centered, grows when expanded */}
              <div
                className="flex flex-col items-center cursor-pointer"
                onMouseEnter={() => phase >= 3 && setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onClick={() => phase >= 3 && handleEnter()}
              >
                <motion.div
                  animate={{ scale: isExpanded ? 1 : 0.85 }}
                  transition={{ duration: 0.4 }}
                >
                  <PulseRadar size={isExpanded ? 140 : 72} />
                </motion.div>

                {/* "Enter Metrivant" — appears on hover in phase 3 */}
                <AnimatePresence>
                  {phase >= 3 && hovering && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 rounded-full border border-[#00B4FF]/30 px-6 py-2"
                      style={{
                        fontFamily: "var(--font-orbitron)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: ACCENT,
                        background: "rgba(0,180,255,0.06)",
                        textShadow: `0 0 12px rgba(0,180,255,0.4)`,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Enter Metrivant
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Default label when not hovering */}
                {phase >= 3 && !hovering && (
                  <div
                    className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-600"
                    style={{ fontFamily: "var(--font-share-tech-mono)" }}
                  >
                    Hover to enter
                  </div>
                )}
              </div>

              {/* Signal + Movement info — phase 1+ */}
              <AnimatePresence>
                {phase >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`mt-5 space-y-2 ${isExpanded ? "max-w-[320px] mx-auto" : ""}`}
                  >
                    {/* Signal */}
                    <div className="rounded-[10px] border border-[#0d1020] bg-[#03030c] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />
                        <span className="text-[11px] font-medium text-white" style={{ fontFamily: "var(--font-share-tech-mono)" }}>
                          Pricing structure changed
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-600" style={{ fontFamily: "var(--font-orbitron)" }}>
                          Confidence
                        </span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#0d1020]">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: ACCENT }}
                            initial={{ width: "0%" }}
                            animate={{ width: "82%" }}
                            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                          />
                        </div>
                        <motion.span
                          className="text-[10px] font-semibold"
                          style={{ fontFamily: "var(--font-share-tech-mono)", color: ACCENT }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.0 }}
                        >
                          0.82
                        </motion.span>
                      </div>
                    </div>

                    {/* Movement */}
                    <div
                      className="flex items-center gap-2 rounded-[10px] border border-[#00B4FF]/15 px-3.5 py-2.5"
                      style={{ background: "rgba(0,180,255,0.04)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 10l4-4 3 2 3-5" stroke={ACCENT} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="3" r="1.5" fill={ACCENT} fillOpacity="0.8" />
                      </svg>
                      <span className="text-[11px] font-semibold" style={{ fontFamily: "var(--font-orbitron)", color: ACCENT }}>
                        Market repositioning detected
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom text — expanded panel only */}
              {isExpanded && phase >= 3 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-center text-[11px] text-slate-600"
                  style={{ fontFamily: "var(--font-share-tech-mono)" }}
                >
                  This runs 24/7 for your competitors.
                </motion.p>
              )}
            </div>

            {/* Electrical pulse overlay — fires on click */}
            <AnimatePresence>
              {firing && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0.1, 0.4, 0] }}
                  transition={{ duration: 0.6, times: [0, 0.1, 0.3, 0.5, 1] }}
                  style={{
                    background: `radial-gradient(circle at center, rgba(0,180,255,0.25) 0%, transparent 70%)`,
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
