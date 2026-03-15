"use client";

import { useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { RadarCompetitor } from "../lib/api";

// ─── Color by movement or signal type ─────────────────────────────────────────
function getColor(type: string): string {
  switch (type) {
    case "pricing_strategy_shift":
    case "price_point_change":
    case "tier_change":          return "#f97316";
    case "product_expansion":
    case "feature_launch":       return "#00e5ff";
    case "market_reposition":
    case "positioning_shift":    return "#a855f7";
    case "enterprise_push":
    case "ecosystem_expansion":  return "#f59e0b";
    default:                     return "#2EE6A6";
  }
}

function getTypeLabel(type: string): string {
  const LABELS: Record<string, string> = {
    pricing_strategy_shift: "Pricing Shift",
    price_point_change:     "Price Change",
    tier_change:            "Tier Change",
    product_expansion:      "Product Expansion",
    feature_launch:         "Feature Launch",
    market_reposition:      "Market Reposition",
    positioning_shift:      "Positioning Shift",
    enterprise_push:        "Enterprise Push",
    ecosystem_expansion:    "Ecosystem Expansion",
    content_change:         "Content Change",
  };
  return LABELS[type] ?? type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── Cluster detection ─────────────────────────────────────────────────────────
// Priority 1: movement type clusters (confirmed, ≥2 rivals)
// Priority 2: signal type clusters (pre-movement, ≥2 rivals) — fires earlier in pipeline
type Cluster = {
  type: string;
  isSignalCluster: boolean;
  nodes: RadarCompetitor[];
  totalSignals: number;
  avgConfidence: number;
};

function pickBestFromGroups(
  groups: Map<string, RadarCompetitor[]>,
  isSignalCluster: boolean,
): Cluster | null {
  let best: Cluster | null = null;
  for (const [type, comps] of groups) {
    if (comps.length < 2) continue;
    const totalSignals = comps.reduce((s, c) => s + (c.signals_7d ?? 0), 0);
    const confs = comps
      .filter(c => c.latest_movement_confidence != null)
      .map(c => c.latest_movement_confidence!);
    const avgConfidence = confs.length > 0
      ? confs.reduce((a, b) => a + b, 0) / confs.length
      : 0.5;
    if (!best || totalSignals > best.totalSignals) {
      best = {
        type,
        isSignalCluster,
        nodes: comps
          .slice()
          .sort((a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0))
          .slice(0, 5),
        totalSignals,
        avgConfidence,
      };
    }
  }
  return best;
}

function detectCluster(competitors: RadarCompetitor[]): Cluster | null {
  // Movement clusters — confirmed intelligence
  const movGroups = new Map<string, RadarCompetitor[]>();
  for (const c of competitors) {
    if (!c.latest_movement_type) continue;
    const g = movGroups.get(c.latest_movement_type) ?? [];
    g.push(c);
    movGroups.set(c.latest_movement_type, g);
  }
  const movCluster = pickBestFromGroups(movGroups, false);
  if (movCluster) return movCluster;

  // Signal clusters — pre-movement, uses latest_signal_type
  const sigGroups = new Map<string, RadarCompetitor[]>();
  for (const c of competitors) {
    if (!c.latest_signal_type) continue;
    const g = sigGroups.get(c.latest_signal_type) ?? [];
    g.push(c);
    sigGroups.set(c.latest_signal_type, g);
  }
  return pickBestFromGroups(sigGroups, true);
}

// ─── Recency opacity ───────────────────────────────────────────────────────────
function recencyOpacity(lastSignalAt: string | null): number {
  if (!lastSignalAt) return 0.55;
  const ageHours = (Date.now() - new Date(lastSignalAt).getTime()) / 3_600_000;
  if (ageHours < 24) return 1.0;
  if (ageHours < 72) return 0.75;
  return 0.55;
}

// ─── Star positions — deterministic circular spread ────────────────────────────
function getStarPositions(count: number): { x: number; y: number }[] {
  const cx = 100, cy = 54;
  const baseRadius = count <= 2 ? 24 : count <= 3 ? 30 : 34;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const r = baseRadius + [6, -4, 2, 8, -6][i % 5];
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

// Sparkle offsets per star — deterministic positions for cross/plus flashes
const SPARKLE_OFFSETS = [
  [{ dx: 8,  dy: -7 }, { dx: -9, dy: -4 }, { dx: 5,  dy: 9  }],
  [{ dx: -8, dy:  8 }, { dx:  9, dy:  3 }, { dx: -4, dy: -9 }],
  [{ dx: 7,  dy:  7 }, { dx: -6, dy:  8 }, { dx: 8,  dy: -5 }],
  [{ dx: -9, dy: -6 }, { dx:  7, dy: -8 }, { dx: -5, dy:  8 }],
  [{ dx: 6,  dy: -9 }, { dx: -8, dy:  5 }, { dx: 9,  dy:  6 }],
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function SignalConstellation({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const cluster = useMemo(() => detectCluster(competitors), [competitors]);

  // Dispatch pattern_emergence once when a cluster first resolves
  const patternFiredRef = useRef(false);
  useEffect(() => {
    if (cluster && !patternFiredRef.current) {
      patternFiredRef.current = true;
      window.dispatchEvent(new CustomEvent("mv:achieve", { detail: "pattern_emergence" }));
    }
  }, [cluster]);

  // Empty state — animated dormant dots
  if (!cluster) {
    return (
      <div className="px-3 py-3">
        <div
          className="mb-2 text-center text-[9px] uppercase tracking-[0.28em]"
          style={{ color: "rgba(46,230,166,0.35)" }}
        >
          Signal Constellation
        </div>
        <div
          className="overflow-hidden rounded-[10px]"
          style={{ background: "rgba(0,0,0,0.40)", border: "1px solid rgba(46,230,166,0.05)" }}
        >
          <svg
            width="100%"
            viewBox="0 0 200 80"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
            aria-hidden="true"
          >
            {[
              { x: 68, y: 34 }, { x: 100, y: 22 }, { x: 132, y: 34 },
              { x: 120, y: 54 }, { x: 80, y: 54 },
            ].map((pos, i) => (
              <motion.circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={1.8}
                fill="rgba(46,230,166,0.12)"
                animate={{ opacity: [0.12, 0.32, 0.12] }}
                transition={{ duration: 2.4, delay: i * 0.38, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
            <text
              x="100" y="70"
              textAnchor="middle"
              fill="rgba(255,255,255,0.14)"
              fontSize="5" fontWeight="600" letterSpacing="0.20em"
              fontFamily="ui-monospace, monospace"
            >
              AWAITING CLUSTER
            </text>
          </svg>
        </div>
      </div>
    );
  }

  const { type, isSignalCluster, nodes, avgConfidence } = cluster;
  const color   = getColor(type);
  const label   = getTypeLabel(type);
  const confPct = Math.round(avgConfidence * 100);
  const positions = getStarPositions(nodes.length);

  // Timing constants (seconds)
  const STAR_STAGGER = 0.10;
  const LINE_START   = nodes.length * STAR_STAGGER + 0.2;
  const LINE_STAGGER = 0.18;
  const TITLE_START  = LINE_START + (nodes.length - 1) * LINE_STAGGER + 0.30;
  const PULSE_START  = TITLE_START + 0.25;

  return (
    <div className="px-3 py-3">
      {/* Section label */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div
          className="text-[9px] uppercase tracking-[0.28em]"
          style={{ color: "rgba(46,230,166,0.35)" }}
        >
          Signal Constellation
        </div>
        {isSignalCluster && (
          <motion.div
            className="text-[8px] uppercase tracking-[0.14em]"
            style={{ color: `${color}99` }}
            animate={{ opacity: [0.6, 1.0, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            emerging
          </motion.div>
        )}
      </div>

      {/* SVG panel */}
      <div
        className="overflow-hidden rounded-[10px]"
        style={{
          background: "rgba(0,0,0,0.55)",
          border: `1px solid ${color}1a`,
          boxShadow: `0 0 20px ${color}08`,
        }}
      >
        <svg
          width="100%"
          viewBox="0 0 200 138"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
          aria-hidden="true"
        >
          <defs>
            <pattern id="scDots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="0.4" fill="rgba(255,255,255,0.035)" />
            </pattern>
            <radialGradient id="scClusterGlow" cx="50%" cy="39%" r="45%">
              <stop offset="0%" stopColor={color} stopOpacity="0.11" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="138" fill="url(#scDots)" />

          {/* Background radial glow — breathes with cluster */}
          <motion.rect
            width="200"
            height="138"
            fill="url(#scClusterGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1.0, 0.5] }}
            transition={{ duration: 3.5, delay: TITLE_START, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Connection lines + travel dots */}
          {positions.map((pos, i) => {
            if (i === 0) return null;
            const prev = positions[i - 1];
            const mx   = (prev.x + pos.x) / 2;
            const my   = (prev.y + pos.y) / 2;
            return (
              <g key={`line-${i}`}>
                {/* Static line */}
                <motion.line
                  x1={prev.x} y1={prev.y}
                  x2={pos.x}  y2={pos.y}
                  stroke={color}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.40 }}
                  transition={{
                    duration: 0.28,
                    delay: LINE_START + (i - 1) * LINE_STAGGER,
                    ease: "easeOut",
                  }}
                  style={{ filter: `drop-shadow(0 0 2px ${color}55)` }}
                />
                {/* Travel dot along line */}
                <motion.circle
                  r={1.0}
                  fill={color}
                  initial={{ opacity: 0, cx: prev.x, cy: prev.y }}
                  animate={{
                    cx: [prev.x, mx, pos.x, mx, prev.x],
                    cy: [prev.y, my, pos.y, my, prev.y],
                    opacity: [0, 0.9, 0.9, 0.9, 0],
                  }}
                  transition={{
                    duration: 2.0,
                    delay: LINE_START + (i - 1) * LINE_STAGGER + 0.35,
                    repeat: Infinity,
                    repeatDelay: 3.0 + i * 0.7,
                    ease: "easeInOut",
                  }}
                  style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                />
              </g>
            );
          })}

          {/* Stars */}
          {positions.map((pos, i) => {
            const driftY    = [3, -2, 2.5, -3, 1.5][i % 5];
            const driftX    = [1.5, -2, 1, -1.5, 2][i % 5];
            const driftDur  = 3.5 + i * 0.65;
            const nodeOp    = recencyOpacity(nodes[i]?.last_signal_at ?? null);
            const sparkles  = SPARKLE_OFFSETS[i % 5];

            return (
              <motion.g
                key={`star-${i}`}
                animate={{ x: [0, driftX, 0, -driftX, 0], y: [0, driftY, 0, -driftY, 0] }}
                transition={{ duration: driftDur, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
              >
                {/* Wide ambient glow halo — breathes */}
                <motion.circle
                  cx={pos.x} cy={pos.y} r={9}
                  fill={color}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 0.13 * nodeOp, 0.06 * nodeOp, 0.13 * nodeOp],
                    scale: [0, 1.2, 1, 1.1, 1],
                  }}
                  transition={{
                    duration: 0.38, delay: i * STAR_STAGGER, ease: "easeOut",
                    opacity: { repeat: Infinity, repeatDelay: 1.6 + i * 0.35, duration: 2.2 },
                    scale:   { duration: 0.38, delay: i * STAR_STAGGER },
                  }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />

                {/* Core dot with glow */}
                <motion.circle
                  cx={pos.x} cy={pos.y} r={2.6}
                  fill={color}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: nodeOp * 0.95, scale: 1 }}
                  transition={{ duration: 0.16, delay: i * STAR_STAGGER, ease: "easeOut" }}
                  style={{
                    filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 2px ${color})`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                />

                {/* Primary pulse ring */}
                <motion.circle
                  cx={pos.x} cy={pos.y} r={2.6}
                  fill="none" stroke={color} strokeWidth="0.7"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.72, 0], scale: [1, 2.6, 3.2] }}
                  transition={{
                    duration: 0.85,
                    delay: PULSE_START + i * 0.11,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 1.8 + i * 0.45,
                    times: [0, 0.22, 1],
                  }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />

                {/* Secondary pulse ring — wider, offset */}
                <motion.circle
                  cx={pos.x} cy={pos.y} r={2.6}
                  fill="none" stroke={color} strokeWidth="0.45"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.38, 0], scale: [1, 4.0, 5.0] }}
                  transition={{
                    duration: 1.2,
                    delay: PULSE_START + i * 0.11 + 0.45,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 2.2 + i * 0.45,
                    times: [0, 0.18, 1],
                  }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />

                {/* Sparkle crosses — brief flashes near each star */}
                {sparkles.map((sp, si) => {
                  const sx = pos.x + sp.dx;
                  const sy = pos.y + sp.dy;
                  const sparkDelay = PULSE_START + i * 0.18 + si * 0.38;
                  const sparkRepeatDelay = 4.2 + si * 1.1 + i * 0.65;
                  return (
                    <motion.g key={`sp-${i}-${si}`}>
                      <motion.line
                        x1={sx - 1.6} y1={sy} x2={sx + 1.6} y2={sy}
                        stroke={color} strokeWidth="0.65" strokeLinecap="round"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.90, 0] }}
                        transition={{
                          duration: 0.48, delay: sparkDelay,
                          repeat: Infinity, repeatDelay: sparkRepeatDelay,
                          times: [0, 0.28, 1],
                        }}
                        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
                      />
                      <motion.line
                        x1={sx} y1={sy - 1.6} x2={sx} y2={sy + 1.6}
                        stroke={color} strokeWidth="0.65" strokeLinecap="round"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.90, 0] }}
                        transition={{
                          duration: 0.48, delay: sparkDelay,
                          repeat: Infinity, repeatDelay: sparkRepeatDelay,
                          times: [0, 0.28, 1],
                        }}
                        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
                      />
                    </motion.g>
                  );
                })}
              </motion.g>
            );
          })}

          {/* Title block */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: TITLE_START, ease: "easeOut" }}
          >
            <text
              x="100" y="98"
              textAnchor="middle"
              fill="rgba(255,255,255,0.38)"
              fontSize="5" fontWeight="600" letterSpacing="0.18em"
              fontFamily="ui-monospace, monospace"
            >
              {isSignalCluster ? "SIGNAL PATTERN EMERGING" : "CONSTELLATION DETECTED"}
            </text>
            <text
              x="100" y="109"
              textAnchor="middle"
              fill={color}
              fontSize="7" fontWeight="700" letterSpacing="0.06em"
              fontFamily="ui-monospace, monospace"
              style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
            >
              {label}
            </text>
            <text
              x="100" y="120"
              textAnchor="middle"
              fill="rgba(255,255,255,0.28)"
              fontSize="5"
              fontFamily="ui-monospace, monospace"
            >
              {nodes.length} rivals · {isSignalCluster ? "emerging" : `${confPct}% confidence`}
            </text>
          </motion.g>
        </svg>
      </div>
    </div>
  );
}
