"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AboutOverlay from "./AboutOverlay";

const SESSION_KEY = "mv_landing_tab_shown";

export default function LandingFeaturePrompt() {
  const [tabVisible, setTabVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show tab 25 seconds after landing — once shown, it stays
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        setTabVisible(true);
        return;
      }
    } catch { /* sessionStorage unavailable */ }

    const timer = setTimeout(() => {
      setTabVisible(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* non-fatal */ }
    }, 25_000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Persistent floating tab — stays on the page once it appears */}
      <AnimatePresence>
        {tabVisible && !open && (
          <div className="fixed right-0 top-1/2 z-50 -translate-y-1/2">
          <motion.button
            key="features-tab"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setOpen(true)}
            aria-label="View platform features"
          >
            {/* Vertical tab pill on the right edge */}
            <div
              className="flex flex-col items-center gap-1.5 rounded-l-[10px] border border-r-0 px-2.5 py-4"
              style={{
                background: "rgba(4,10,4,0.96)",
                borderColor: "rgba(46,230,166,0.22)",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(46,230,166,0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Radar icon */}
              <svg width="14" height="14" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="9.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.40" />
                <circle cx="11" cy="11" r="5.5" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.28" />
                <line x1="11" y1="11" x2="18" y2="5.2" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.70" />
                <circle cx="11" cy="11" r="1.5" fill="#2EE6A6" fillOpacity="0.90" />
              </svg>
              {/* Rotated label */}
              <span
                className="text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: "rgba(46,230,166,0.70)",
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                  transform: "rotate(180deg)",
                  letterSpacing: "0.22em",
                }}
              >
                Features
              </span>
            </div>
          </motion.button>
          </div>
        )}
      </AnimatePresence>

      <AboutOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
