"use client";

/**
 * IntelligencePulse — 45-second engagement feature
 *
 * After 45s on the landing page, a cinematic card slides up from bottom-center
 * showing a simulated intelligence cycle in ~8 seconds:
 *   1. Mini radar with nodes appearing
 *   2. Signal card: "Detected: Pricing structure changed" + confidence bar
 *   3. Movement label: "Market repositioning detected"
 *   4. CTA: "This runs 24/7. See it live."
 *
 * Session-gated: shows once per visit (sessionStorage).
 * Dismissible via close button.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const SESSION_KEY = "mv_intel_pulse_shown";
const DELAY_MS = 45_000;

const ACCENT = "#00B4FF";

export default function IntelligencePulse() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0); // 0=radar, 1=signal, 2=movement, 3=cta

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const timer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(true);
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // Phase progression: 0→1→2→3 with delays
  useEffect(() => {
    if (!visible) return;
    const timers = [
      setTimeout(() => setPhase(1), 1800),  // signal appears
      setTimeout(() => setPhase(2), 4200),  // movement appears
      setTimeout(() => setPhase(3), 6500),  // CTA appears
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  function handleDismiss() {
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-6 left-1/2 z-[100] w-[380px] max-w-[calc(100vw-32px)]"
          style={{ x: "-50%" }}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="relative overflow-hidden rounded-[16px] border border-[#00B4FF]/20 bg-[#020208]"
            style={{ boxShadow: "0 0 60px rgba(0,180,255,0.08), 0 8px 32px rgba(0,0,0,0.6)" }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.50), transparent)" }}
            />

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#1a2030] bg-[#070d07] text-slate-500 transition-colors hover:text-white"
              aria-label="Dismiss"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>

            <div className="px-5 pb-5 pt-4">
              {/* Header */}
              <div
                className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em]"
                style={{ fontFamily: "var(--font-orbitron)", color: "rgba(0,180,255,0.50)" }}
              >
                Intelligence cycle
              </div>

              {/* Mini radar */}
              <div className="mb-3 flex items-center gap-4">
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="shrink-0">
                  <circle cx="26" cy="26" r="24" stroke={ACCENT} strokeWidth="0.6" strokeOpacity="0.15" />
                  <circle cx="26" cy="26" r="16" stroke={ACCENT} strokeWidth="0.5" strokeOpacity="0.12" />
                  <circle cx="26" cy="26" r="8" stroke={ACCENT} strokeWidth="0.5" strokeOpacity="0.18" />
                  <circle cx="26" cy="26" r="2" fill={ACCENT} fillOpacity="0.7" />
                  {/* Nodes appearing with phase */}
                  <motion.circle cx="34" cy="14" r="2" fill={ACCENT}
                    initial={{ fillOpacity: 0 }}
                    animate={{ fillOpacity: phase >= 0 ? 0.7 : 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                  <motion.circle cx="18" cy="34" r="1.8" fill={ACCENT}
                    initial={{ fillOpacity: 0 }}
                    animate={{ fillOpacity: phase >= 0 ? 0.5 : 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                  />
                  <motion.circle cx="38" cy="30" r="1.5" fill={ACCENT}
                    initial={{ fillOpacity: 0 }}
                    animate={{ fillOpacity: phase >= 0 ? 0.4 : 0 }}
                    transition={{ duration: 0.6, delay: 1.2 }}
                  />
                  {/* Sweep arm */}
                  <motion.line
                    x1="26" y1="26" x2="26" y2="4"
                    stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.4"
                    style={{ transformOrigin: "26px 26px" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                </svg>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-400" style={{ fontFamily: "var(--font-share-tech-mono)" }}>
                    3 competitors detected
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-600" style={{ fontFamily: "var(--font-share-tech-mono)" }}>
                    Monitoring active
                  </div>
                </div>
              </div>

              {/* Signal card — phase 1 */}
              <AnimatePresence>
                {phase >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-2 rounded-[10px] border border-[#0d1020] bg-[#03030c] px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />
                      <span className="text-[11px] font-medium text-white" style={{ fontFamily: "var(--font-share-tech-mono)" }}>
                        Pricing structure changed
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-slate-600" style={{ fontFamily: "var(--font-orbitron)" }}>Confidence</span>
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Movement — phase 2 */}
              <AnimatePresence>
                {phase >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-3 flex items-center gap-2 rounded-[10px] border border-[#00B4FF]/15 px-3.5 py-2.5"
                    style={{ background: "rgba(0,180,255,0.04)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 10l4-4 3 2 3-5" stroke={ACCENT} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="3" r="1.5" fill={ACCENT} fillOpacity="0.8" />
                    </svg>
                    <span className="text-[11px] font-semibold" style={{ fontFamily: "var(--font-orbitron)", color: ACCENT }}>
                      Market repositioning detected
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA — phase 3 */}
              <AnimatePresence>
                {phase >= 3 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <p className="mb-3 text-center text-[11px] text-slate-500" style={{ fontFamily: "var(--font-share-tech-mono)" }}>
                      This runs 24/7 for your competitors.
                    </p>
                    <Link
                      href="/signup"
                      className="block rounded-full bg-[#00B4FF] py-2 text-center text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
                      style={{ fontFamily: "var(--font-orbitron)" }}
                    >
                      See it live
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
