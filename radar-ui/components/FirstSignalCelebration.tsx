"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAudioManager } from "../lib/audio";

const STORAGE_KEY = "mv_first_signal_seen";

export default function FirstSignalCelebration({ hasSignals }: { hasSignals: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasSignals) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}

    // Brief delay so the radar has time to render first
    const t = setTimeout(() => {
      setVisible(true);
      // Stagger alert then success for a two-beat reward sound
      const mgr = getAudioManager();
      mgr.play("alert");
      setTimeout(() => mgr.play("success"), 420);
    }, 1200);

    return () => clearTimeout(t);
  }, [hasSignals]);

  function dismiss() {
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(0,0,0,0.72)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={dismiss}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-x-0 top-[50%] z-[91] mx-auto w-[340px] max-w-[90vw]"
            style={{ translateY: "-50%" }}
            initial={{ opacity: 0, scale: 0.88, y: "calc(-50% + 20px)" }}
            animate={{ opacity: 1, scale: 1,   y: "-50%" }}
            exit={{ opacity: 0, scale: 0.94,   y: "calc(-50% + 10px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="relative overflow-hidden rounded-[20px] border p-7 text-center"
              style={{
                background:   "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(46,230,166,0.12) 0%, rgba(0,2,0,0.98) 70%)",
                borderColor:  "rgba(46,230,166,0.35)",
                boxShadow:    "0 0 0 1px rgba(46,230,166,0.10), 0 24px 80px rgba(0,0,0,0.95), 0 0 60px rgba(46,230,166,0.12)",
              }}
            >
              {/* Top accent glow */}
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.9), transparent)" }}
              />

              {/* Animated radar badge */}
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                {/* Pulse rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border"
                    style={{ borderColor: "rgba(46,230,166,0.5)" }}
                    initial={{ opacity: 0.8, scale: 1 }}
                    animate={{ opacity: 0, scale: 2.2 }}
                    transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
                  />
                ))}
                {/* Core icon */}
                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-full border"
                  style={{
                    background:   "radial-gradient(ellipse at 40% 30%, rgba(46,230,166,0.25), rgba(0,8,4,0.9))",
                    borderColor:  "rgba(46,230,166,0.55)",
                    boxShadow:    "0 0 24px rgba(46,230,166,0.35), inset 0 0 16px rgba(46,230,166,0.10)",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 46 46" fill="none" aria-hidden="true">
                    <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.55" />
                    <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.30" />
                    <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.45" />
                    <circle cx="23" cy="23" r="2.5"  fill="#2EE6A6" />
                    {/* Signal blip */}
                    <circle cx="32" cy="14" r="3" fill="#2EE6A6" fillOpacity="0.9" />
                  </svg>
                </div>
              </div>

              {/* Label */}
              <div
                className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.32em]"
                style={{ color: "rgba(46,230,166,0.65)" }}
              >
                Signal Detected
              </div>

              {/* Headline */}
              <h2
                className="mb-3 text-[22px] font-bold leading-tight text-white"
                style={{ letterSpacing: "0.04em" }}
              >
                Your radar is live.
              </h2>

              <p className="mb-6 text-[13px] leading-relaxed text-slate-500">
                The first competitive signal has been captured. Your intelligence pipeline is running and movements will appear on the radar as they are detected.
              </p>

              {/* CTA */}
              <button
                onClick={dismiss}
                className="w-full rounded-full py-2.5 text-[13px] font-bold tracking-[0.12em] text-black transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2EE6A6, #1abf88)" }}
              >
                VIEW RADAR
              </button>

              {/* Dismiss hint */}
              <button
                onClick={dismiss}
                className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-slate-700 transition-colors hover:text-slate-400"
                aria-label="Dismiss"
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
