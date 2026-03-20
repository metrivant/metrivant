"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AboutOverlay from "./AboutOverlay";

// ── Floating "Features" button for the About page ─────────────────────────────
// Desktop: fixed to the right edge, vertically centered in the top third.
// Mobile: fixed bottom-right corner.
// Opens the existing AboutOverlay on click.

export default function FeaturesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop: right-side vertical pill ──────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(true)}
        aria-label="View platform features"
        className="
          fixed right-0 top-1/3 z-40
          hidden md:flex
          -translate-y-1/2 translate-x-0
          flex-col items-center justify-center
          gap-1.5
          rounded-l-[10px] border border-r-0 border-[#1a3a20]
          bg-[#020208]
          px-2.5 py-4
          text-[10px] font-semibold uppercase tracking-[0.22em]
          transition-colors
        "
        style={{ color: "rgba(0,180,255,0.65)", writingMode: "vertical-rl" }}
        whileHover={{
          boxShadow: "0 0 16px rgba(0,180,255,0.12), inset 0 0 8px rgba(0,180,255,0.04)",
          borderColor: "rgba(0,180,255,0.30)",
          color: "rgba(0,180,255,0.90)",
        }}
        transition={{ duration: 0.20 }}
      >
        {/* Accent dot */}
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "#00B4FF", opacity: 0.70, flexShrink: 0 }}
        />
        Features
      </motion.button>

      {/* ── Mobile: bottom-right floating button ───────────────────────────── */}
      <motion.button
        onClick={() => setOpen(true)}
        aria-label="View platform features"
        className="
          fixed bottom-6 right-4 z-40
          flex md:hidden
          items-center gap-2
          rounded-full border border-[#1a3a20]
          bg-[#020208]
          px-4 py-2.5
          text-[11px] font-semibold uppercase tracking-[0.18em]
        "
        style={{ color: "rgba(0,180,255,0.75)" }}
        whileHover={{
          boxShadow: "0 0 14px rgba(0,180,255,0.14)",
          borderColor: "rgba(0,180,255,0.30)",
        }}
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.18 }}
      >
        {/* Radar mini-icon */}
        <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.45" />
          <circle cx="14" cy="14" r="7.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
          <line x1="14" y1="14" x2="22" y2="5.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="14" cy="14" r="2" fill="#00B4FF" fillOpacity="0.90" />
        </svg>
        Features
      </motion.button>

      <AboutOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
