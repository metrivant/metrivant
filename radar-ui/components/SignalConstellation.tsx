"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { RadarCompetitor } from "../lib/api";

// ─── Color by movement type ───────────────────────────────────────────────────
function getColor(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "#f97316"; // orange
    case "product_expansion":      return "#00e5ff"; // cyan
    case "market_reposition":      return "#a855f7"; // purple
    case "enterprise_push":
    case "ecosystem_expansion":    return "#f59e0b"; // gold
    default:                       return "#2EE6A6";
  }
}

function getMovementLabel(movementType: string): string {
  return movementType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Cluster detection ────────────────────────────────────────────────────────
type Cluster = {
  movementType: string;
  nodes: RadarCompetitor[];
  totalSignals: number;
  avgConfidence: number;
};

function detectCluster(competitors: RadarCompetitor[]): Cluster | null {
  const groups = new Map<string, RadarCompetitor[]>();
  for (const c of competitors) {
    if (!c.latest_movement_type) continue;
    const g = groups.get(c.latest_movement_type) ?? [];
    g.push(c);
    groups.set(c.latest_movement_type, g);
  }

  let best: Cluster | null = null;
  for (const [movementType, comps] of groups) {
    if (comps.length < 2) continue;
    const totalSignals = comps.reduce((s, c) => s + (c.signals_7d ?? 0), 0);
    const confs = comps
      .filter((c) => c.latest_movement_confidence != null)
      .map((c) => c.latest_movement_confidence!);
    const avgConfidence =
      confs.length > 0 ? confs.reduce((s, v) => s + v, 0) / confs.length : 0;
    if (!best || totalSignals > best.totalSignals) {
      best = {
        movementType,
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

// ─── Star positions — deterministic circular spread ───────────────────────────
// viewBox is 200 × 138. Stars cluster in the upper portion (cy ≈ 54).
function getStarPositions(count: number): { x: number; y: number }[] {
  const cx = 100;
  const cy = 54;
  const baseRadius = count <= 2 ? 24 : count <= 3 ? 30 : 34;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    // slight deterministic jitter per index for natural feel
    const r = baseRadius + [6, -4, 2, 8, -6][i % 5];
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SignalConstellation({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const cluster = useMemo(() => detectCluster(competitors), [competitors]);

  if (!cluster) return null;

  const { movementType, nodes, avgConfidence } = cluster;
  const color = getColor(movementType);
  const label = getMovementLabel(movementType);
  const confidencePct = Math.round(avgConfidence * 100);
  const positions = getStarPositions(nodes.length);

  // Animation timing constants (seconds)
  const STAR_STAGGER   = 0.12;
  const LINE_START     = nodes.length * STAR_STAGGER + 0.3;
  const LINE_STAGGER   = 0.22;
  const TITLE_START    = LINE_START + (nodes.length - 1) * LINE_STAGGER + 0.5;
  const PULSE_START    = TITLE_START + 0.5;

  return (
    <div className="px-3 py-3">
      {/* Section label */}
      <div
        className="mb-2 text-[9px] uppercase tracking-[0.28em]"
        style={{ color: "rgba(46,230,166,0.35)" }}
      >
        Signal Constellation
      </div>

      {/* SVG panel */}
      <div
        className="overflow-hidden rounded-[10px]"
        style={{
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(46,230,166,0.07)",
        }}
      >
        <svg
          width="100%"
          viewBox="0 0 200 138"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
          aria-hidden="true"
        >
          {/* Subtle dot grid */}
          <defs>
            <pattern
              id="scDots"
              x="0"
              y="0"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="5" cy="5" r="0.4" fill="rgba(255,255,255,0.035)" />
            </pattern>
          </defs>
          <rect width="200" height="138" fill="url(#scDots)" />

          {/* Connection lines — draw in after stars appear */}
          {positions.map((pos, i) => {
            if (i === 0) return null;
            const prev = positions[i - 1];
            return (
              <motion.line
                key={`line-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={pos.x}
                y2={pos.y}
                stroke={color}
                strokeWidth="0.7"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.4 }}
                transition={{
                  duration: 0.35,
                  delay: LINE_START + (i - 1) * LINE_STAGGER,
                  ease: "easeOut",
                }}
                style={{ filter: `drop-shadow(0 0 2px ${color}55)` }}
              />
            );
          })}

          {/* Stars */}
          {positions.map((pos, i) => (
            <g key={`star-${i}`}>
              {/* Outer glow — pulses once then breathes gently */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={6}
                fill={color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.12, 0.06], scale: [0, 1.4, 1] }}
                transition={{
                  duration: 0.5,
                  delay: i * STAR_STAGGER,
                  ease: "easeOut",
                  times: [0, 0.5, 1],
                }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* Core dot */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={2.4}
                fill={color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.92, scale: 1 }}
                transition={{
                  duration: 0.2,
                  delay: i * STAR_STAGGER,
                  ease: "easeOut",
                }}
                style={{
                  filter: `drop-shadow(0 0 3px ${color})`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
              {/* Single pulse ring after constellation forms */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={2.4}
                fill="none"
                stroke={color}
                strokeWidth="0.8"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: [0, 0.7, 0], scale: [1, 2.8, 3.2] }}
                transition={{
                  duration: 0.9,
                  delay: PULSE_START + i * 0.08,
                  ease: "easeOut",
                  times: [0, 0.3, 1],
                }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            </g>
          ))}

          {/* Pattern title block */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: TITLE_START, ease: "easeOut" }}
          >
            <text
              x="100"
              y="98"
              textAnchor="middle"
              fill="rgba(255,255,255,0.38)"
              fontSize="5"
              fontWeight="600"
              letterSpacing="0.18em"
              fontFamily="ui-monospace, monospace"
            >
              CONSTELLATION DETECTED
            </text>
            <text
              x="100"
              y="109"
              textAnchor="middle"
              fill={color}
              fontSize="7"
              fontWeight="700"
              letterSpacing="0.06em"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
            <text
              x="100"
              y="120"
              textAnchor="middle"
              fill="rgba(255,255,255,0.28)"
              fontSize="5"
              fontFamily="ui-monospace, monospace"
            >
              {nodes.length} rivals · {confidencePct}% confidence
            </text>
          </motion.g>
        </svg>
      </div>
    </div>
  );
}
