"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  tier: 10 | 20;
  onDismiss: () => void;
};

// ── Tier-1 constellation geometry (viewBox 220×200, hex ring + center) ─────────

type StarPos = { x: number; y: number };

const T1_STARS: StarPos[] = [
  { x: 110, y: 42 },  // 0 top
  { x: 155, y: 65 },  // 1 TR
  { x: 155, y: 130 }, // 2 BR
  { x: 110, y: 155 }, // 3 bottom
  { x: 65,  y: 130 }, // 4 BL
  { x: 65,  y: 65 },  // 5 TL
  { x: 110, y: 98 },  // 6 center
];

const T1_LINES: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], // spokes
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // ring
];

// ── Tier-2 constellation geometry (viewBox 280×260, inner hex + outer ring) ────

const T2_STARS: StarPos[] = [
  // Inner ring (0–5) + center (6)
  { x: 140, y: 80 },  // 0
  { x: 178, y: 101 }, // 1
  { x: 178, y: 143 }, // 2
  { x: 140, y: 164 }, // 3
  { x: 102, y: 143 }, // 4
  { x: 102, y: 101 }, // 5
  { x: 140, y: 122 }, // 6 center
  // Outer ring (7–12)
  { x: 140, y: 30 },  // 7 far top
  { x: 210, y: 68 },  // 8 far TR
  { x: 218, y: 168 }, // 9 far BR
  { x: 140, y: 215 }, // 10 far bottom
  { x: 62,  y: 170 }, // 11 far BL
  { x: 60,  y: 70 },  // 12 far TL
];

const T2_LINES_INNER: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
];

const T2_LINES_OUTER: [number, number][] = [
  [0, 7], [1, 8], [2, 9], [3, 10], [4, 11], [5, 12], // inner-to-outer spokes
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 7], // outer ring
];

// ── Scattered background stars (tier-2 only) ──────────────────────────────────

const BG_STARS = [
  { x: 18,  y: 18,  r: 0.7 }, { x: 52,  y: 10,  r: 0.5 }, { x: 200, y: 14,  r: 0.9 },
  { x: 252, y: 32,  r: 0.6 }, { x: 14,  y: 185, r: 0.5 }, { x: 262, y: 202, r: 0.8 },
  { x: 28,  y: 242, r: 0.6 }, { x: 258, y: 248, r: 0.7 }, { x: 128, y: 6,   r: 0.6 },
  { x: 82,  y: 244, r: 0.5 }, { x: 222, y: 242, r: 0.6 }, { x: 6,   y: 122, r: 0.8 },
  { x: 272, y: 120, r: 0.5 }, { x: 168, y: 250, r: 0.6 }, { x: 38,  y: 50,  r: 0.4 },
];

// ── Galaxy spiral dot angles ───────────────────────────────────────────────────

const SPIRAL_ANGLES = [0, 60, 120, 180, 240, 300];

// ── Tier-1: small constellation formation ─────────────────────────────────────

