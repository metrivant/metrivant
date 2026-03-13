"use client";

import { motion } from "framer-motion";

/**
 * Animated radar logo for the app header.
 *
 * Outer ring: slow opacity breathe (3.5s).
 * Needle + sweep area: continuous clockwise rotation — watch-dial style (9s per revolution).
 * Echo pulse: bright vibrant flare every ~15s.
 *
 * Geometry: needle base is fixed at center (23,23).
 * Needle tip starts at 12-o'clock position: (23, 1.5) — exactly on radius 21.5.
 * Trailing sweep sector spans 25° behind the needle (clockwise).
 *   Sector start at −115°: (13.91, 3.51)  →  needle tip at −90°: (23, 1.5)
 */
export default function RadarLogo() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
      {/* Outer ring — subtle breathe */}
      <motion.circle
        cx="23"
        cy="23"
        r="21.5"
        stroke="#2EE6A6"
        strokeWidth="1.5"
        animate={{ strokeOpacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Vibrant echo pulse — bright, clean, radar-like. Every ~15s. */}
      <motion.circle
        cx="23"
        cy="23"
        r="21.5"
        stroke="#2EE6A6"
        strokeWidth="1.5"
        animate={{
          strokeOpacity: [0, 0, 0.9, 0.5, 0],
          scale:         [1, 1, 1.04, 1.12, 1.20],
        }}
        style={{ transformOrigin: "23px 23px" }}
        transition={{
          duration:    1.6,
          repeat:      Infinity,
          repeatDelay: 13.4,
          ease:        "easeOut",
        }}
      />

      {/* Middle ring */}
      <circle cx="23" cy="23" r="13" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />

      {/* Inner ring */}
      <circle cx="23" cy="23" r="5.5" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.42" />

      {/* Needle + sweep sector — continuous clockwise rotation (watch-dial).
          Entire group rotates around center (23,23). Base stays fixed at center.
          Needle tip is at 12-o'clock: (23, 1.5), exactly on radius 21.5.
          Trailing sector from −115° (13.91, 3.51) → −90° (23, 1.5) clockwise. */}
      <motion.g
        style={{ transformOrigin: "23px 23px" }}
        animate={{ rotate: [0, 360] }}
        transition={{
          duration: 9,
          repeat:   Infinity,
          ease:     "linear",
        }}
      >
        {/* Trailing sweep sector */}
        <path
          d="M23 23 L13.91 3.51 A21.5 21.5 0 0 1 23 1.5 Z"
          fill="#2EE6A6"
          fillOpacity="0.10"
        />
        {/* Needle — base at center, tip at 12-o'clock on the circle */}
        <line
          x1="23"
          y1="23"
          x2="23"
          y2="1.5"
          stroke="#2EE6A6"
          strokeWidth="1.5"
          strokeOpacity="0.85"
        />
      </motion.g>

      {/* Center dot — always visible */}
      <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
    </svg>
  );
}
