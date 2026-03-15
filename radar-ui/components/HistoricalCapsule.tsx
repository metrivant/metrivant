"use client";

/**
 * HistoricalCapsule — periodic historical trade capsules.
 *
 * Surfaces a brief, evocative note linking ancient commercial competition
 * to the modern patterns Metrivant detects. Appears 3 minutes after load,
 * then every 8 minutes thereafter. One capsule per trigger. Auto-dismisses
 * after 22 seconds. Positioned bottom-left, above the mobile nav.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Capsule = {
  id: string;
  era: string;
  eraColor: string;
  headline: string;
  body: string;
};

const CAPSULES: Capsule[] = [
  {
    id: "cap_spice",
    era: "1400s · Spice Routes",
    eraColor: "#f59e0b",
    headline: "Venice watched its rivals constantly.",
    body: "Venetian merchants stationed agents in Alexandria and Beirut whose sole job was to report when Portuguese ships were spotted. First to know meant first to adjust prices. The intelligence advantage was the competitive advantage.",
  },
  {
    id: "cap_silk",
    era: "200 BCE · Silk Road",
    eraColor: "#818cf8",
    headline: "The road rewarded repositioning.",
    body: "Han Dynasty merchants who shifted from raw silk to lacquerware when competitors flooded the silk market doubled margins within a single trade season. Market repositioning is not modern — it is the oldest survival move.",
  },
  {
    id: "cap_east_india",
    era: "1600s · East India Company",
    eraColor: "#2EE6A6",
    headline: "Feature convergence sank prices.",
    body: "When the Dutch VOC matched the English East India Company's clove supply routes, both companies were forced into a price war that eroded margins for a decade. Convergence is always visible before the pricing pressure arrives.",
  },
  {
    id: "cap_hanseatic",
    era: "1300s · Hanseatic League",
    eraColor: "#f97316",
    headline: "Ecosystems expand before rivals notice.",
    body: "The Hanseatic League built 200 trading posts across Northern Europe before any single competitor could respond. By the time rival city-states recognized the pattern, the network effect was unassailable. Ecosystem expansion looks slow — until it doesn't.",
  },
  {
    id: "cap_roman",
    era: "100 CE · Roman Trade Empire",
    eraColor: "#ef4444",
    headline: "Enterprise push followed infrastructure.",
    body: "Roman merchants used imperial road infrastructure to push grain, pottery, and olive oil into markets competitors couldn't reach at comparable speed. The enterprise push was always upstream — control the channel, own the buyer.",
  },
  {
    id: "cap_medici",
    era: "1400s · Medici Banking",
    eraColor: "#c084fc",
    headline: "Market momentum was tracked by letter.",
    body: "The Medici bank ran a network of correspondents whose weekly dispatches reported pricing shifts, new entrants, and sovereign financial moves across 12 cities. They called it 'market intelligence.' The instrument has changed. The instinct has not.",
  },
];

export default function HistoricalCapsule() {
  const [current, setCurrent] = useState<Capsule | null>(null);
  const indexRef = useRef(0);
  // Shuffle once on mount so each session feels fresh
  const shuffledRef = useRef<Capsule[]>([]);

  useEffect(() => {
    // Fisher-Yates shuffle
    const arr = [...CAPSULES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffledRef.current = arr;
  }, []);

  const showNext = useCallback(() => {
    const list = shuffledRef.current.length ? shuffledRef.current : CAPSULES;
    const next = list[indexRef.current % list.length];
    indexRef.current++;
    setCurrent(next);
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  // First capsule after 3 minutes, then every 8 minutes
  useEffect(() => {
    const firstTimer = setTimeout(showNext, 3 * 60 * 1000);
    return () => clearTimeout(firstTimer);
  }, [showNext]);

  useEffect(() => {
    if (current !== null) return;
    // After first has been shown (index > 0), start the 8-minute cycle
    if (indexRef.current === 0) return;
    const t = setTimeout(showNext, 8 * 60 * 1000);
    return () => clearTimeout(t);
  }, [current, showNext]);

  // Auto-dismiss after 22s
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, 22_000);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-30 md:bottom-6 md:left-5">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative w-[252px] overflow-hidden rounded-[14px] border"
            style={{
              background: "rgba(4,8,4,0.97)",
              borderColor: `${current.eraColor}22`,
              boxShadow: `0 0 0 1px ${current.eraColor}0c, 0 12px 40px rgba(0,0,0,0.88)`,
              backdropFilter: "blur(14px)",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${current.eraColor}44, transparent)` }}
            />

            <div className="px-3.5 pt-3.5 pb-3">
              {/* Header */}
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div>
                  <div
                    className="text-[8px] font-bold uppercase tracking-[0.26em]"
                    style={{ color: `${current.eraColor}70` }}
                  >
                    Historical Record
                  </div>
                  <div
                    className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: `${current.eraColor}90` }}
                  >
                    {current.era}
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
                  style={{ color: "rgba(100,116,139,0.50)" }}
                  aria-label="Dismiss"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                    <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <p className="mb-1 text-[11.5px] font-semibold leading-snug text-white">
                {current.headline}
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                {current.body}
              </p>
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 22, ease: "linear" }}
              style={{ background: `${current.eraColor}28`, transformOrigin: "left", height: "1.5px", width: "100%" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
