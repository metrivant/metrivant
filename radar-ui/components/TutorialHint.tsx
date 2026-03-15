"use client";

/**
 * TutorialHint — time-based feature discovery panels.
 *
 * Shows a small floating hint after the user has spent time on the radar.
 * Each hint fires once per session (sessionStorage gate).
 * Framer Motion entrance from below. Auto-dismisses after 18s.
 * Positioned bottom-right, above the mobile nav.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAudioManager } from "../lib/audio";

type Hint = {
  id: string;
  tag: string;
  tagColor: string;
  headline: string;
  body: string;
  icon: React.ReactNode;
  delayMs: number;
};

const HINTS: Hint[] = [
  {
    id: "hint_gravity",
    tag: "Gravity Field",
    tagColor: "#818cf8",
    headline: "Mass curves the field.",
    body: "Switch to Gravity Field mode using the toggle above the radar. High-momentum competitors bend the space around them — mirroring how mass warps spacetime in general relativity.",
    delayMs: 45_000,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M2 7 Q11 9 20 7"  stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
        <path d="M2 11 Q11 14 20 11" stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.72" fill="none" />
        <path d="M2 15 Q11 12 20 15" stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
        <path d="M7 2 Q9 11 7 20"  stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
        <path d="M11 2 Q13 11 11 20" stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.72" fill="none" />
        <path d="M15 2 Q13 11 15 20" stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
        <circle cx="11" cy="11" r="2.8" stroke="#818cf8" strokeWidth="0.8" strokeOpacity="0.40" fill="none" />
        <circle cx="11" cy="11" r="1.4" fill="#818cf8" fillOpacity="0.80" />
      </svg>
    ),
  },
  {
    id: "hint_constellation",
    tag: "Signal Constellation",
    tagColor: "#2EE6A6",
    headline: "Convergence has a shape.",
    body: "The Signal Constellation in the sidebar detects when multiple rivals move in the same direction simultaneously. When that happens, the constellation lights up — market convergence made visible.",
    delayMs: 120_000,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <line x1="11" y1="3"  x2="18" y2="9"  stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.35" />
        <line x1="11" y1="3"  x2="4"  y2="9"  stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.35" />
        <line x1="18" y1="9"  x2="16" y2="18" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.35" />
        <line x1="4"  y1="9"  x2="6"  y2="18" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.35" />
        <line x1="6"  y1="18" x2="16" y2="18" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.35" />
        <circle cx="11" cy="3"  r="1.8" fill="#2EE6A6" fillOpacity="0.85" />
        <circle cx="18" cy="9"  r="1.4" fill="#2EE6A6" fillOpacity="0.60" />
        <circle cx="4"  cy="9"  r="1.4" fill="#2EE6A6" fillOpacity="0.60" />
        <circle cx="16" cy="18" r="1.4" fill="#2EE6A6" fillOpacity="0.60" />
        <circle cx="6"  cy="18" r="1.4" fill="#2EE6A6" fillOpacity="0.60" />
      </svg>
    ),
  },
  {
    id: "hint_ancient",
    tag: "Ancient Instinct",
    tagColor: "#f59e0b",
    headline: "The game is ancient.",
    body: "Pricing pressure, market repositioning, feature convergence — these patterns played out along the first spice routes as surely as they do in SaaS. The instruments are new. The instinct is not.",
    delayMs: 240_000,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <line x1="11" y1="20" x2="11" y2="12" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.70" />
        <line x1="11" y1="14" x2="6.5" y2="9"  stroke="#f59e0b" strokeWidth="1.0" strokeLinecap="round" strokeOpacity="0.58" />
        <line x1="11" y1="14" x2="15.5" y2="9" stroke="#f59e0b" strokeWidth="1.0" strokeLinecap="round" strokeOpacity="0.58" />
        <line x1="6.5" y1="9" x2="4"   y2="5"  stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.44" />
        <line x1="6.5" y1="9" x2="9"   y2="5"  stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.44" />
        <line x1="15.5" y1="9" x2="13"  y2="5"  stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.44" />
        <line x1="15.5" y1="9" x2="18"  y2="5"  stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.44" />
        <circle cx="4"  cy="4"  r="1.4" fill="#f59e0b" fillOpacity="0.85" />
        <circle cx="9"  cy="4"  r="1.4" fill="#f59e0b" fillOpacity="0.85" />
        <circle cx="13" cy="4"  r="1.4" fill="#f59e0b" fillOpacity="0.85" />
        <circle cx="18" cy="4"  r="1.4" fill="#f59e0b" fillOpacity="0.85" />
      </svg>
    ),
  },
];

export default function TutorialHint() {
  const [current, setCurrent] = useState<Hint | null>(null);
  const [dismissed, setDismissed] = useState(new Set<string>());

  const dismiss = useCallback(() => {
    if (!current) return;
    setDismissed((prev) => new Set([...prev, current.id]));
    setCurrent(null);
  }, [current]);

  // Schedule each hint based on its delay
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const hint of HINTS) {
      try {
        if (sessionStorage.getItem(hint.id) === "1") continue;
      } catch { /* non-fatal */ }

      const t = setTimeout(() => {
        // Only show if nothing else is displayed
        setCurrent((prev) => {
          if (prev) return prev;
          try { sessionStorage.setItem(hint.id, "1"); } catch { /* non-fatal */ }
          getAudioManager().play("hint");
          return hint;
        });
      }, hint.delayMs);

      timers.push(t);
    }

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss after 18s
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, 18_000);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  // After dismiss, check if next hint should show immediately (user dismissed early)
  useEffect(() => {
    if (dismissed.size === 0 || current) return;
    const next = HINTS.find((h) => {
      try { return sessionStorage.getItem(h.id) !== "1"; } catch { return false; }
    });
    if (!next) return;
    // No-op: the timers will handle it on their schedule
  }, [dismissed, current]);

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-30 md:bottom-6 md:right-5">
      <AnimatePresence>
        {current && !dismissed.has(current.id) && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative w-[240px] overflow-hidden rounded-[14px] border"
            style={{
              background: "rgba(4,8,4,0.96)",
              borderColor: `${current.tagColor}28`,
              boxShadow: `0 0 0 1px ${current.tagColor}10, 0 12px 40px rgba(0,0,0,0.85)`,
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${current.tagColor}55, transparent)` }}
            />

            <div className="px-3.5 pt-3.5 pb-3">
              {/* Header row */}
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div style={{ color: current.tagColor }}>{current.icon}</div>
                  <div
                    className="text-[9px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: `${current.tagColor}90` }}
                  >
                    {current.tag}
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
                  style={{ color: "rgba(100,116,139,0.55)" }}
                  aria-label="Dismiss hint"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                    <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <p className="mb-0.5 text-[12px] font-semibold leading-snug text-white">
                {current.headline}
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                {current.body}
              </p>
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
              className="h-[1.5px] w-full"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 18, ease: "linear" }}
              style={{ background: `${current.tagColor}35`, transformOrigin: "left" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
