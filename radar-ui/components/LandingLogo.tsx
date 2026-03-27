"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Animated radar logo for the landing page hero.
// Sweep arm rotates continuously; rings pulse at staggered intervals.
// Click triggers expanding pulse ring + electrical background flash.
export default function LandingLogo({ onLogoClick }: { onLogoClick?: () => void }) {
  const [pulseKey, setPulseKey] = useState(0);
  const [pulsing,  setPulsing]  = useState(false);

  function handleClick() {
    onLogoClick?.();
    setPulseKey((k) => k + 1);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 900);
  }

  return (
    <div
      className="relative mb-5 flex cursor-pointer items-center justify-center select-none"
      onClick={handleClick}
      role="button"
      aria-label="Ping radar"
    >
      {/* Outer ambient glow */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 120,
          height: 120,
          background: "radial-gradient(circle, rgba(0,180,255,0.12) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg width="72" height="72" viewBox="0 0 46 46" fill="none" aria-label="Metrivant radar">
        <defs>
          <radialGradient id="ll-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00B4FF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#00B4FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core fill */}
        <circle cx="23" cy="23" r="21.5" fill="url(#ll-core)" />

        {/* Ring 1 — slowest pulse */}
        <motion.circle
          cx="23" cy="23" r="21.5"
          stroke="#00B4FF" strokeWidth="1" strokeOpacity="0"
          animate={{ strokeOpacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />

        {/* Ring 2 */}
        <motion.circle
          cx="23" cy="23" r="15"
          stroke="#00B4FF" strokeWidth="0.8" strokeOpacity="0"
          animate={{ strokeOpacity: [0.10, 0.32, 0.10] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />

        {/* Ring 3 */}
        <motion.circle
          cx="23" cy="23" r="9"
          stroke="#00B4FF" strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0.12, 0.38, 0.12] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        />

        {/* Ring 4 — innermost, fastest pulse */}
        <motion.circle
          cx="23" cy="23" r="4"
          stroke="#00B4FF" strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0.18, 0.55, 0.18] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
        />

        {/* Rotating sweep group */}
        <motion.g
          style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear", repeatType: "loop" }}
        >
          {/* Sweep wedge */}
          <path
            d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z"
            fill="#00B4FF"
            fillOpacity="0.08"
          />
          {/* Sweep arm */}
          <line
            x1="23" y1="23" x2="38.2" y2="9.8"
            stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.70"
          />
          {/* Blip on sweep tip */}
          <motion.circle
            cx="38.2" cy="9.8" r="1.4"
            fill="#00B4FF"
            animate={{ fillOpacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>

        {/* Signal nodes — small blips on rings, intermittently appearing */}
        <motion.circle cx="31" cy="10" r="1.2" fill="#00B4FF"
          animate={{ fillOpacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />
        <motion.circle cx="12" cy="30" r="1.0" fill="#00B4FF"
          animate={{ fillOpacity: [0, 0.5, 0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
        />
        <motion.circle cx="35" cy="28" r="0.9" fill="#00B4FF"
          animate={{ fillOpacity: [0, 0.6, 0.6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 3.2 }}
        />
        <motion.circle cx="17" cy="14" r="1.1" fill="#00B4FF"
          animate={{ fillOpacity: [0, 0.55, 0.55, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2.0 }}
        />

        {/* Cardinal ticks */}
        <line x1="23" y1="1.5"  x2="23" y2="4.5"  stroke="#00B4FF" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="44.5" y1="23" x2="41.5" y2="23" stroke="#00B4FF" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="23" y1="44.5" x2="23" y2="41.5" stroke="#00B4FF" strokeWidth="0.8" strokeOpacity="0.22" />
        <line x1="1.5" y1="23"  x2="4.5" y2="23"  stroke="#00B4FF" strokeWidth="0.8" strokeOpacity="0.22" />

        {/* Centre dot */}
        <motion.circle
          cx="23" cy="23" r="2"
          fill="#00B4FF"
          animate={{ fillOpacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Click pulse — expands outward from centre */}
        <AnimatePresence>
          {pulsing && (
            <motion.circle
              key={pulseKey}
              cx="23" cy="23"
              r={2}
              fill="none"
              stroke="#00B4FF"
              strokeWidth="1.2"
              initial={{ r: 2, strokeOpacity: 0.85, scale: 1 }}
              animate={{ r: 26, strokeOpacity: 0, scale: 1 }}
              exit={{}}
              transition={{ duration: 0.85, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
