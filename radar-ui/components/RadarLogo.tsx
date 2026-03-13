"use client";

import { motion } from "framer-motion";

/**
 * Animated radar logo for the app header.
 *
 * Outer ring: slow opacity pulse (3.5s, continuous).
 * Needle + sweep area: intermittent rotation — pause 4s, sweep 5s, pause 3s, repeat.
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
        animate={{ strokeOpacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Middle ring */}
      <circle cx="23" cy="23" r="13" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />

      {/* Inner ring */}
      <circle cx="23" cy="23" r="5.5" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.42" />

      {/* Needle + sweep sector — intermittent rotation around center */}
      {/* Pause 33% → sweep 50% → pause 17% of each 12s cycle */}
      <motion.g
        style={{ transformOrigin: "23px 23px" }}
        animate={{ rotate: [0, 0, 360, 360] }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.33, 0.83, 1],
        }}
      >
        <path
          d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z"
          fill="#2EE6A6"
          fillOpacity="0.10"
        />
        <line
          x1="23"
          y1="23"
          x2="38.2"
          y2="9.8"
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