function ConstellationScene() {
  const CX = 110, CY = 98;

  return (
    <svg width="220" height="200" viewBox="0 0 220 200" aria-hidden="true">
      {/* Center soft glow */}
      <motion.circle
        cx={CX} cy={CY} r={26}
        fill="rgba(46,230,166,0.07)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />

      {/* Constellation lines — appear after stars */}
      {T1_LINES.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={T1_STARS[a].x} y1={T1_STARS[a].y}
          x2={T1_STARS[b].x} y2={T1_STARS[b].y}
          stroke="#2EE6A6"
          strokeWidth={0.6}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.32 }}
          transition={{ duration: 0.35, delay: T1_STARS.length * 0.11 + 0.25 + i * 0.07 }}
        />
      ))}

      {/* Stars — staggered appearance */}
      {T1_STARS.map((s, i) => {
        const isCenter = i === 6;
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.38, delay: i * 0.11, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: `${s.x}px ${s.y}px` }}
          >
            <circle
              cx={s.x} cy={s.y}
              r={isCenter ? 7.5 : 5}
              fill="none"
              stroke="#2EE6A6"
              strokeWidth={0.8}
              strokeOpacity={0.22}
            />
            <circle
              cx={s.x} cy={s.y}
              r={isCenter ? 2.4 : 1.7}
              fill="#2EE6A6"
              fillOpacity={0.88}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Tier-2: full galaxy formation ─────────────────────────────────────────────

function GalaxyScene() {
  const CX = 140, CY = 122;

  return (
    <svg width="280" height="260" viewBox="0 0 280 260" aria-hidden="true">
      {/* Scattered background micro-stars */}
      {BG_STARS.map((s, i) => (
        <motion.circle
          key={`bg-${i}`}
          cx={s.x} cy={s.y} r={s.r}
          fill="rgba(200,222,255,0.55)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0.35, 0.80, 0.45] }}
          transition={{
            duration: 4,
            delay: 0.05 * i,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Galaxy outer glow */}
      <motion.circle
        cx={CX} cy={CY} r={42}
        fill="rgba(46,230,166,0.06)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.2, ease: "easeOut" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />

      {/* Galaxy core glow */}
      <motion.circle
        cx={CX} cy={CY} r={14}
        fill="rgba(46,230,166,0.22)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />

      {/* Rotating spiral arm dots */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {SPIRAL_ANGLES.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const r1 = 38, r2 = 54;
          return (
            <g key={i}>
              <motion.circle
                cx={CX + r1 * Math.cos(rad)} cy={CY + r1 * Math.sin(rad)} r={1.3}
                fill="rgba(46,230,166,0.55)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.0 + i * 0.09 }}
              />
              <motion.circle
                cx={CX + r2 * Math.cos(rad + 0.55)} cy={CY + r2 * Math.sin(rad + 0.55)} r={0.9}
                fill="rgba(110,200,255,0.50)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.2 + i * 0.09 }}
              />
            </g>
          );
        })}
      </motion.g>

      {/* Inner constellation lines */}
      {T2_LINES_INNER.map(([a, b], i) => (
        <motion.line
          key={`il-${i}`}
          x1={T2_STARS[a].x} y1={T2_STARS[a].y}
          x2={T2_STARS[b].x} y2={T2_STARS[b].y}
          stroke="#2EE6A6"
          strokeWidth={0.7}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.32 }}
          transition={{ duration: 0.32, delay: 7 * 0.09 + 0.25 + i * 0.06 }}
        />
      ))}

      {/* Inner stars */}
      {T2_STARS.slice(0, 7).map((s, i) => {
        const isCenter = i === 6;
        return (
          <motion.g
            key={`is-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.36, delay: 0.08 + i * 0.09, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: `${s.x}px ${s.y}px` }}
          >
            <circle cx={s.x} cy={s.y} r={isCenter ? 6.5 : 4.5}
              fill="none" stroke="#2EE6A6" strokeWidth={0.8} strokeOpacity={0.22} />
            <circle cx={s.x} cy={s.y} r={isCenter ? 2.2 : 1.6}
              fill="#2EE6A6" fillOpacity={0.88} />
          </motion.g>
        );
      })}

      {/* Outer constellation lines */}
      {T2_LINES_OUTER.map(([a, b], i) => (
        <motion.line
          key={`ol-${i}`}
          x1={T2_STARS[a].x} y1={T2_STARS[a].y}
          x2={T2_STARS[b].x} y2={T2_STARS[b].y}
          stroke="rgba(110,200,255,0.65)"
          strokeWidth={0.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          transition={{ duration: 0.35, delay: 1.55 + i * 0.08 }}
        />
      ))}

      {/* Outer stars — cyan tinted */}
      {T2_STARS.slice(7).map((s, i) => (
        <motion.g
          key={`os-${i}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.40, delay: 1.38 + i * 0.11, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: `${s.x}px ${s.y}px` }}
        >
          <circle cx={s.x} cy={s.y} r={3.8}
            fill="none" stroke="rgba(110,200,255,0.55)" strokeWidth={0.8} strokeOpacity={0.28} />
          <circle cx={s.x} cy={s.y} r={1.4}
            fill="rgba(160,215,255,0.88)" />
        </motion.g>
      ))}

      {/* Expanding radar rings — fires after constellations form */}
      {[52, 85, 118].map((r, i) => (
        <motion.circle
          key={`ring-${i}`}
          cx={CX} cy={CY} r={r}
          fill="none"
          stroke="rgba(46,230,166,0.55)"
          strokeWidth={0.9}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 1.9, delay: 3.0 + i * 0.55, ease: "easeOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
    </svg>
  );
}

// ── Main overlay component ─────────────────────────────────────────────────────

export default function MilestoneOverlay({ tier, onDismiss }: Props) {
  const autoDismissMs = tier === 10 ? 4000 : 6500;
  const isMajor = tier === 20;

  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [onDismiss, autoDismissMs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.38 }}
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: isMajor ? "rgba(0,5,2,0.88)" : "rgba(0,3,1,0.74)" }}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={isMajor ? "Observatory Activated" : "Observatory Progress"}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[18px] border"
        style={{
          width: isMajor ? 440 : 360,
          background: "rgba(4,9,6,0.99)",
          borderColor: isMajor ? "rgba(46,230,166,0.28)" : "rgba(46,230,166,0.18)",
          boxShadow: isMajor
            ? "0 0 80px rgba(46,230,166,0.14), 0 0 160px rgba(46,230,166,0.06), 0 40px 80px rgba(0,0,0,0.96)"
            : "0 0 40px rgba(46,230,166,0.10), 0 24px 60px rgba(0,0,0,0.92)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background: isMajor
              ? "linear-gradient(90deg,transparent,rgba(46,230,166,0.75),rgba(96,200,255,0.45),transparent)"
              : "linear-gradient(90deg,transparent,rgba(46,230,166,0.60),transparent)",
          }}
        />

        {/* SVG scene */}
        <div className="flex justify-center pt-8 pb-1">
          {isMajor ? <GalaxyScene /> : <ConstellationScene />}
        </div>

        {/* Text content */}
        <div className="px-8 pb-8 text-center">
          <div
            className="text-[9px] font-bold uppercase tracking-[0.32em] mb-2"
            style={{ color: isMajor ? "rgba(46,230,166,0.55)" : "rgba(46,230,166,0.50)" }}
          >
            {isMajor ? "Observatory Activated" : "Observatory Progress"}
          </div>
          <div className="text-[20px] font-bold leading-snug text-white mb-2.5">
            {tier} Achievements Unlocked
          </div>
          <div
            className="text-[13px] leading-relaxed"
            style={{ color: "rgba(148,163,184,0.65)" }}
          >
            {isMajor ? (
              <>
                Your telescope is fully aligned.<br />
                The competitive universe is now yours to observe.
              </>
            ) : (
              <>
                Your observatory is taking shape.<br />
                Keep watching the competitive sky.
              </>
            )}
          </div>
          <div
            className="mt-5 text-[9px] uppercase tracking-[0.20em]"
            style={{ color: "rgba(71,85,105,0.42)" }}
          >
            Click to dismiss
          </div>
        </div>

        {/* Bottom accent (major only) */}
        {isMajor && (
          <div
            className="absolute inset-x-0 bottom-0 h-[1px]"
            style={{ background: "linear-gradient(90deg,transparent,rgba(46,230,166,0.28),transparent)" }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
