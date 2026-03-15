"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { scaleLinear } from "d3-scale";
import type { RadarCompetitor, CompetitorDetail, MonitoredPage } from "../lib/api";
import { formatRelative } from "../lib/format";
import { getMomentumConfig, getMomentumEchoDuration } from "../lib/momentum";
import MomentumSparkline from "./MomentumSparkline";
import { capture } from "../lib/posthog";
import { translateMovementType, translateSignalType, getSectorLabel } from "../lib/sectors";
import {
  detectCriticalAlert,
  getAlertTitle,
  getAlertExplanation,
  type CriticalAlert,
} from "../lib/criticalAlert";
import { getAudioManager } from "../lib/audio";
import { deriveActivityEchoes, isWeakSignal as getIsWeakSignal, detectHiringSurge } from "../lib/activityEcho";
import { confidenceLanguage, signalAgeColor } from "../lib/confidence";
import { computeTensionLinks, getTensionDescription, type TensionLink } from "../lib/tension";
import { computePressureIndex } from "../lib/pressure";
import { generateMicroInsights } from "../lib/microInsights";
import ActivityTimeline from "./ActivityTimeline";

// ─── Radar geometry ──────────────────────────────────────────────────────────
const SIZE = 1000;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 420;
const RING_FACTORS = [1, 0.857, 0.571, 0.286];

// ─── Gravity Mode colour system ────────────────────────────────────────────────
// Violet/indigo field language — distinct from Standard Mode scan-green.
const G = {
  primary:  "#818cf8", // soft indigo — field lines, pulse rings
  core:     "#7c3aed", // deep violet — singularity well
  coreLt:   "#a78bfa", // light violet — attractor rings
  ring:     "#1a1640", // near-black violet — SVG grid rings, crosshairs
  bg:       "#020115", // near-black violet — background base
  dot:      "#ede9fe", // near-white violet — center emitter dot
  glow:     "#6366f1", // indigo — sonar glow filter
  dim:      "#2a2042", // very dark violet — dimmed inactive text
} as const;

// ─── Pulse cycle ──────────────────────────────────────────────────────────────
// 12-second cycle drives node ping/echo timing.
// No rotating sweep — radar stays alive through pulse rings and node behavior.
const SWEEP_DURATION = 12; // seconds per cycle — kept for node timing synchronisation

// ─── Perimeter tick marks ─────────────────────────────────────────────────────
// 72 ticks (every 5°). Major at cardinal points, medium every 30°.
// Ticks are inset 1px from the outer ring to avoid merging with ring stroke.
const TICK_COUNT = 72;
const TICK_OUTER = OUTER_RADIUS - 1; // inset so ticks don't bleed into the ring line
const TICK_MARKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const angle = (i / TICK_COUNT) * 2 * Math.PI;
  const isMajor = i % 18 === 0; // every 90°
  const isMedium = i % 6 === 0; // every 30°
  const tickLen = isMajor ? 9 : isMedium ? 5 : 3;
  const innerR = TICK_OUTER - tickLen;
  return {
    x1: CENTER + TICK_OUTER * Math.cos(angle),
    y1: CENTER + TICK_OUTER * Math.sin(angle),
    x2: CENTER + innerR * Math.cos(angle),
    y2: CENTER + innerR * Math.sin(angle),
    isMajor,
    isMedium,
  };
});

// Cardinal label positions (N/E/S/W) placed just outside the outer ring
const CARDINAL_LABELS = [
  { label: "N", angle: -Math.PI / 2 },
  { label: "E", angle: 0 },
  { label: "S", angle: Math.PI / 2 },
  { label: "W", angle: Math.PI },
].map(({ label, angle }) => ({
  label,
  x: CENTER + (OUTER_RADIUS + 14) * Math.cos(angle),
  y: CENTER + (OUTER_RADIUS + 14) * Math.sin(angle),
}));

// ─── Node ping timing ─────────────────────────────────────────────────────────
// Returns how many seconds into the sweep cycle the beam crosses this position.
// Synchronises blip ping animations with the rotating beam.
function getSweepDelay(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  let angle = Math.atan2(dy, dx); // screen coords: -π to π
  if (angle < 0) angle += 2 * Math.PI; // normalise to 0–2π (clockwise from east)
  return (angle / (2 * Math.PI)) * SWEEP_DURATION;
}

// Node state durations
const PING_DURATION = 0.5; // bright flash when beam hits
const ECHO_DURATION = 3.0; // expanding ring cooldown after ping

type Point = { x: number; y: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMovementColor(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift":
      return "#ff3b3b";
    case "product_expansion":
      return "#00e5ff";
    case "market_reposition":
      return "#ffcc00";
    case "enterprise_push":
      return "#9b5cff";
    case "ecosystem_expansion":
      return "#9b5cff";
    default:
      return "#94a3b8";
  }
}

function getMovementLabel(movementType: string | null): string {
  if (!movementType) return "Dormant";
  return movementType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Maps signal_type back to the movement color system for consistent badge coloring.
function getSignalColor(signalType: string): string {
  if (signalType === "price_point_change" || signalType === "tier_change") {
    return getMovementColor("pricing_strategy_shift");
  }
  if (signalType === "feature_launch") return getMovementColor("product_expansion");
  if (signalType === "positioning_shift") return getMovementColor("market_reposition");
  return getMovementColor(null);
}

// Urgency tier styling: 4-5 = urgent (red), 3 = elevated (amber), 1-2 = monitor (green).
function getUrgencyStyle(urgency: number): { backgroundColor: string; color: string } {
  if (urgency >= 4) return { backgroundColor: "#7f1d1d22", color: "#f87171" };
  if (urgency === 3) return { backgroundColor: "#78350f22", color: "#fbbf24" };
  return { backgroundColor: "#0c2d1a", color: "#4ade80" };
}

function getUrgencyLabel(urgency: number): string {
  if (urgency >= 4) return "urgent";
  if (urgency === 3) return "elevated";
  return "monitor";
}

function getPageTypeLabel(pageType: string): string {
  if (pageType === "pricing_plans") return "pricing page";
  if (pageType === "release_feed") return "changelog";
  return pageType.replace(/_/g, " ");
}

// Human-readable signal type labels for business users.
function getSignalTypeLabel(signalType: string): string {
  switch (signalType) {
    case "price_point_change":  return "Pricing change";
    case "tier_change":         return "Tier change";
    case "feature_launch":      return "Feature launch";
    case "feature_deprecation": return "Feature removed";
    case "positioning_shift":   return "Positioning";
    case "content_change":      return "Content change";
    default: return signalType.replace(/_/g, " ");
  }
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num % 1 === 0 ? String(num) : num.toFixed(digits);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Nodes are always fully opaque — age does not reduce visibility.
function getAgeOpacity(_lastSeenAt: string | null): number {
  return 1.0;
}

// Signal age glow: intensity multiplier 0–1 based on last_signal_at.
// Fresh (<6h)=1.0 | Recent (<24h)=0.60 | Older=0.22 | None=0.14
function getSignalAgeGlow(lastSignalAt: string | null): number {
  if (!lastSignalAt) return 0.14;
  const ageHours = (Date.now() - new Date(lastSignalAt).getTime()) / 3_600_000;
  if (ageHours < 6)  return 1.0;
  if (ageHours < 24) return 0.60;
  return 0.22;
}

function sortCompetitors(competitors: RadarCompetitor[]): RadarCompetitor[] {
  return [...competitors].sort((a, b) => {
    const momentumDiff =
      Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0);
    if (momentumDiff !== 0) return momentumDiff;
    const velocityDiff =
      Number(b.weighted_velocity_7d ?? 0) -
      Number(a.weighted_velocity_7d ?? 0);
    if (velocityDiff !== 0) return velocityDiff;
    return a.competitor_name.localeCompare(b.competitor_name);
  });
}

// Competitor with any signal activity in the last 24 hours — drives "New" badge.
function isNewToday(competitor: RadarCompetitor): boolean {
  if (!competitor.last_signal_at) return false;
  return Date.now() - new Date(competitor.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
}

function getNodePosition(index: number, total: number, radius: number): Point {
  const goldenAngle = 137.5 * (Math.PI / 180);
  const spread = Math.sqrt((index + 0.5) / Math.max(total, 1));
  const angle = index * goldenAngle - Math.PI / 2;
  const effectiveRadius = radius * (0.58 + spread * 0.42);
  return {
    x: CENTER + effectiveRadius * Math.cos(angle),
    y: CENTER + effectiveRadius * Math.sin(angle),
  };
}

function getTrailPoints(index: number, radius: number): Point[] {
  const goldenAngle = 137.5 * (Math.PI / 180);
  const angle = index * goldenAngle - Math.PI / 2;
  return [0.2, 0.38, 0.56, 0.74].map((factor) => ({
    x: CENTER + radius * factor * Math.cos(angle),
    y: CENTER + radius * factor * Math.sin(angle),
  }));
}

function getNodeSize(momentum: number): number {
  return 16 + Math.sqrt(Math.max(momentum, 0)) * 3.2;
}

// ─── Gravity Field layout ─────────────────────────────────────────────────────
// Computes similarity between two competitors based on observable data only.
// movement_type match is the dominant signal (0.50); signals_7d and momentum
// proximity each contribute up to 0.25 for a max similarity of 1.0.
function computeSimilarity(
  a: RadarCompetitor,
  b: RadarCompetitor,
  maxSignals: number,
  maxMomentum: number,
): number {
  const typeMatch =
    a.latest_movement_type != null &&
    a.latest_movement_type === b.latest_movement_type
      ? 0.5
      : 0;
  const signalSim =
    1 - Math.abs((a.signals_7d ?? 0) - (b.signals_7d ?? 0)) / Math.max(maxSignals, 1);
  const momentumSim =
    1 -
    Math.abs(Number(a.momentum_score ?? 0) - Number(b.momentum_score ?? 0)) /
      Math.max(maxMomentum, 1);
  return typeMatch + signalSim * 0.25 + momentumSim * 0.25;
}

// Runs a simplified spring-based force layout (80 iterations, deterministic).
// Similar competitors attract; all pairs repel to prevent overlap.
// Returns a Map<competitor_id, Point> of final positions.
function computeGravityPositions(
  competitors: RadarCompetitor[],
): Map<string, Point> {
  if (competitors.length === 0) return new Map();
  const n = competitors.length;
  const MAX_R = OUTER_RADIUS * 0.76;
  const maxSignals = Math.max(...competitors.map((c) => c.signals_7d ?? 0), 1);
  const maxMomentum = Math.max(
    ...competitors.map((c) => Number(c.momentum_score ?? 0)),
    1,
  );

  // Similarity matrix — O(n²) but n ≤ 50, so fine as a one-time memoized call
  const sim: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j
        ? 1
        : computeSimilarity(competitors[i], competitors[j], maxSignals, maxMomentum),
    ),
  );

  // Initial positions evenly distributed on a medium circle
  const positions: Point[] = competitors.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI;
    const r = MAX_R * 0.52;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  });

  const K_SPRING = MAX_R * 0.4; // ideal separation for fully dissimilar pair
  const MIN_DIST  = 40;          // hard minimum separation
  const STIFFNESS = 0.014;
  const REPEL     = 0.9;
  const ITERS     = 80;

  for (let iter = 0; iter < ITERS; iter++) {
    const forces: Point[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const ux = dx / dist;
        const uy = dy / dist;
        const s = sim[i][j];

        // Spring toward ideal separation (closer for similar, farther for dissimilar)
        const idealDist = K_SPRING * (1 - s * 0.68);
        const springF = (dist - idealDist) * STIFFNESS;
        forces[i].x += ux * springF;
        forces[i].y += uy * springF;
        forces[j].x -= ux * springF;
        forces[j].y -= uy * springF;

        // Hard repulsion below minimum distance
        if (dist < MIN_DIST) {
          const repelF = (MIN_DIST - dist) * REPEL;
          forces[i].x -= ux * repelF;
          forces[i].y -= uy * repelF;
          forces[j].x += ux * repelF;
          forces[j].y += uy * repelF;
        }
      }
    }

    // Apply forces; clamp within boundary
    for (let i = 0; i < n; i++) {
      positions[i].x += forces[i].x;
      positions[i].y += forces[i].y;
      const dx = positions[i].x - CENTER;
      const dy = positions[i].y - CENTER;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > MAX_R) {
        const s = MAX_R / r;
        positions[i].x = CENTER + dx * s;
        positions[i].y = CENTER + dy * s;
      }
    }
  }

  const result = new Map<string, Point>();
  competitors.forEach((c, i) => result.set(c.competitor_id, positions[i]));
  return result;
}

function getClusterLabel(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "PRICING CLUSTER";
    case "product_expansion":      return "PRODUCT CLUSTER";
    case "market_reposition":      return "MARKET CLUSTER";
    case "enterprise_push":        return "ENTERPRISE ZONE";
    case "ecosystem_expansion":    return "ECOSYSTEM ZONE";
    default:                       return "ACTIVITY CLUSTER";
  }
}

// Human-readable trajectory labels for pressure zone overlays
function getTrajectoryLabel(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "Pricing Pressure";
    case "product_expansion":      return "Product Acceleration";
    case "market_reposition":      return "Market Repositioning";
    case "enterprise_push":        return "Enterprise Expansion";
    case "ecosystem_expansion":    return "Ecosystem Expansion";
    default:                       return "Strategic Activity";
  }
}

// ─── BlipNode sub-component ───────────────────────────────────────────────────
// Isolates each competitor blip. Prevents unrelated state changes in the parent
// from causing all blips to re-render simultaneously.

type BlipNodeProps = {
  competitor: RadarCompetitor;
  index: number;
  total: number;
  radiusScale: (v: number) => number;
  isSelected: boolean;
  isDimmed: boolean;
  isAlerted: boolean;
  onSelect: (id: string) => void;
  /** Gravity Field mode: override position (skips golden-spiral layout) */
  gravityPos?: Point;
  /** Gravity Field mode: suppress trail dots */
  gravityMode?: boolean;
  /** Temporal filter: node has no signal in the active time window */
  timeDimmed?: boolean;
  /** Signal age glow intensity 0–1: 1.0=fresh<6h, 0.60=recent<24h, 0.22=old */
  signalAgeGlow?: number;
  /** Signal age color: amber=new(<6h), slate=recent(<24h), blue-grey=stale(≥24h) */
  signalAgeColor?: string;
  /** True when this competitor has signals but has not been opened this session */
  isUnvisited?: boolean;
  /** Competitor has recent activity (last 24h) below strategic-signal threshold */
  hasActivityEcho?: boolean;
  /** Hours since last activity — scales echo ripple intensity */
  echoAgeHours?: number;
  /** Competitor shows signals but momentum is below stable threshold */
  isWeakSignal?: boolean;
  /** One-line tension description shown on hover — null when no tension exists */
  tensionDescription?: string | null;
  /** Hiring-related language detected in movement summary within last 48h */
  isHiringSurge?: boolean;
  /** True on touch/mobile — enlarges label and increases contrast */
  isMobile?: boolean;
};

const BlipNode = memo(function BlipNode({
  competitor,
  index,
  total,
  radiusScale,
  isSelected,
  isDimmed,
  isAlerted,
  onSelect,
  gravityPos,
  gravityMode,
  timeDimmed,
  signalAgeGlow = 0.22,
  signalAgeColor: ageColor = "rgba(100,116,139,0.45)",
  isUnvisited = false,
  hasActivityEcho = false,
  echoAgeHours = 24,
  isWeakSignal = false,
  tensionDescription = null,
  isHiringSurge = false,
  isMobile = false,
}: BlipNodeProps) {
  const [hovered, setHovered] = useState(false);
  const momentum = Number(competitor.momentum_score ?? 0);

  // "Movement building" — rising momentum with a recent signal (not yet critical)
  const isBuilding =
    momentum >= 3 &&
    momentum < 5 &&
    !!competitor.last_signal_at &&
    Date.now() - new Date(competitor.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  const radius = radiusScale(momentum);
  const { x, y } = gravityPos ?? getNodePosition(index, total, radius);
  const trail = gravityMode ? [] : getTrailPoints(index, radius);
  const color = getMovementColor(competitor.latest_movement_type);
  const nodeSize = getNodeSize(momentum);
  const echoDuration = getMomentumEchoDuration(momentum);
  // Ping brightness scaled by signal recency — fresh nodes flash brighter
  const pingPeak = (momentum >= 5 ? 0.88 : 0.68) * (0.45 + signalAgeGlow * 0.55);

  const ageOpacity = getAgeOpacity(competitor.latest_movement_last_seen_at);
  // Confidence-proportional opacity — low-confidence nodes render subtly subdued
  const conf = Number(competitor.latest_movement_confidence ?? 1.0);
  const confMult = isDimmed || timeDimmed || isSelected ? 1.0 : conf >= 0.65 ? 1.0 : conf >= 0.4 ? 0.88 : 0.75;
  const groupOpacity = (isDimmed ? 0.22 : timeDimmed ? 0.12 : isSelected ? 1.0 : ageOpacity) * confMult;

  // When the beam crosses this blip (seconds into the 12s sweep cycle)
  const sweepDelay = getSweepDelay(x, y);

  return (
    <motion.g
      onClick={() => onSelect(competitor.competitor_id)}
      style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px` }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: groupOpacity, scale: 1 }}
      whileHover={{ scale: 1.12 }}
      transition={{
        default: { duration: 0.18, ease: "easeOut" },
        opacity: { duration: 0.22, ease: "easeOut", delay: index * 0.012 },
        scale:   { duration: 0.2,  ease: "easeOut", delay: index * 0.012 },
      }}
      onHoverStart={() => { setHovered(true); getAudioManager().playBlip(momentum); }}
      onHoverEnd={() => setHovered(false)}
    >
      {/* Trail dots — motion history leading to blip */}
      {trail.map((point, pi) => (
        <circle
          key={pi}
          cx={point.x}
          cy={point.y}
          r={2 + pi * 1}
          fill={color}
          opacity={0.06 + pi * 0.07}
        />
      ))}

      {/* Signal age atmospheric glow — larger + more diffuse in Gravity Mode (influence sphere) */}
      {!isDimmed && !timeDimmed && signalAgeGlow > 0.18 && (
        <circle
          cx={x}
          cy={y}
          r={gravityMode ? nodeSize + 34 : nodeSize + 16}
          fill={color}
          fillOpacity={gravityMode ? signalAgeGlow * 0.12 : signalAgeGlow * 0.08}
          filter={gravityMode ? "url(#gravityGlow)" : "url(#blipGlow)"}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* "Movement building" — signal-age-colored slow-pulse ring for rising competitors */}
      {isBuilding && !isDimmed && !isSelected && !isAlerted && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 18}
          fill="none"
          stroke={ageColor}
          strokeWidth="0.6"
          animate={{ opacity: [0.0, 0.22, 0.0] }}
          transition={{ duration: 4.0, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          style={{ transformOrigin: `${x}px ${y}px`, pointerEvents: "none" }}
        />
      )}

      {/* Unvisited discovery ring — faint white ring for nodes with unseen signals */}
      {isUnvisited && !isDimmed && !isSelected && !isAlerted && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 11}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.5"
          animate={{ opacity: [0.0, 0.18, 0.0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${x}px ${y}px`, pointerEvents: "none" }}
        />
      )}

      {/* Weak signal orbit ring — dashed, lower visual priority than strategic rings */}
      {isWeakSignal && !isDimmed && !isSelected && !isAlerted && (
        <circle
          cx={x}
          cy={y}
          r={nodeSize + 24}
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="0.65"
          strokeDasharray="3 9"
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Activity echo ripple — subtle expanding ring for recent activity */}
      {hasActivityEcho && !isDimmed && !isAlerted && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 6}
          fill="none"
          stroke="#2EE6A6"
          strokeWidth="0.7"
          initial={{ opacity: 0, scale: 1 }}
          animate={{
            scale: [1, 1.55, 2.0],
            opacity: [0, echoAgeHours < 6 ? 0.20 : 0.11, 0],
          }}
          transition={{
            duration: 3.8,
            repeat: Infinity,
            repeatDelay: 14,
            ease: "easeOut",
          }}
          style={{ transformOrigin: `${x}px ${y}px`, pointerEvents: "none" }}
        />
      )}

      {/* Alert state: breathing outer bloom — marks the accelerating competitor */}
      {isAlerted && !isDimmed && !isSelected && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 26}
          fill={color}
          filter="url(#blipGlowStrong)"
          initial={{ opacity: 0.06 }}
          animate={{ opacity: [0.06, 0.18, 0.06], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}
      {isAlerted && !isDimmed && !isSelected && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 14}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* Enlarged transparent hit target */}
      <circle cx={x} cy={y} r={nodeSize + 8} fill="transparent" />

      {/* ── Ping flash (pinged state) ────────────────────────── */}
      {/* Fires once per revolution, timed to beam crossing.
          Hidden on dimmed blips so focus stays on the selected target. */}
      {!isDimmed && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 5}
          fill={color}
          filter="url(#blipGlow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, pingPeak, 0] }}
          transition={{
            duration: PING_DURATION,
            repeat: Infinity,
            repeatDelay: SWEEP_DURATION - PING_DURATION,
            delay: sweepDelay,
            ease: "easeOut",
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* ── Echo ring (cooldown state) ────────────────────────── */}
      {/* Expanding ring that fades after each ping.
          Hidden on dimmed blips. Initial opacity 0 prevents mount burst. */}
      {!isDimmed && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 3}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          initial={{ opacity: 0 }}
          animate={{ scale: [1, 2.4], opacity: [0.65, 0] }}
          transition={{
            duration: echoDuration,
            repeat: Infinity,
            repeatDelay: SWEEP_DURATION - echoDuration,
            delay: sweepDelay + 0.06,
            ease: "easeOut",
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* Sweep memory trail — slow-fading ring after beam crossing, scaled by signal age */}
      {!isDimmed && signalAgeGlow > 0.35 && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 2}
          fill="none"
          stroke={color}
          strokeWidth="0.75"
          initial={{ opacity: 0 }}
          animate={{ scale: [1, 1.85], opacity: [0.28 * signalAgeGlow, 0] }}
          transition={{
            duration: 6.5,
            repeat: Infinity,
            repeatDelay: SWEEP_DURATION - 6.5,
            delay: sweepDelay + 0.80,
            ease: [0.2, 0, 0.8, 1],
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* Momentum state ring — static ambient ring indicating acceleration state */}
      {!isDimmed && !isSelected && momentum >= 5 && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 6}
          fill="none"
          stroke={color}
          strokeWidth="0.75"
          animate={{ opacity: [0.18 * signalAgeGlow, 0.38 * signalAgeGlow, 0.18 * signalAgeGlow] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}
      {!isDimmed && !isSelected && momentum >= 1.5 && momentum < 5 && (
        <circle
          cx={x}
          cy={y}
          r={nodeSize + 6}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          opacity={0.12 * signalAgeGlow}
        />
      )}

      {/* Selected: permanent bloom halo */}
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          r={nodeSize + 22}
          fill={color}
          opacity="0.07"
          filter="url(#blipGlowStrong)"
        />
      )}

      {/* Selected: pulsing inner lock ring */}
      {isSelected && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 7}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: [0.55, 0.9, 0.55], scale: 1 }}
          transition={{
            opacity: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
            scale: { duration: 0.32, ease: "easeOut" },
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* Selected: outer faint ring */}
      {isSelected && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 16}
          fill="none"
          stroke={color}
          strokeWidth="0.75"
          animate={{ opacity: [0.12, 0.28, 0.12] }}
          transition={{
            duration: 3.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.6,
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      {/* Core blip */}
      <motion.circle
        cx={x}
        cy={y}
        r={nodeSize}
        fill={color}
        filter={isSelected ? "url(#blipGlowStrong)" : "url(#blipGlow)"}
        animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />

      {/* Label */}
      <text
        x={x}
        y={y + nodeSize + 14}
        textAnchor="middle"
        fill={
          isSelected
            ? "#f0fff4"
            : hovered
            ? "#d0ead0"
            : isMobile ? "#c8dfc8" : "#b8d0b8"
        }
        fontSize={isMobile ? "15" : "13"}
        fontWeight={isSelected ? "600" : hovered ? "500" : isMobile ? "500" : "400"}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.02em"
        style={{
          filter: isSelected
            ? "drop-shadow(0 0 6px rgba(46,230,166,0.70)) drop-shadow(0 1px 3px rgba(0,0,0,0.98))"
            : hovered
            ? "drop-shadow(0 0 4px rgba(46,230,166,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.98))"
            : "drop-shadow(0 1px 4px rgba(0,0,0,0.99)) drop-shadow(0 0 2px rgba(0,0,0,0.99))",
          pointerEvents: "none",
        }}
      >
        {(() => {
          const name = competitor.competitor_name;
          const maxLen = isMobile ? 10 : 14;
          return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
        })()}
      </text>

      {/* Tension description — shown on hover when strategic tension exists */}
      {hovered && tensionDescription && (
        <text
          x={x}
          y={y + nodeSize + 28}
          textAnchor="middle"
          fill="rgba(148,163,184,0.60)"
          fontSize="9"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.04em"
          style={{
            pointerEvents: "none",
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.98))",
          }}
        >
          {tensionDescription}
        </text>
      )}

      {/* Hiring surge label — shown on hover when hiring activity detected */}
      {hovered && isHiringSurge && (
        <text
          x={x}
          y={y + nodeSize + (tensionDescription ? 40 : 28)}
          textAnchor="middle"
          fill="rgba(196,181,253,0.55)"
          fontSize="9"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.04em"
          style={{
            pointerEvents: "none",
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.98))",
          }}
        >
          Hiring surge detected
        </text>
      )}

      {/* Signal type micro-symbol — tiny semantic shape at blip center */}
      {!isDimmed && !timeDimmed && momentum > 0 && competitor.latest_movement_type && (() => {
        const sw = "rgba(0,0,0,0.52)";
        const s = 2.4;
        switch (competitor.latest_movement_type) {
          case "pricing_strategy_shift":
            return <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={sw} strokeWidth="1.5" strokeLinecap="round" style={{ pointerEvents: "none" }} />;
          case "product_expansion":
            return (
              <g style={{ pointerEvents: "none" }}>
                <line x1={x} y1={y - s} x2={x} y2={y + s} stroke={sw} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={sw} strokeWidth="1.5" strokeLinecap="round" />
              </g>
            );
          case "market_reposition":
            return <path d={`M${x},${y - s} L${x + s},${y} L${x},${y + s} L${x - s},${y} Z`} fill={sw} style={{ pointerEvents: "none" }} />;
          case "enterprise_push":
          case "ecosystem_expansion":
            return <path d={`M${x},${y + s * 0.8} L${x},${y - s * 0.8} M${x - s * 0.7},${y - s * 0.2} L${x},${y - s * 0.8} L${x + s * 0.7},${y - s * 0.2}`} stroke={sw} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ pointerEvents: "none" }} />;
          default:
            return null;
        }
      })()}
    </motion.g>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Radar({
  competitors,
  sector,
  orgId,
}: {
  competitors: RadarCompetitor[];
  sector?: string;
  orgId?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Mobile detection ─────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Cinematic entry sequence ─────────────────────────────────────────────
  // Phase 0: black → Phase 1 (150ms): grid/rings → Phase 2 (350ms): nodes → Phase 3 (600ms): panel
  const [entryPhase, setEntryPhase] = useState(0);
  useEffect(() => {
    capture("command_center_loaded", { competitor_count: competitors.length });
    const t1 = setTimeout(() => setEntryPhase(1), 150);
    const t2 = setTimeout(() => setEntryPhase(2), 350);
    const t3 = setTimeout(() => setEntryPhase(3), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh ─────────────────────────────────────────────────────────
  // Empty radar: refresh every 30s until first blips appear.
  // Active radar: refresh every 60s so new signals surface without page reload.
  useEffect(() => {
    const ms = competitors.length === 0 ? 30_000 : 60_000;
    const interval = setInterval(() => router.refresh(), ms);
    return () => clearInterval(interval);
  }, [competitors.length, router]);

  // ── Critical acceleration alert ──────────────────────────────────────────
  const criticalAlert: CriticalAlert | null = useMemo(
    () => detectCriticalAlert(competitors, orgId),
    [competitors]
  );

  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    if (!criticalAlert) return;
    const storageKey = `alert_dismissed__${criticalAlert.alertKey}`;
    const alreadyDismissed = sessionStorage.getItem(storageKey) === "1";
    if (alreadyDismissed) {
      setAlertDismissed(true);
      return;
    }
    setAlertDismissed(false);
    getAudioManager().play("alert");
    capture("critical_alert_triggered", {
      competitor_id:   criticalAlert.competitor_id,
      competitor_name: criticalAlert.competitor_name,
      movement_type:   criticalAlert.movement_type,
      momentum_score:  criticalAlert.momentum_score,
    });
    capture("critical_alert_opened", {
      competitor_id:  criticalAlert.competitor_id,
      movement_type:  criticalAlert.movement_type,
    });
  // alertKey changes only when the underlying movement event changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criticalAlert?.alertKey]);

  const alertActive = criticalAlert !== null && !alertDismissed;

  function handleAlertDismiss() {
    if (!criticalAlert) return;
    sessionStorage.setItem(`alert_dismissed__${criticalAlert.alertKey}`, "1");
    setAlertDismissed(true);
  }

  function handleStrategyNav() {
    if (!criticalAlert) return;
    capture("critical_alert_to_strategy_clicked", {
      competitor_id:  criticalAlert.competitor_id,
      movement_type:  criticalAlert.movement_type,
      momentum_score: criticalAlert.momentum_score,
    });
    const params = new URLSearchParams({
      alert: "1",
      cid:   criticalAlert.competitor_id,
      cname: criticalAlert.competitor_name,
      move:  criticalAlert.movement_type,
      conf:  criticalAlert.confidence.toFixed(2),
    });
    router.push(`/app/strategy?${params.toString()}`);
  }

  const sorted = useMemo(
    () => sortCompetitors(competitors).slice(0, 50),
    [competitors]
  );

  // Zero-node diagnostic: if the server passed N > 0 competitors but sorted is empty,
  // that indicates a sortCompetitors/slice bug — log once per competitors change.
  useEffect(() => {
    if (competitors.length > 0 && sorted.length === 0) {
      console.warn("[radar] zero nodes rendered despite receiving", competitors.length, "competitors from API");
    }
  }, [competitors.length, sorted.length]);

  const radiusScale = useMemo(() => {
    const maxMomentum = Math.max(
      ...sorted.map((c) => Number(c.momentum_score ?? 0)),
      1
    );
    return scaleLinear().domain([0, maxMomentum]).range([68, OUTER_RADIUS]);
  }, [sorted]);

  // ── Activity Echo + Weak Signal derivation ───────────────────────────────
  // Both are derived from existing RadarCompetitor data — no new fetch required.
  const activityEchoMap = useMemo(() => deriveActivityEchoes(sorted), [sorted]);
  const weakSignalSet   = useMemo(
    () => new Set(sorted.filter(getIsWeakSignal).map((c) => c.competitor_id)),
    [sorted]
  );
  const hiringSurgeSet  = useMemo(
    () => new Set(sorted.filter(detectHiringSurge).map((c) => c.competitor_id)),
    [sorted]
  );

  // ── Pressure Index ───────────────────────────────────────────────────────
  const pressureState = useMemo(() => computePressureIndex(sorted), [sorted]);

  // ── Micro Insights ───────────────────────────────────────────────────────
  const insights = useMemo(() => generateMicroInsights(sorted), [sorted]);
  const [insightIndex, setInsightIndex] = useState(0);
  const [insightVisible, setInsightVisible] = useState(true);
  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setInsightVisible(false);
      setTimeout(() => {
        setInsightIndex((prev) => (prev + 1) % insights.length);
        setInsightVisible(true);
      }, 400);
    }, 9000);
    return () => clearInterval(id);
  }, [insights.length]);
  const currentInsight = insights[insightIndex] ?? null;

  // ── Strategic Tension ────────────────────────────────────────────────────
  // Deterministic: requires shared movement_type + momentum ≥ 1.5 on both nodes.
  // Memoized — recomputed only when sorted set changes.
  const tensionLinks = useMemo(() => computeTensionLinks(sorted), [sorted]);

  // Per-node tension description string — passed as stable string prop to BlipNode
  // to avoid passing the full array (which would defeat memo equality checks).
  const tensionDescriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of sorted) {
      const desc = getTensionDescription(
        c.competitor_id,
        tensionLinks,
        c.latest_movement_type
      );
      if (desc) map.set(c.competitor_id, desc);
    }
    return map;
  }, [sorted, tensionLinks]);

  // ── Gravity Field mode ───────────────────────────────────────────────────
  const [gravityMode, setGravityMode] = useState(false);

  // Positions are computed once per sorted set — memoized, deterministic, ~1ms
  const gravityPositions = useMemo(
    () => computeGravityPositions(sorted),
    [sorted],
  );

  // Cluster groups: movement_type buckets with ≥2 nodes for halo rendering
  type GravityCluster = { type: string; color: string; label: string; nodes: Point[] };
  const gravityGroups = useMemo((): GravityCluster[] => {
    if (!gravityMode || gravityPositions.size === 0) return [];
    const map = new Map<string, GravityCluster>();
    for (const c of sorted) {
      const type = c.latest_movement_type;
      if (!type) continue;
      const pos = gravityPositions.get(c.competitor_id);
      if (!pos) continue;
      if (!map.has(type)) {
        map.set(type, {
          type,
          color: getMovementColor(type),
          label: getClusterLabel(type),
          nodes: [],
        });
      }
      map.get(type)!.nodes.push(pos);
    }
    return [...map.values()].filter((g) => g.nodes.length >= 2);
  }, [gravityMode, gravityPositions, sorted]);

  // Standard-mode node positions: same layout as golden-spiral, precomputed for pressure zones
  const standardPositions = useMemo((): Map<string, Point> => {
    const map = new Map<string, Point>();
    sorted.forEach((c, i) => {
      const pos = getNodePosition(i, sorted.length, radiusScale(Number(c.momentum_score ?? 0)));
      map.set(c.competitor_id, pos);
    });
    return map;
  }, [sorted, radiusScale]);

  // Pressure zones: movement-type clusters with 2+ nodes in standard mode
  const pressureZones = useMemo(() => {
    if (gravityMode) return [];
    const map = new Map<string, { color: string; label: string; positions: Point[]; movementType: string }>();
    for (const c of sorted) {
      const type = c.latest_movement_type;
      if (!type) continue;
      const pos = standardPositions.get(c.competitor_id);
      if (!pos) continue;
      if (!map.has(type)) {
        map.set(type, { color: getMovementColor(type), label: getTrajectoryLabel(type), positions: [], movementType: type });
      }
      map.get(type)!.positions.push(pos);
    }
    return [...map.values()].filter((z) => z.positions.length >= 2);
  }, [gravityMode, sorted, standardPositions]);

  // Radar synergy: focus a competitor from briefs/strategy via localStorage key mv_radar_focus
  const radarFocusApplied = useRef(false);
  useEffect(() => {
    if (radarFocusApplied.current || sorted.length === 0) return;
    const focusName = localStorage.getItem("mv_radar_focus");
    if (!focusName) return;
    const match = sorted.find(
      (c) => c.competitor_name.toLowerCase() === focusName.toLowerCase()
    );
    if (match) {
      setSelectedId(match.competitor_id);
      localStorage.removeItem("mv_radar_focus");
      radarFocusApplied.current = true;
    }
  }, [sorted]);

  // ── Sound toggle (radar-level quick access) ──────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(false);
  useEffect(() => { setSoundEnabled(getAudioManager().isEnabled); }, []);
  const handleSoundToggle = useCallback(() => {
    const next = getAudioManager().toggle();
    setSoundEnabled(next);
    if (next) getAudioManager().play("blip");
  }, []);

  // ── Isolation + zoom + pan ───────────────────────────────────────────────
  const [isolated, setIsolated] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [temporalFilter, setTemporalFilter] = useState<"24h" | "7d" | "all">("all");
  const zoomCanvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ screenX: 0, screenY: 0, panX: 0, panY: 0 });
  const touchDistRef = useRef(0);

  // Reset view and temporal filter when exiting isolation
  useEffect(() => {
    if (!isolated) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setTemporalFilter("all");
    }
  }, [isolated]);

  // ESC exits isolation mode or closes the intelligence report
  useEffect(() => {
    if (!isolated && !selectedId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedId) setSelectedId(null);
        else setIsolated(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isolated, selectedId]);

  // Non-passive wheel zoom + non-passive touchmove for pinch
  useEffect(() => {
    const el = zoomCanvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((prev) => Math.max(0.4, Math.min(6, prev * factor)));
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      setIsPanning(true);
      panStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [zoom, pan],
  );

  const handlePanMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = (e.clientX - panStartRef.current.screenX) / zoom;
      const dy = (e.clientY - panStartRef.current.screenY) / zoom;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    },
    [isPanning, zoom],
  );

  const handlePanEnd = useCallback(() => setIsPanning(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistRef.current > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setZoom((prev) => Math.max(0.4, Math.min(6, prev * (dist / touchDistRef.current))));
      touchDistRef.current = dist;
    }
  }, []);

  // Temporal filter: set of competitor IDs with no signal in the active window
  const timeDimmedSet = useMemo(() => {
    if (temporalFilter === "all") return new Set<string>();
    const cutoff =
      temporalFilter === "24h"
        ? Date.now() - 24 * 60 * 60 * 1000
        : Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(
      sorted
        .filter(
          (c) => !c.last_signal_at || new Date(c.last_signal_at).getTime() < cutoff,
        )
        .map((c) => c.competitor_id),
    );
  }, [temporalFilter, sorted]);

  const selected = selectedId
    ? (sorted.find((c) => c.competitor_id === selectedId) ?? null)
    : null;

  // Highest momentum in the current sorted set — used to scale contact list bars.
  const maxMomentum = useMemo(
    () => Math.max(...sorted.map((c) => Number(c.momentum_score ?? 0)), 1),
    [sorted]
  );

  // How many contacts have active momentum — used for quiet-state messaging.
  const movingCount = useMemo(
    () => sorted.filter((c) => Number(c.momentum_score ?? 0) > 0).length,
    [sorted]
  );

  // Latest signal timestamp — drives pipeline heartbeat freshness indicator
  const latestSignalAt = useMemo(
    () => sorted.reduce<string | null>((latest, c) => {
      if (!c.last_signal_at) return latest;
      if (!latest) return c.last_signal_at;
      return c.last_signal_at > latest ? c.last_signal_at : latest;
    }, null),
    [sorted]
  );

  const tickerItems = useMemo(
    () =>
      sorted
        .filter((c) => c.latest_movement_type)
        .map((c) => ({
          name: c.competitor_name,
          label: translateMovementType(c.latest_movement_type, sector),
          date: formatDate(c.latest_movement_last_seen_at),
        })),
    [sorted]
  );

  // Track which competitor nodes have been opened this session (for unvisited glow)
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => new Set());

  const handleBlipClick = useCallback((id: string) => {
    getAudioManager().play("echo");
    setVisitedIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    setSelectedId((prev) => {
      if (prev !== id) {
        capture("competitor_selected", { competitor_id: id });
        capture("radar_node_activated", { competitor_id: id });
      }
      return prev === id ? null : id;
    });
  }, []);

  // ── Bottom sheet state (mobile) ─────────────────────────────────────────
  // peek = competitor name only, half = evidence + assessment, full = all
  const [sheetState, setSheetState] = useState<"peek" | "half" | "full">("half");
  const sheetTouchStartY = useRef(0);
  useEffect(() => { if (selectedId) setSheetState("half"); }, [selectedId]);

  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    sheetTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleSheetTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - sheetTouchStartY.current;
    if (Math.abs(dy) < 24) return;
    if (dy > 48) {
      if (sheetState === "full") setSheetState("half");
      else if (sheetState === "half") setSheetState("peek");
      else setSelectedId(null);
    } else if (dy < -48) {
      if (sheetState === "peek") setSheetState("half");
      else if (sheetState === "half") setSheetState("full");
    }
  }, [sheetState]);

  // ── Magnetic node selection (mobile) ────────────────────────────────────
  // Maps a screen touch to the nearest node within a 60px snap radius.
  // Uses SVG coordinate transform so zoom/pan are accounted for automatically.
  const handleSvgTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!isMobile || e.changedTouches.length !== 1) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const touch = e.changedTouches[0];
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const pt = svgEl.createSVGPoint();
    pt.x = touch.clientX;
    pt.y = touch.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    // 60 screen-px snap radius → SVG coordinate space
    const snapRadius = 60 / ctm.a;
    let nearest: string | null = null;
    let nearestDist = Infinity;
    const positions = gravityMode ? gravityPositions : standardPositions;
    for (const [id, pos] of positions) {
      const dist = Math.sqrt((svgPt.x - pos.x) ** 2 + (svgPt.y - pos.y) ** 2);
      if (dist < snapRadius && dist < nearestDist) {
        nearest = id;
        nearestDist = dist;
      }
    }
    if (nearest) {
      e.preventDefault();
      handleBlipClick(nearest);
    }
  }, [isMobile, gravityMode, gravityPositions, standardPositions, handleBlipClick]);

  const [detail, setDetail] = useState<CompetitorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  // Remove-competitor flow
  const [removeConfirming, setRemoveConfirming] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Primary signal — highest urgency first, recency as tiebreak.
  // Drives Assessment, Recommended action, header badges, and confidence bar.
  const primarySignal = useMemo(() => {
    if (!detail?.signals || detail.signals.length === 0) return null;
    return [...detail.signals].sort(
      (a, b) =>
        (b.urgency ?? 0) - (a.urgency ?? 0) ||
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    )[0] ?? null;
  }, [detail]);

  // Evidence chain — same sort applied to all signals.
  const sortedSignals = useMemo(() => {
    if (!detail?.signals || detail.signals.length === 0) return [];
    return [...detail.signals].sort(
      (a, b) =>
        (b.urgency ?? 0) - (a.urgency ?? 0) ||
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    );
  }, [detail]);

  // Interpretation confidence — prefer primary signal value, fall back to movement-level.
  const interpretationConf = useMemo(() => {
    if (detailLoading) return null;
    if (primarySignal?.confidence != null) return primarySignal.confidence;
    return selected?.latest_movement_confidence ?? null;
  }, [detailLoading, primarySignal, selected]);

  useEffect(() => {
    // Reset remove state on selection change
    setRemoveConfirming(false);
    setRemoveLoading(false);
    setRemoveError(null);

    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError(false);
      return;
    }
    setDetailLoading(true);
    setDetail(null);
    setDetailError(false);
    fetch(`/api/competitor-detail?id=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((json) => {
        // Backend returns { competitor, movements, signals, monitoredPages } — no `ok` field.
        // Accept if either explicit ok: true OR the expected data shape is present.
        if (json.ok || json.competitor) {
          setDetail(json);
          capture("competitor_detail_opened", { competitor_id: selectedId });
          capture("signal_reveal", { competitor_id: selectedId, signal_count: json.signals?.length ?? 0 });
        } else {
          setDetailError(true);
        }
      })
      .catch(() => setDetailError(true))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  async function handleRemoveConfirmed(websiteUrl: string) {
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      const res = await fetch("/api/discover/untrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Removal failed");
      }
      setSelectedId(null);
      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove competitor");
      setRemoveLoading(false);
      setRemoveConfirming(false);
    }
  }

  return (
    <div className="grid h-full gap-3 grid-cols-1 md:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]">
      {/* ── Radar panel ─────────────────────────────────────────── */}
      <section
        className={`flex min-h-0 flex-1 flex-col overflow-hidden${isolated ? "" : " rounded-[20px]"}`}
        style={{
          background: "#000000",
          border: `1px solid ${gravityMode ? "#1a1040" : "#0d2010"}`,
          boxShadow: gravityMode
            ? "inset 0 1px 0 0 rgba(129,140,248,0.06), 0 0 80px rgba(0,0,0,0.95), 0 0 140px rgba(76,29,149,0.07)"
            : "inset 0 1px 0 0 rgba(46,230,166,0.08), 0 0 80px rgba(0,0,0,0.9)",
          transition: "border-radius 0.2s ease, border-color 0.8s ease, box-shadow 0.8s ease",
          ...(isolated
            ? { position: "fixed", inset: 0, zIndex: 50, borderRadius: 0 }
            : {}),
        }}
      >
          {/* ── Market Activity panel ────────────────────────────── */}
          <div
            className="shrink-0 px-5 py-3"
            style={{
              borderBottom: `1px solid ${gravityMode ? "#150f30" : "#0a1c0a"}`,
              opacity: entryPhase >= 1 ? 1 : 0,
              transition: "border-color 0.8s ease, opacity 0.5s ease",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left: sector label + signal count */}
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Sector</div>
                  <div className="mt-0.5 text-[13px] font-semibold text-slate-200">
                    {getSectorLabel(sector)}
                  </div>
                </div>
                <div className="h-7 w-px bg-[#0e2210]" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Signals</div>
                  <div
                    className="mt-0.5 text-[13px] font-semibold tabular-nums"
                    style={{ color: sorted.reduce((s, c) => s + (c.signals_7d ?? 0), 0) > 0 ? "#2EE6A6" : "#475569" }}
                  >
                    {sorted.reduce((s, c) => s + (c.signals_7d ?? 0), 0)}
                  </div>
                </div>
                {sorted.length > 0 && (
                  <>
                    <div className="h-7 w-px bg-[#0e2210]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Most Active</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-slate-200">
                        {sorted[0].competitor_name}
                      </div>
                    </div>
                  </>
                )}
                <div className="h-7 w-px bg-[#0e2210]" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Pressure</div>
                  <div
                    className="mt-0.5 text-[13px] font-semibold"
                    style={{ color: pressureState.color }}
                  >
                    {pressureState.label}
                  </div>
                </div>
              </div>
              {/* Right: mode toggle + latest change */}
              <div className="flex items-center gap-4">
                {/* Radar mode toggle: Standard / Gravity Field */}
                <div
                  className="flex items-center gap-0.5 rounded-[8px] p-0.5"
                  style={{
                    background: gravityMode ? "#07051a" : "#020602",
                    border: `1px solid ${gravityMode ? "#1e1545" : "#0e2210"}`,
                    transition: "background 0.8s ease, border-color 0.8s ease",
                  }}
                >
                  <button
                    onClick={() => { if (gravityMode) { setGravityMode(false); getAudioManager().play("gravity-exit"); } }}
                    className="rounded-[6px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: !gravityMode ? "rgba(46,230,166,0.09)" : "transparent",
                      color: !gravityMode ? "#2EE6A6" : gravityMode ? G.dim : "#3a5a3a",
                      boxShadow: !gravityMode ? "inset 0 0 0 1px rgba(46,230,166,0.18)" : "none",
                      transition: "color 0.6s ease, background 0.6s ease",
                    }}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => { if (!gravityMode) { setGravityMode(true); getAudioManager().play("gravity-enter"); } }}
                    className="rounded-[6px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: gravityMode ? "rgba(129,140,248,0.12)" : "transparent",
                      color: gravityMode ? G.primary : "#3a5a3a",
                      boxShadow: gravityMode ? `inset 0 0 0 1px rgba(129,140,248,0.28)` : "none",
                      transition: "color 0.6s ease, background 0.6s ease, box-shadow 0.6s ease",
                    }}
                  >
                    Gravity Field
                  </button>
                </div>

                {/* Latest change */}
                {(() => {
                  const latestMover = latestSignalAt
                    ? sorted.find((c) => c.last_signal_at === latestSignalAt) ?? null
                    : null;
                  return latestSignalAt ? (
                    <div className="hidden text-right md:block">
                      <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Latest Change</div>
                      <div className="mt-0.5 text-[12px] text-slate-400">
                        {latestMover && (
                          <span className="text-slate-300">{latestMover.competitor_name} · </span>
                        )}
                        {formatRelative(latestSignalAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="hidden text-right md:block">
                      <div className="text-[10px] uppercase tracking-[0.26em] text-slate-600">Status</div>
                      <div className="mt-0.5 text-[12px] text-slate-500">Scanning…</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <div
            ref={zoomCanvasRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            style={{ opacity: entryPhase >= 1 ? 1 : 0, transition: "opacity 0.5s ease" }}
          >
            {/* ── Zoom + pan canvas ──────────────────────────────────── */}
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 0.18s ease-out",
                cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
                willChange: "transform",
              }}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handlePanEnd}
            >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="xMidYMid meet"
              className="block"
              role="img"
              aria-label="Competitor radar"
              onTouchEnd={handleSvgTouchEnd}
            >
              <defs>
                {/* Central atmospheric glow */}
                <radialGradient id="radarCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
                  <stop offset="30%" stopColor="#22c55e" stopOpacity="0.09" />
                  <stop offset="65%" stopColor="#22c55e" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </radialGradient>

                {/* Edge vignette — atmospheric depth at perimeter */}
                <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
                  <stop offset="52%" stopColor="#000000" stopOpacity="0" />
                  <stop offset="80%" stopColor="#000000" stopOpacity="0.72" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.96" />
                </radialGradient>

                {/* Blip soft glow */}
                <filter
                  id="blipGlow"
                  x="-200%"
                  y="-200%"
                  width="500%"
                  height="500%"
                >
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Blip strong glow — selected state */}
                <filter
                  id="blipGlowStrong"
                  x="-200%"
                  y="-200%"
                  width="500%"
                  height="500%"
                >
                  <feGaussianBlur stdDeviation="18" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Sonar ring glow — thick luminous pulse rings */}
                <filter
                  id="sonarGlow"
                  x="-60%"
                  y="-60%"
                  width="220%"
                  height="220%"
                >
                  <feGaussianBlur stdDeviation="9" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Subtle green panel sheen */}
                <linearGradient
                  id="panelSheen"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#14532d" stopOpacity="0.01" />
                </linearGradient>

                {/* Gravity Mode: deep violet atmospheric core */}
                <radialGradient id="radarCoreGravity" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.30" />
                  <stop offset="28%"  stopColor="#4f46e5" stopOpacity="0.13" />
                  <stop offset="62%"  stopColor="#3730a3" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
                </radialGradient>

                {/* Gravity Mode: violet panel sheen */}
                <linearGradient id="panelSheenGravity" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#4c1d95" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.02" />
                </linearGradient>

                {/* Gravity glow — wider spread for field-wave effect */}
                <filter id="gravityGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="16" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Glass highlight — extremely faint surface reflection, instrument depth */}
                <radialGradient id="glassHighlight" cx="38%" cy="26%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.030" />
                  <stop offset="55%" stopColor="#ffffff" stopOpacity="0.008" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>

                {/* Hard circular clip — enforces a clean instrument boundary */}
                <clipPath id="radarClip">
                  <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} />
                </clipPath>
              </defs>

              {/* All radar content clipped to a perfect circle */}
              <g clipPath="url(#radarClip)">

              {/* Base field — shifts from black-green to black-violet in Gravity Mode */}
              <rect
                x="0"
                y="0"
                width={SIZE}
                height={SIZE}
                fill={gravityMode ? G.bg : "#010201"}
                style={{ transition: "fill 0.9s ease" }}
              />

              {/* Panel sheen — green in Standard, violet in Gravity */}
              <rect
                x="0" y="0" width={SIZE} height={SIZE}
                fill="url(#panelSheen)"
                style={{ opacity: gravityMode ? 0.08 : 0.6, transition: "opacity 0.9s ease" }}
              />
              <rect
                x="0" y="0" width={SIZE} height={SIZE}
                fill="url(#panelSheenGravity)"
                style={{ opacity: gravityMode ? 0.55 : 0, transition: "opacity 0.9s ease" }}
              />

              {/* Central atmospheric glow — cross-fades between scan-green and gravity-violet */}
              <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="url(#radarCore)"
                style={{ opacity: gravityMode ? 0 : 1, transition: "opacity 0.9s ease" }}
              />
              <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="url(#radarCoreGravity)"
                style={{ opacity: gravityMode ? 1 : 0, transition: "opacity 0.9s ease" }}
              />

              {/* ── Rotating grid layer — rings, crosshairs, ticks ─── */}
              {/* 360° per 120s = near-imperceptible motion. Creates the
                  sense of a live scanning instrument without visual noise. */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              >

                {/* ── Range rings ──────────────────────────────────── */}
                {RING_FACTORS.map((factor) => (
                  <circle
                    key={factor}
                    cx={CENTER}
                    cy={CENTER}
                    r={OUTER_RADIUS * factor}
                    fill="none"
                    stroke={gravityMode ? G.ring : "#0f3d20"}
                    strokeWidth="1.5"
                    opacity={factor <= 0.3 ? 0.88 : factor <= 0.6 ? 0.70 : factor <= 0.9 ? 0.50 : 0.35}
                    style={{ transition: "stroke 0.8s ease, opacity 0.8s ease" }}
                  />
                ))}

                {/* ── Crosshair lines ───────────────────────────────── */}
                {[0, 45, 90, 135].map((deg) => {
                  const radians = (deg * Math.PI) / 180;
                  const dx = Math.cos(radians) * OUTER_RADIUS;
                  const dy = Math.sin(radians) * OUTER_RADIUS;
                  return (
                    <line
                      key={deg}
                      x1={CENTER - dx}
                      y1={CENTER - dy}
                      x2={CENTER + dx}
                      y2={CENTER + dy}
                      stroke={gravityMode ? G.ring : "#0f3d20"}
                      strokeWidth="1"
                      opacity="0.65"
                      style={{ transition: "stroke 0.8s ease" }}
                    />
                  );
                })}

                {/* ── Perimeter tick marks ──────────────────────────── */}
                {TICK_MARKS.map((tick, i) => (
                  <line
                    key={i}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke={gravityMode ? G.ring : "#0f3d20"}
                    strokeWidth={tick.isMajor ? 1.5 : tick.isMedium ? 1.0 : 0.7}
                    opacity={tick.isMajor ? 0.90 : tick.isMedium ? 0.60 : 0.35}
                    style={{ transition: "stroke 0.8s ease" }}
                  />
                ))}

              </motion.g>

              {/* Cardinal labels rendered outside clip (see below) */}

              {/* ── Sonar pulse field — Standard Mode (fades out in Gravity) ── */}
              <g style={{ opacity: gravityMode ? 0 : 1, transition: "opacity 1.0s ease", pointerEvents: "none" }}>
                {[0, 1].map((i) => (
                  <motion.circle
                    key={`sonar-main-${i}`}
                    cx={CENTER} cy={CENTER} r={OUTER_RADIUS}
                    fill="none" stroke="#22c55e" strokeWidth="5"
                    filter="url(#sonarGlow)"
                    initial={{ scale: 0.08, opacity: 1.0 }}
                    animate={{ scale: 1.0, opacity: 0 }}
                    transition={{ duration: 16, repeat: Infinity, ease: [0.2, 0, 0.6, 1], delay: i * 8 }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}
                {[0, 1].map((i) => (
                  <motion.circle
                    key={`sonar-echo-${i}`}
                    cx={CENTER} cy={CENTER} r={OUTER_RADIUS}
                    fill="none" stroke="#2EE6A6" strokeWidth="2.5"
                    filter="url(#sonarGlow)"
                    initial={{ scale: 0.08, opacity: 0.5 }}
                    animate={{ scale: 1.0, opacity: 0 }}
                    transition={{ duration: 30, repeat: Infinity, ease: [0.2, 0, 0.6, 1], delay: i * 15 + 7 }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}
                <motion.circle
                  cx={CENTER} cy={CENTER} r={OUTER_RADIUS * 0.14}
                  fill="none" stroke="#22c55e" strokeWidth="1.2"
                  initial={{ scale: 0.12, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeOut" }}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                />
              </g>

              {/* ── Gravity field propagation — slow, heavy, deep (fades in in Gravity Mode) ── */}
              <g style={{ opacity: gravityMode ? 1 : 0, transition: "opacity 1.0s ease", pointerEvents: "none" }}>
                {/* Primary field waves — slower than sonar, heavy gravitational cadence */}
                {[0, 1].map((i) => (
                  <motion.circle
                    key={`grav-pulse-${i}`}
                    cx={CENTER} cy={CENTER} r={OUTER_RADIUS}
                    fill="none" stroke={G.glow} strokeWidth="4"
                    filter="url(#gravityGlow)"
                    initial={{ scale: 0.08, opacity: 0.75 }}
                    animate={{ scale: 1.0, opacity: 0 }}
                    transition={{ duration: 22, repeat: Infinity, ease: [0.1, 0, 0.4, 1], delay: i * 11 }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}
                {/* Field echo — thinner, even slower */}
                {[0, 1].map((i) => (
                  <motion.circle
                    key={`grav-echo-${i}`}
                    cx={CENTER} cy={CENTER} r={OUTER_RADIUS}
                    fill="none" stroke={G.primary} strokeWidth="2"
                    filter="url(#gravityGlow)"
                    initial={{ scale: 0.08, opacity: 0.40 }}
                    animate={{ scale: 1.0, opacity: 0 }}
                    transition={{ duration: 38, repeat: Infinity, ease: [0.1, 0, 0.4, 1], delay: i * 19 + 9 }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}
                {/* Inner field emitter */}
                <motion.circle
                  cx={CENTER} cy={CENTER} r={OUTER_RADIUS * 0.14}
                  fill="none" stroke={G.coreLt} strokeWidth="1.0"
                  initial={{ scale: 0.12, opacity: 0.45 }}
                  animate={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeOut" }}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                />
              </g>

              {/* Center atmospheric fill — cross-fades on mode switch */}
              <circle cx={CENTER} cy={CENTER} r={44} fill="url(#radarCore)"
                style={{ opacity: gravityMode ? 0 : 0.95, transition: "opacity 0.9s ease" }}
              />
              <circle cx={CENTER} cy={CENTER} r={44} fill="url(#radarCoreGravity)"
                style={{ opacity: gravityMode ? 0.95 : 0, transition: "opacity 0.9s ease" }}
              />

              {/* Emitter bloom — shifts to violet singularity in Gravity Mode */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={30}
                fill={gravityMode ? G.core : "#2EE6A6"}
                opacity={gravityMode ? 0.22 : 0.14}
                filter={gravityMode ? "url(#gravityGlow)" : "url(#blipGlowStrong)"}
                style={{ transition: "opacity 0.8s ease" }}
              />

              {/* Breathing emitter dot */}
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={7}
                fill={gravityMode ? G.dot : "#dcfce7"}
                filter="url(#blipGlow)"
                animate={{ opacity: [1.0, 0.55, 1.0], scale: [1, 1.18, 1] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              />

              {/* Hard center point */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={3}
                fill={gravityMode ? "#e0d7ff" : "#ffffff"}
                opacity="0.98"
                style={{ transition: "fill 0.8s ease" }}
              />

              {/* ── Gravity Field layers — cluster halos + relationship lines ── */}
              {gravityMode && (
                <g style={{ opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.55s ease" }}>
                  {/* ── Gravity Well ─────────────────────────────────────────── */}
                  {/* Concentric rotating field-rings — simulate gravitational contours */}
                  {([180, 130, 85, 48] as const).map((r, i) => (
                    <motion.circle
                      key={`well-ring-${i}`}
                      cx={500} cy={500} r={r}
                      fill="none"
                      stroke={G.primary}
                      strokeWidth={0.7 - i * 0.12}
                      strokeOpacity={0.07 + i * 0.045}
                      strokeDasharray={`${3 + i} ${14 - i * 2}`}
                      animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                      transition={{ duration: 44 - i * 7, repeat: Infinity, ease: "linear" }}
                      style={{ transformOrigin: "500px 500px" }}
                    />
                  ))}
                  {/* Outer diffuse fill — gravitational influence zone */}
                  <circle cx={500} cy={500} r={32}
                    fill={G.core} fillOpacity={0.15}
                    stroke={G.primary} strokeWidth={1.0} strokeOpacity={0.35}
                  />
                  {/* Pulsing attractor ring */}
                  <motion.circle
                    cx={500} cy={500} r={32}
                    fill="none"
                    stroke={G.coreLt} strokeWidth={1.2} strokeOpacity={0.55}
                    animate={{ scale: [1, 1.14, 1] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ transformOrigin: "500px 500px" }}
                  />
                  {/* Singularity core */}
                  <circle cx={500} cy={500} r={12}
                    fill={G.core} fillOpacity={0.65}
                    filter="url(#gravityGlow)"
                  />
                  <circle cx={500} cy={500} r={5} fill={G.dot} fillOpacity={0.95} />

                  {/* Cluster halos — soft field around each movement-type group */}
                  {gravityGroups.map(({ type, color, label, nodes }) => {
                    const cx = nodes.reduce((s, p) => s + p.x, 0) / nodes.length;
                    const cy = nodes.reduce((s, p) => s + p.y, 0) / nodes.length;
                    const maxR = Math.max(
                      ...nodes.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)),
                    ) + 36;
                    return (
                      <g key={`halo-${type}`} style={{ pointerEvents: "none" }}>
                        {/* Outer diffuse boundary — gravitational influence fringe */}
                        <circle
                          cx={cx} cy={cy} r={maxR + 28}
                          fill={color} fillOpacity={0.02}
                          stroke={color} strokeWidth={0.5} strokeOpacity={0.07}
                          strokeDasharray="2 14"
                        />
                        {/* Main cluster halo */}
                        <circle
                          cx={cx} cy={cy} r={maxR}
                          fill={color} fillOpacity={0.10}
                          stroke={color} strokeWidth={1.4} strokeOpacity={0.40}
                          strokeDasharray="4 5"
                          filter="url(#blipGlow)"
                        />
                        {/* Inner pressure core */}
                        <circle
                          cx={cx} cy={cy} r={maxR * 0.55}
                          fill={color} fillOpacity={0.05}
                          stroke="none"
                        />
                        {/* Cluster label — brighter, monospace, legible */}
                        <text
                          x={cx} y={cy - maxR - 11}
                          textAnchor="middle"
                          fill={color}
                          fontSize="9"
                          opacity={0.65}
                          letterSpacing="0.18em"
                          fontFamily="ui-monospace, 'Courier New', monospace"
                          fontWeight="700"
                        >
                          {label}
                        </text>
                        <text
                          x={cx} y={cy - maxR - 1}
                          textAnchor="middle"
                          fill={color}
                          fontSize="7"
                          opacity={0.28}
                          letterSpacing="0.10em"
                          fontFamily="ui-monospace, monospace"
                        >
                          {nodes.length} RIVALS
                        </text>
                      </g>
                    );
                  })}

                  {/* ── Tension filaments — ambient strategic tension between converging nodes ── */}
                  {/* Rendered as faint dashed lines. Opacity + dash density encode intensity.  */}
                  {/* No SVG filter applied to the group to preserve GPU performance.           */}
                  {tensionLinks.length > 0 && (
                    <g style={{ pointerEvents: "none" }}>
                      {tensionLinks.map((link) => {
                        const posA = gravityPositions.get(link.idA);
                        const posB = gravityPositions.get(link.idB);
                        if (!posA || !posB) return null;
                        const color      = getMovementColor(link.movementType);
                        const opacity    = link.intensity * 0.30;
                        const w          = 0.4 + link.intensity * 0.7;
                        const gap        = link.intensity > 0.80 ? 5
                                         : link.intensity > 0.65 ? 8
                                         : 12;
                        return (
                          <line
                            key={`t-${link.idA}-${link.idB}`}
                            x1={posA.x} y1={posA.y}
                            x2={posB.x} y2={posB.y}
                            stroke={color}
                            strokeWidth={w}
                            strokeOpacity={opacity}
                            strokeDasharray={`1.5 ${gap}`}
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* Relationship lines — selected node to same-type peers */}
                  {selected && (() => {
                    const selPos = gravityPositions.get(selected.competitor_id);
                    if (!selPos || !selected.latest_movement_type) return null;
                    const relColor = getMovementColor(selected.latest_movement_type);
                    return sorted
                      .filter(
                        (c) =>
                          c.competitor_id !== selected.competitor_id &&
                          c.latest_movement_type === selected.latest_movement_type,
                      )
                      .map((c) => {
                        const pos = gravityPositions.get(c.competitor_id);
                        if (!pos) return null;
                        return (
                          <line
                            key={`rel-${c.competitor_id}`}
                            x1={selPos.x} y1={selPos.y}
                            x2={pos.x} y2={pos.y}
                            stroke={relColor}
                            strokeWidth={1.5}
                            strokeOpacity={0.40}
                            strokeDasharray="4 6"
                            style={{ pointerEvents: "none", filter: `drop-shadow(0 0 3px ${relColor}55)` }}
                          />
                        );
                      });
                  })()}

                  {/* Relationship summary — badge above selected node */}
                  {selected && (() => {
                    const selPos = gravityPositions.get(selected.competitor_id);
                    if (!selPos || !selected.latest_movement_type) return null;
                    const relCount = sorted.filter(
                      (c) =>
                        c.competitor_id !== selected.competitor_id &&
                        c.latest_movement_type === selected.latest_movement_type,
                    ).length;
                    if (relCount === 0) return null;
                    const relColor = getMovementColor(selected.latest_movement_type);
                    const label = getMovementLabel(selected.latest_movement_type);
                    const nodeR = getNodeSize(Number(selected.momentum_score ?? 0));
                    return (
                      <text
                        x={selPos.x}
                        y={selPos.y - nodeR - 22}
                        textAnchor="middle"
                        fill={relColor}
                        fontSize="9"
                        opacity={0.55}
                        letterSpacing="0.06em"
                        fontFamily="Inter, system-ui, sans-serif"
                        style={{ pointerEvents: "none" }}
                      >
                        {relCount} rival{relCount !== 1 ? "s" : ""} share {label.toLowerCase()} pattern
                      </text>
                    );
                  })()}
                </g>
              )}

              {/* ── Standard-mode pressure zones — trajectory clusters ──── */}
              {!gravityMode && pressureZones.length > 0 && (
                <g style={{ pointerEvents: "none", opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.55s ease" }}>
                  {pressureZones.map(({ color, label, positions, movementType }, zoneIdx) => {
                    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
                    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
                    const maxR = Math.max(...positions.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))) + 38;
                    // Tension intensity for this zone — average across matching links
                    const zoneLinks = tensionLinks.filter((l) => l.movementType === movementType);
                    const avgTension = zoneLinks.length > 0
                      ? zoneLinks.reduce((s, l) => s + l.intensity, 0) / zoneLinks.length
                      : 0;
                    const isHeated = avgTension > 0.70;
                    return (
                      <g key={label}>
                        {/* Cluster breathing — intensity-aware: heated zones breathe more */}
                        <motion.circle
                          cx={cx} cy={cy} r={maxR}
                          fill={color} fillOpacity={0.025 + avgTension * 0.018}
                          stroke={color} strokeWidth={0.75}
                          strokeOpacity={0.08 + avgTension * 0.10}
                          strokeDasharray={isHeated ? "3 6" : "4 8"}
                          animate={{ scale: [1, isHeated ? 1.018 : 1.012, 1] }}
                          transition={{
                            duration: 7 + zoneIdx * 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          style={{ transformOrigin: `${cx}px ${cy}px` }}
                        />
                        <text
                          x={cx} y={cy - maxR - 6}
                          textAnchor="middle"
                          fill={color}
                          fontSize="8"
                          opacity={isHeated ? 0.42 : 0.28}
                          letterSpacing="0.14em"
                          fontFamily="Inter, system-ui, sans-serif" fontWeight="600"
                        >
                          {label} · {positions.length} rivals{isHeated ? " · rising" : ""}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* ── Ambient pulse lines — faint trajectory toward recently-active nodes */}
              {/* At most 3 lines (freshest echoes); very low opacity, slow pulse cycle.     */}
              {activityEchoMap.size > 0 && (
                <g style={{ pointerEvents: "none", opacity: entryPhase >= 2 ? 1 : 0 }}>
                  {[...activityEchoMap.values()]
                    .sort((a, b) => a.ageHours - b.ageHours)
                    .slice(0, 3)
                    .map((echo, i) => {
                      const pos = gravityMode
                        ? gravityPositions.get(echo.competitorId)
                        : standardPositions.get(echo.competitorId);
                      if (!pos) return null;
                      const freshness = Math.max(0, 1 - echo.ageHours / 24);
                      return (
                        <motion.line
                          key={`ambient-${echo.competitorId}`}
                          x1={CENTER} y1={CENTER}
                          x2={pos.x}  y2={pos.y}
                          stroke="#2EE6A6"
                          strokeWidth="0.35"
                          strokeDasharray="2 10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, freshness * 0.07, 0] }}
                          transition={{
                            duration: 9,
                            repeat: Infinity,
                            repeatDelay: 6 + i * 4,
                            ease: "easeInOut",
                          }}
                        />
                      );
                    })}
                </g>
              )}

              {/* ── Competitor blips — revealed at entry phase 2 ──────── */}
              <g style={{ opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.4s ease" }}>
              {sorted.map((competitor, index) => (
                <BlipNode
                  key={competitor.competitor_id}
                  competitor={competitor}
                  index={index}
                  total={sorted.length}
                  radiusScale={radiusScale}
                  isSelected={competitor.competitor_id === selectedId}
                  isDimmed={selectedId !== null && competitor.competitor_id !== selectedId}
                  isAlerted={alertActive && competitor.competitor_id === criticalAlert?.competitor_id}
                  onSelect={handleBlipClick}
                  isMobile={isMobile}
                  gravityPos={gravityMode ? gravityPositions.get(competitor.competitor_id) : undefined}
                  gravityMode={gravityMode}
                  timeDimmed={
                    timeDimmedSet.has(competitor.competitor_id) &&
                    !(alertActive && competitor.competitor_id === criticalAlert?.competitor_id)
                  }
                  signalAgeGlow={getSignalAgeGlow(competitor.last_signal_at)}
                  signalAgeColor={signalAgeColor(competitor.last_signal_at)}
                  isUnvisited={
                    !visitedIds.has(competitor.competitor_id) &&
                    (competitor.signals_7d ?? 0) > 0
                  }
                  hasActivityEcho={activityEchoMap.has(competitor.competitor_id)}
                  echoAgeHours={activityEchoMap.get(competitor.competitor_id)?.ageHours ?? 24}
                  isWeakSignal={weakSignalSet.has(competitor.competitor_id)}
                  tensionDescription={tensionDescriptionMap.get(competitor.competitor_id) ?? null}
                  isHiringSurge={hiringSurgeSet.has(competitor.competitor_id)}
                />
              ))}
              </g>

              {/* ── Empty state — no blips ──────────────────────────── */}
              {sorted.length === 0 && (
                <>
                  <text
                    x={CENTER}
                    y={CENTER - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#1a3a1a"
                    fontSize="12"
                    fontFamily="Inter, system-ui, sans-serif"
                    letterSpacing="0.06em"
                  >
                    SCANNING
                  </text>
                  <text
                    x={CENTER}
                    y={CENTER + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f2a0f"
                    fontSize="10"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    Pipeline running — first signals arriving shortly
                  </text>
                </>
              )}

              {/* ── Edge vignette — rendered last, inside clip ───────── */}
              <rect
                x="0"
                y="0"
                width={SIZE}
                height={SIZE}
                fill="url(#vignette)"
                pointerEvents="none"
              />

              {/* Glass highlight — very faint top-left reflection, instrument polish */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="url(#glassHighlight)"
                pointerEvents="none"
              />

              {/* Radar breathing state — near-invisible slow oscillation, idle life */}
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS * 0.38}
                fill={gravityMode ? "url(#radarCoreGravity)" : "url(#radarCore)"}
                animate={{ opacity: [0.0, 0.09, 0.0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                style={{ pointerEvents: "none" }}
              />

              </g>{/* end radarClip */}

              {/* ── Alert mode: radar boundary rings ─────────────────── */}
              {/* Rendered outside radarClip so they appear at the instrument edge.
                  Two expanding rings in the movement color signal the radar has
                  locked onto a high-priority target. */}
              {alertActive && criticalAlert && (() => {
                const alertColor = getMovementColor(criticalAlert.movement_type);
                return (
                  <>
                    {[0, 1].map((i) => (
                      <motion.circle
                        key={`alert-boundary-${i}`}
                        cx={CENTER}
                        cy={CENTER}
                        r={OUTER_RADIUS}
                        fill="none"
                        stroke={alertColor}
                        strokeWidth="3.5"
                        initial={{ scale: 0.97, opacity: 0.65 }}
                        animate={{ scale: 1.05, opacity: 0 }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: "easeOut",
                          delay: i * 1.4,
                        }}
                        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                      />
                    ))}
                    {/* Static boundary accent — the radar is in alert mode */}
                    <circle
                      cx={CENTER}
                      cy={CENTER}
                      r={OUTER_RADIUS}
                      fill="none"
                      stroke={alertColor}
                      strokeWidth="1.5"
                      opacity="0.22"
                    />
                  </>
                );
              })()}

              {/* ── Cardinal labels (N / E / S / W) — outside clip ── */}
              {CARDINAL_LABELS.map(({ label, x, y }) => (
                <text
                  key={label}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={gravityMode ? "rgba(40,35,80,0.85)" : "rgba(30,41,59,0.7)"}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.06em"
                  style={{ transition: "fill 0.8s ease" }}
                >
                  {label}
                </text>
              ))}
            </svg>
            </div>{/* end zoom canvas */}

            {/* ── Floating controls — mobile only ─────────────────────────── */}
            {/* Gravity toggle + zoom reset, positioned top-right of radar canvas */}
            <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col gap-2 md:hidden">
              <button
                onClick={() => { setGravityMode((g) => !g); getAudioManager().play("swoosh"); }}
                className="flex h-11 w-11 items-center justify-center rounded-[12px] transition-all active:scale-90"
                style={{
                  background: gravityMode ? "rgba(129,140,248,0.14)" : "rgba(46,230,166,0.08)",
                  border: `1px solid ${gravityMode ? "rgba(129,140,248,0.28)" : "rgba(46,230,166,0.14)"}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                aria-label={gravityMode ? "Switch to Standard mode" : "Switch to Gravity Field mode"}
              >
                {gravityMode ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="3.5" fill="#818cf8" fillOpacity="0.85" />
                    <circle cx="9" cy="9" r="7" stroke="#818cf8" strokeWidth="1" strokeOpacity="0.45" />
                    <circle cx="9" cy="9" r="5" stroke="#818cf8" strokeWidth="0.7" strokeOpacity="0.25" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="7" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.55" />
                    <circle cx="9" cy="9" r="4.5" stroke="#2EE6A6" strokeWidth="0.75" strokeOpacity="0.30" />
                    <circle cx="9" cy="9" r="1.5" fill="#2EE6A6" fillOpacity="0.75" />
                  </svg>
                )}
              </button>
              {zoom !== 1 && (
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className="flex h-11 w-11 items-center justify-center rounded-[12px] transition-all active:scale-90"
                  style={{
                    background: "rgba(46,230,166,0.08)",
                    border: "1px solid rgba(46,230,166,0.14)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                  aria-label="Reset zoom"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="3" stroke="#2EE6A6" strokeWidth="1.2" strokeOpacity="0.7" />
                    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" stroke="#2EE6A6" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.65" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── Micro Insight overlay — rotating deterministic observation ── */}
            {/* Shown only when no node is selected and no alert is active.       */}
            {!selected && !alertActive && currentInsight && (
              <div
                className="pointer-events-none absolute bottom-[44px] left-0 right-0 flex justify-center"
                style={{
                  zIndex: 10,
                  opacity: insightVisible ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              >
                <span
                  className="text-[9px] uppercase tracking-[0.22em]"
                  style={{ color: "rgba(46,230,166,0.26)" }}
                >
                  {currentInsight}
                </span>
              </div>
            )}

            {/* ── Critical alert banner overlay ──────────────────────── */}
            {/* Positioned inside the radar SVG container so it overlays the
                instrument itself. Slides up from the bottom of the radar area.
                Delayed 0.9s to let the entry animation complete first. */}
            <AnimatePresence>
              {alertActive && criticalAlert && (() => {
                const alertColor = getMovementColor(criticalAlert.movement_type);
                return (
                  <motion.div
                    key={`critical-alert-${criticalAlert.alertKey}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: entryPhase >= 3 ? 0 : 0.9 }}
                    className="absolute bottom-4 left-4 right-4 z-30 md:bottom-6 md:left-6 md:right-6"
                  >
                    <div
                      className="relative overflow-hidden rounded-[16px] border px-5 py-4"
                      style={{
                        background: "rgba(2,4,2,0.95)",
                        borderColor: `${alertColor}40`,
                        backdropFilter: "blur(16px)",
                        boxShadow: `0 8px 40px rgba(0,0,0,0.85), 0 0 30px ${alertColor}0d`,
                      }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute inset-y-0 left-0 w-[3px] rounded-l-[16px]"
                        style={{ backgroundColor: alertColor }}
                      />

                      <div className="ml-3 flex items-start justify-between gap-4">
                        {/* Alert content */}
                        <div className="min-w-0 flex-1">
                          {/* Label row */}
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className="text-[10px] font-bold uppercase tracking-[0.28em]"
                              style={{ color: alertColor }}
                            >
                              ⚡ Competitor Accelerating
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                              style={{
                                background: `${alertColor}18`,
                                color: alertColor,
                                border: `1px solid ${alertColor}30`,
                              }}
                            >
                              {Math.round(criticalAlert.confidence * 100)}% confidence
                            </span>
                          </div>

                          {/* Competitor name */}
                          <div className="text-[16px] font-bold leading-tight text-white">
                            {criticalAlert.competitor_name}
                          </div>

                          {/* Movement title */}
                          <div
                            className="mt-0.5 text-[12px] font-semibold"
                            style={{ color: alertColor, opacity: 0.85 }}
                          >
                            {getAlertTitle(criticalAlert.movement_type)}
                          </div>

                          {/* Explanation */}
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                            {getAlertExplanation(criticalAlert)}
                          </p>

                          {/* Metrics row */}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                            <span>{criticalAlert.signals_7d} signals this week</span>
                            <span className="text-slate-700">·</span>
                            <span>Momentum {Number(criticalAlert.momentum_score).toFixed(1)}</span>
                            <span className="text-slate-700">·</span>
                            <span>{formatRelative(criticalAlert.last_seen_at)}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                          <button
                            onClick={handleStrategyNav}
                            className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-opacity hover:opacity-85"
                            style={{ background: alertColor, color: "#000" }}
                          >
                            View Strategy →
                          </button>
                          <button
                            onClick={handleAlertDismiss}
                            className="text-[11px] text-slate-600 transition-colors hover:text-slate-400"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* ── Radar controls overlay (always visible) ─────────── */}
            <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
              {/* Observatory isolation toggle */}
              <button
                onClick={() => { setIsolated((p) => !p); getAudioManager().play("swoosh"); }}
                title={isolated ? "Exit observatory mode (Esc)" : "Observatory mode"}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
                style={{
                  background: "rgba(0,0,0,0.88)",
                  border: `1px solid ${isolated ? "rgba(46,230,166,0.3)" : "#0e2210"}`,
                  color: isolated ? "#2EE6A6" : "#3a5a3a",
                  boxShadow: isolated ? "0 0 10px rgba(46,230,166,0.18)" : "none",
                }}
              >
                {isolated ? (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <path d="M1 4H4V1M7 1V4H10M10 7H7V10M4 10V7H1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <path d="M1 4V1H4M7 1H10V4M10 7V10H7M4 10H1V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Zoom controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => setZoom((p) => Math.min(6, p * 1.3))}
                  title="Zoom in (+)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-light leading-none transition-all hover:border-[rgba(46,230,166,0.25)] hover:text-[#2EE6A6]"
                  style={{ background: "rgba(0,0,0,0.88)", border: "1px solid #0e2210", color: "#3a5a3a", cursor: "zoom-in" }}
                >
                  +
                </button>
                <button
                  onClick={() => setZoom((p) => Math.max(0.4, p / 1.3))}
                  title="Zoom out (−)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-light leading-none transition-all hover:border-[rgba(46,230,166,0.25)] hover:text-[#2EE6A6]"
                  style={{ background: "rgba(0,0,0,0.88)", border: "1px solid #0e2210", color: "#3a5a3a", cursor: "zoom-out" }}
                >
                  −
                </button>

                {/* Reset view — only shown when view is non-default */}
                {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                  <button
                    onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                    title="Reset view"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
                    style={{
                      background: "rgba(0,0,0,0.88)",
                      border: "1px solid rgba(46,230,166,0.25)",
                      color: "#2EE6A6",
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                      <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Zoom level readout */}
              {zoom !== 1 && (
                <div
                  className="flex h-7 w-7 items-center justify-center text-[8px] font-bold tabular-nums"
                  style={{ color: "rgba(46,230,166,0.38)" }}
                >
                  {Math.round(zoom * 100)}%
                </div>
              )}

              {/* Sound toggle */}
              <button
                onClick={handleSoundToggle}
                title={soundEnabled ? "Sound on — click to mute" : "Sound off — click to enable"}
                aria-label={soundEnabled ? "Disable sound effects" : "Enable sound effects"}
                aria-pressed={soundEnabled}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
                style={{
                  background: "rgba(0,0,0,0.88)",
                  border: `1px solid ${soundEnabled ? "rgba(46,230,166,0.3)" : "#0e2210"}`,
                  color: soundEnabled ? "#2EE6A6" : "#3a5a3a",
                  boxShadow: soundEnabled ? "0 0 8px rgba(46,230,166,0.15)" : "none",
                  marginTop: "4px",
                }}
              >
                {soundEnabled ? (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <path d="M2 4H1v3h1l3 2.5V1.5L2 4z" fill="currentColor" />
                    <path d="M7 3.5c.8.6 1.3 1.5 1.3 2.5S7.8 7.9 7 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M8.5 2c1.2 1 2 2.5 2 4s-.8 3-2 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <path d="M2 4H1v3h1l3 2.5V1.5L2 4z" fill="currentColor" />
                    <path d="M8 4l-2 2m0-2l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>

            {/* ── Observatory mode overlays ────────────────────────── */}
            <AnimatePresence>
              {isolated && (
                <motion.div
                  key="isolation-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 z-10"
                >
                  {/* Legend — bottom left */}
                  <div
                    className="pointer-events-none absolute bottom-5 left-5 flex flex-col gap-2 rounded-[12px] px-4 py-3"
                    style={{
                      background: gravityMode ? "rgba(2,1,20,0.90)" : "rgba(0,0,0,0.82)",
                      border: `1px solid ${gravityMode ? "#1e1545" : "#0e2210"}`,
                      backdropFilter: "blur(8px)",
                      transition: "background 0.8s ease, border-color 0.8s ease",
                    }}
                  >
                    <div
                      className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.24em]"
                      style={{ color: gravityMode ? "rgba(129,140,248,0.5)" : "rgb(71,85,105)", transition: "color 0.8s ease" }}
                    >
                      {gravityMode ? "Field Type" : "Signal Type"}
                    </div>
                    {(
                      [
                        { color: "#ff3b3b", label: "Pricing" },
                        { color: "#00e5ff", label: "Product" },
                        { color: "#ffcc00", label: "Market" },
                        { color: "#9b5cff", label: "Enterprise" },
                        { color: "#94a3b8", label: "Dormant" },
                      ] as { color: string; label: string }[]
                    ).map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-2">
                        <span
                          className="h-[5px] w-[5px] shrink-0 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}66` }}
                        />
                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {label}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Temporal filter — bottom center */}
                  <div
                    className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-[10px] p-1"
                    style={{
                      background: gravityMode ? "rgba(2,1,20,0.90)" : "rgba(0,0,0,0.82)",
                      border: `1px solid ${gravityMode ? "#1e1545" : "#0e2210"}`,
                      backdropFilter: "blur(8px)",
                      transition: "background 0.8s ease, border-color 0.8s ease",
                    }}
                  >
                    {(["24h", "7d", "all"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTemporalFilter(f)}
                        className="rounded-[7px] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200"
                        style={{
                          background: temporalFilter === f
                            ? gravityMode ? "rgba(129,140,248,0.10)" : "rgba(46,230,166,0.09)"
                            : "transparent",
                          color: temporalFilter === f
                            ? gravityMode ? G.primary : "#2EE6A6"
                            : gravityMode ? G.dim : "#3a5a3a",
                          boxShadow: temporalFilter === f
                            ? gravityMode ? "inset 0 0 0 1px rgba(129,140,248,0.22)" : "inset 0 0 0 1px rgba(46,230,166,0.2)"
                            : "none",
                        }}
                      >
                        {f === "all" ? "All time" : `Last ${f}`}
                      </button>
                    ))}
                  </div>

                  {/* Observatory label — top center */}
                  <div
                    className="absolute left-1/2 top-4 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: "rgba(46,230,166,0.25)" }}
                  >
                    Observatory Mode
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* ── Footer: legend + ticker ─────────────────────────────── */}
          <div
            className="shrink-0"
            style={{
              borderTop: `1px solid ${gravityMode ? "#150f30" : "#0a1c0a"}`,
              transition: "border-color 0.8s ease",
            }}
          >

            {/* Legend row */}
            <div className="flex items-center justify-center gap-5 px-4 py-2.5">
              {(
                [
                  { color: "#ff3b3b", label: "Pricing" },
                  { color: "#00e5ff", label: "Product" },
                  { color: "#ffcc00", label: "Market" },
                  { color: "#9b5cff", label: "Enterprise" },
                  { color: "#94a3b8", label: "Dormant" },
                ] as { color: string; label: string }[]
              ).map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}55` }}
                  />
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </span>
                </span>
              ))}
            </div>

            {/* Signal ticker */}
            {tickerItems.length > 0 && (
              <div
                className="relative h-7 overflow-hidden border-t border-[#0a1c0a]"
                style={{
                  maskImage:
                    "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                }}
              >
                <motion.div
                  className="flex h-full items-center whitespace-nowrap"
                  style={{ width: "max-content" }}
                  animate={{ x: ["0%", "-50%"] }}
                  transition={{
                    duration: 40,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  {[0, 1].map((copy) => (
                    <div key={copy} className="flex items-center">
                      {tickerItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-4 font-mono text-[11px] uppercase tracking-[0.14em]"
                          style={{ color: "#3a9e62" }}
                        >
                          <span style={{ color: "#2EE6A6", opacity: 0.60 }}>▸</span>
                          {item.name}
                          <span style={{ color: "#1a3a22" }}>·</span>
                          {item.label}
                          <span style={{ color: "#1a3a22" }}>·</span>
                          {item.date}
                          <span className="ml-2" style={{ color: "#1a3a22" }}>///</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
      </section>

      {/* ── Mobile backdrop — dims radar behind open drawer on small screens ── */}
      {selected && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSelectedId(null)}
          aria-hidden="true"
        />
      )}

      {/* ── Right panel — intelligence console ──────────────────── */}
      {/* Mobile: hidden when nothing selected; bottom-sheet when selected.  */}
      {/* Desktop (md+): always-visible second grid column.                  */}
      <aside
        className={`border bg-[#000000] p-6 md:static md:block md:inset-auto md:z-auto md:min-h-0 md:max-h-none md:overflow-y-auto md:rounded-[20px]${
          selected
            ? sheetState === "full"
              ? " fixed inset-x-0 bottom-0 z-40 h-[100svh] overflow-y-auto rounded-t-[20px]"
              : sheetState === "peek"
              ? " fixed inset-x-0 bottom-0 z-40 h-[28vh] overflow-hidden rounded-t-[20px]"
              : " fixed inset-x-0 bottom-0 z-40 max-h-[65vh] overflow-y-auto rounded-t-[20px]"
            : " hidden"
        }`}
        onTouchStart={handleSheetTouchStart}
        onTouchEnd={handleSheetTouchEnd}
        style={{
          borderColor: selected
            ? `${getMovementColor(selected.latest_movement_type)}38`
            : "#0e2010",
          boxShadow: selected
            ? `inset 0 1px 0 0 ${getMovementColor(selected.latest_movement_type)}18, 0 0 60px rgba(0,0,0,0.6)`
            : "inset 0 1px 0 0 rgba(46,230,166,0.05), 0 0 60px rgba(0,0,0,0.6)",
          opacity: entryPhase >= 3 ? 1 : 0,
          transition: "opacity 0.4s ease, border-color 0.5s ease, box-shadow 0.5s ease",
        }}
      >
        {/* ── Mobile swipe handle + sheet state indicator ── */}
        <div className="mb-4 flex flex-col items-center gap-2 md:hidden">
          <div className="h-[4px] w-10 rounded-full bg-[#1c3a1c]" />
          {selected && (
            <div className="flex items-center gap-1.5" role="group" aria-label="Sheet position">
              {(["peek", "half", "full"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSheetState(s)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: sheetState === s ? "20px" : "6px",
                    height: "4px",
                    background: sheetState === s ? "#2EE6A6" : "#1c3a1c",
                  }}
                  aria-label={`${s} view`}
                  aria-pressed={sheetState === s}
                />
              ))}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {selected ? (
            /* ── Intelligence drawer ──────────────────────────── */
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
            >
              {/* ── Drawer header ──────────────────────────────── */}
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Competitor identity row */}
                  <div className="mb-2 flex items-start gap-3">
                    {/* Letter monogram — movement-color branded */}
                    <div
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[17px] font-bold"
                      style={{
                        background: `${getMovementColor(selected.latest_movement_type)}18`,
                        border: `1px solid ${getMovementColor(selected.latest_movement_type)}30`,
                        color: getMovementColor(selected.latest_movement_type),
                        textShadow: `0 0 10px ${getMovementColor(selected.latest_movement_type)}60`,
                      }}
                    >
                      {selected.competitor_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: "rgba(46,230,166,0.5)" }}>
                        Intelligence Report
                      </div>
                      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-white">
                        {selected.competitor_name}
                      </h2>
                    </div>
                  </div>
                  {selected.website_url && (
                    <a
                      href={selected.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {selected.website_url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  )}

                  {/* ── Remove competitor action ──────────────────── */}
                  {!removeConfirming && !removeLoading && (
                    <button
                      onClick={() => { setRemoveConfirming(true); setRemoveError(null); }}
                      className="mt-2 font-mono text-[10px] font-bold tracking-[0.18em] text-slate-700 transition-colors hover:text-red-400"
                    >
                      STOP TRACKING
                    </button>
                  )}
                  {removeConfirming && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-slate-500">STOP TRACKING?</span>
                      <button
                        onClick={() => selected.website_url && handleRemoveConfirmed(selected.website_url)}
                        disabled={!selected.website_url}
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-red-400 transition-colors hover:text-red-300"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setRemoveConfirming(false); setRemoveError(null); }}
                        className="text-[11px] text-slate-600 transition-colors hover:text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {removeLoading && (
                    <span className="mt-2 block text-[11px] text-slate-600">Removing…</span>
                  )}
                  {removeError && (
                    <span className="mt-2 block text-[11px] text-red-400">{removeError}</span>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {/* Movement type pill */}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${getMovementColor(selected.latest_movement_type)}18`,
                        color: getMovementColor(selected.latest_movement_type),
                        border: `1px solid ${getMovementColor(selected.latest_movement_type)}30`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: getMovementColor(selected.latest_movement_type),
                          boxShadow: `0 0 6px ${getMovementColor(selected.latest_movement_type)}`,
                        }}
                      />
                      {translateMovementType(selected.latest_movement_type, sector)}
                    </span>
                    {!detailLoading && primarySignal?.urgency != null && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em]"
                        style={getUrgencyStyle(primarySignal.urgency)}
                      >
                        {getUrgencyLabel(primarySignal.urgency)}
                      </span>
                    )}
                    {!detailLoading && primarySignal?.page_type && (
                      <span className="text-[11px] text-slate-500">
                        {getPageTypeLabel(primarySignal.page_type)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1c3a1c] bg-[#071207] text-slate-400 transition-colors hover:border-[#2a4a2a] hover:bg-[#0c1e0c] hover:text-slate-200"
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Separator */}
              <div
                className="mb-6 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${getMovementColor(selected.latest_movement_type)}30 40%, ${getMovementColor(selected.latest_movement_type)}30 60%, transparent)`,
                }}
              />

              {/* ── Assessment ──────────────────────────────────── */}
              <div className="overflow-hidden rounded-[14px] border border-[#152415]" style={{ background: "#071507" }}>
                {/* Movement-color accent line */}
                <div
                  className="h-px w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${getMovementColor(selected.latest_movement_type)}45 35%, ${getMovementColor(selected.latest_movement_type)}60 50%, ${getMovementColor(selected.latest_movement_type)}45 65%, transparent)`,
                  }}
                />
                <div className="px-4 py-3.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: `${getMovementColor(selected.latest_movement_type)}90` }}>
                  Assessment
                </div>
                {detailLoading ? (
                  <div className="h-14 animate-pulse rounded-lg bg-[#0c1e0c]" />
                ) : detailError ? (
                  <p className="text-sm leading-6 text-slate-500">
                    Could not load intelligence. Try selecting again.
                  </p>
                ) : primarySignal?.strategic_implication ? (
                  <p className="text-sm leading-relaxed text-slate-300">
                    {(() => {
                      const cl = confidenceLanguage(interpretationConf);
                      return cl.prefix ? <span style={{ color: cl.color }}>{cl.prefix}</span> : null;
                    })()}
                    {primarySignal.strategic_implication}
                  </p>
                ) : primarySignal?.summary ? (
                  <p className="text-sm leading-relaxed text-slate-400">
                    {interpretationConf !== null && interpretationConf < 0.5 && (
                      <span className="text-slate-500">Early signal — </span>
                    )}
                    {primarySignal.summary}
                  </p>
) : detail?.signals && detail.signals.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-500">
                    Monitoring active — no signals yet.
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    Analysing…
                  </p>
                )}
                </div>
              </div>

              {/* ── Recommended action ──────────────────────────── */}
              {!detailLoading && primarySignal?.recommended_action && (
                <div
                  className="mt-3 rounded-[14px] border border-[#1a2d18] px-4 py-3.5"
                  style={{
                    background: "#070e07",
                    borderLeftColor: `${getMovementColor(selected.latest_movement_type)}55`,
                    borderLeftWidth: "2px",
                  }}
                >
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: `${getMovementColor(selected.latest_movement_type)}95` }}>
                    <span style={{ opacity: 0.7 }}>→</span>
                    <span>Recommended Action</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">
                    {primarySignal.recommended_action}
                  </p>
                </div>
              )}

              {/* ── Stats grid ──────────────────────────────────── */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-[14px] border border-[#0f1c0f] bg-[#040904] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    Momentum
                  </div>
                  <div
                    className="mt-2 text-xl font-bold tabular-nums leading-none"
                    style={{ color: getMovementColor(selected.latest_movement_type) }}
                  >
                    {formatNumber(selected.momentum_score)}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-700">
                    score
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#0f1c0f] bg-[#040904] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    Signals 7d
                  </div>
                  <div className="mt-2 text-xl font-bold tabular-nums leading-none text-slate-200">
                    {formatNumber(selected.signals_7d, 0)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#0f1c0f] bg-[#040904] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    Signals
                  </div>
                  <div className="mt-2 text-xl font-bold tabular-nums leading-none text-slate-200">
                    {formatNumber(selected.latest_movement_signal_count, 0)}
                  </div>
                </div>
              </div>

              {/* ── Momentum trend ──────────────────────────────── */}
              {(() => {
                const mCfg = getMomentumConfig(Number(selected.momentum_score ?? 0));
                return (
                  <div className="mt-2.5 rounded-[14px] border border-[#122012] bg-[#050d07] px-4 py-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Momentum Trend
                      </div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{ background: mCfg.bg, color: mCfg.color }}
                      >
                        {mCfg.arrow} {mCfg.label}
                      </span>
                    </div>
                    <MomentumSparkline competitorId={selected.competitor_id} />
                  </div>
                );
              })()}

              {/* ── Timeline ────────────────────────────────────── */}
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-[14px] border border-[#0f1c0f] bg-[#050b07] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    First seen
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_first_seen_at)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#0f1c0f] bg-[#050b07] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    Last seen
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_last_seen_at)}
                  </div>
                </div>
              </div>

              {/* ── Signal Integrity (instrument panel) ─────────── */}
              <div className="mt-2.5 rounded-[14px] border border-[#1a2d1a] bg-[#030703] px-4 py-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Signal Integrity
                    </div>
                    {interpretationConf !== null && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                        style={
                          interpretationConf >= 0.75
                            ? { background: "rgba(46,230,166,0.1)", color: "#2EE6A6" }
                            : interpretationConf >= 0.5
                            ? { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }
                            : { background: "rgba(148,163,184,0.08)", color: "#64748b" }
                        }
                      >
                        {interpretationConf >= 0.75
                          ? "Strong"
                          : interpretationConf >= 0.5
                          ? "Moderate"
                          : "Low"}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[18px] font-bold tabular-nums leading-none"
                    style={{
                      color:
                        interpretationConf === null
                          ? "#475569"
                          : interpretationConf >= 0.75
                          ? getMovementColor(selected.latest_movement_type)
                          : interpretationConf >= 0.5
                          ? "#f59e0b"
                          : "#94a3b8",
                      textShadow:
                        interpretationConf !== null && interpretationConf >= 0.75
                          ? `0 0 14px ${getMovementColor(selected.latest_movement_type)}55`
                          : undefined,
                    }}
                  >
                    {interpretationConf !== null
                      ? `${Math.round(interpretationConf * 100)}%`
                      : "—"}
                  </div>
                </div>

                {/* Bar track */}
                <div className="relative h-[10px] w-full rounded-full bg-[#060e06]">
                  {/* Segment tick marks at 25 / 50 / 75 */}
                  {[25, 50, 75].map((pct) => (
                    <div
                      key={pct}
                      className="absolute top-0 h-full w-px bg-black/50"
                      style={{ left: `${pct}%`, zIndex: 2 }}
                    />
                  ))}
                  {/* Fill bar */}
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background:
                        interpretationConf !== null && interpretationConf >= 0.75
                          ? `linear-gradient(90deg, ${getMovementColor(selected.latest_movement_type)}70, ${getMovementColor(selected.latest_movement_type)})`
                          : interpretationConf !== null && interpretationConf >= 0.5
                          ? "linear-gradient(90deg, #f59e0b70, #f59e0b)"
                          : "linear-gradient(90deg, #64748b50, #64748b)",
                      boxShadow:
                        interpretationConf !== null && interpretationConf >= 0.5
                          ? interpretationConf >= 0.75
                            ? `0 0 12px ${getMovementColor(selected.latest_movement_type)}65`
                            : "0 0 8px rgba(245,158,11,0.5)"
                          : undefined,
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.round((interpretationConf ?? 0) * 100)}%`,
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>

                {/* Scale labels */}
                <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.12em] text-slate-700">
                  <span>0%</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100%</span>
                </div>
              </div>

              {/* ── Evidence chain ──────────────────────────────── */}
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Evidence
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-600">
                    Live captures
                  </div>
                </div>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-[12px] bg-[#071507]" />
                    ))}
                  </div>
                ) : sortedSignals.length > 0 ? (
                  <div className="space-y-2">
                    {sortedSignals.slice(0, 3).map((signal, si) => {
                      const sigColor = getSignalColor(signal.signal_type);
                      return (
                        <motion.div
                          key={signal.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, ease: "easeOut", delay: si * 0.07 }}
                          className="rounded-[12px] border border-[#152415] bg-[#060b06] p-3.5"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]"
                                style={{
                                  backgroundColor: `${sigColor}18`,
                                  color: sigColor,
                                  border: `1px solid ${sigColor}25`,
                                }}
                              >
                                {translateSignalType(signal.signal_type, sector)}
                              </span>
                              {signal.urgency != null && signal.urgency >= 3 && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
                                  style={getUrgencyStyle(signal.urgency)}
                                >
                                  {getUrgencyLabel(signal.urgency)}
                                </span>
                              )}
                              {/* "Caught early" — signal detected within 6 hours */}
                              {signal.detected_at &&
                                Date.now() - new Date(signal.detected_at).getTime() < 6 * 60 * 60 * 1000 && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
                                  style={{ backgroundColor: "rgba(46,230,166,0.08)", color: "#2EE6A6", border: "1px solid rgba(46,230,166,0.2)" }}
                                >
                                  detected early
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500">
                                {getPageTypeLabel(signal.page_type)}
                              </span>
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                              {formatDate(signal.detected_at)}
                            </span>
                          </div>

                          {signal.summary && (
                            <p className="mb-2 text-xs leading-5 text-slate-400">
                              {signal.summary}
                            </p>
                          )}

                          {signal.previous_excerpt && signal.current_excerpt && (
                            <div className="space-y-1">
                              <div className="mb-1 text-[10px] text-slate-600" style={{ letterSpacing: "0.08em" }}>
                                {getPageTypeLabel(signal.page_type)} · {formatRelative(signal.detected_at)}
                              </div>
                              <div className="rounded-[8px] bg-[#040a04] px-3 py-2">
                                <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
                                  Was
                                </span>
                                <p className="mt-0.5 line-clamp-2 font-mono text-xs text-slate-500">
                                  {signal.previous_excerpt}
                                </p>
                              </div>
                              <div className="rounded-[8px] bg-[#050e05] px-3 py-2">
                                <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                                  Now
                                </span>
                                <p className="mt-0.5 line-clamp-2 font-mono text-xs text-slate-300">
                                  {signal.current_excerpt}
                                </p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-[#152415] bg-[#071507] px-4 py-3 text-center">
                    <p className="text-sm text-slate-500">
                      No changes detected yet
                    </p>
                  </div>
                )}
              </div>

              {/* ── Movements detected ──────────────────────────── */}
              {!detailLoading && detail && detail.movements.length >= 1 && (
                <div className="mt-5">
                  <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                    Movements detected
                  </div>
                  <div className="space-y-1.5">
                    {detail.movements.map((m, i) => {
                      const mColor = getMovementColor(m.movement_type);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-[12px] border border-[#0f1c0f] bg-[#050a05] px-4 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: mColor,
                                boxShadow: `0 0 5px ${mColor}88`,
                              }}
                            />
                            <span className="text-sm text-slate-300">
                              {translateMovementType(m.movement_type, sector)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] tabular-nums text-slate-500">
                            <span>{m.signal_count} signals</span>
                            <span>{formatRelative(m.last_seen_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Coverage ────────────────────────────────────── */}
              {!detailLoading && detail && detail.monitoredPages.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                      Coverage
                    </div>
                    <div className="text-[11px] text-slate-600">
                      surfaces monitored
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.monitoredPages.map((p: MonitoredPage, i: number) => (
                      <span
                        key={i}
                        className="rounded-full border border-[#152415] bg-[#071507] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400"
                      >
                        {getPageTypeLabel(p.page_type)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Recent Activity (Activity Echo feed) ─────────── */}
              <ActivityTimeline
                signals={detail?.signals ?? []}
                loading={detailLoading}
              />
            </motion.div>
          ) : (
            /* ── Compact contact list ─────────────────────────── */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Panel header ──────────────────────────────── */}
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#2EE6A6]" style={{ opacity: 0.7 }}>
                    Intelligence Feed
                  </div>
                  <div className="mt-1.5 text-[12px] font-medium text-slate-300">
                    Select a target to pull intelligence
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    {sorted.length} rival{sorted.length !== 1 ? "s" : ""} under surveillance
                  </div>
                  {latestSignalAt && (
                    <div
                      className="mt-0.5 text-[11px]"
                      style={{
                        color: (() => {
                          const h = (Date.now() - new Date(latestSignalAt).getTime()) / 3_600_000;
                          return h < 6 ? "rgba(46,230,166,0.50)" : h < 24 ? "rgba(245,158,11,0.40)" : "rgba(100,116,139,0.45)";
                        })(),
                      }}
                    >
                      Updated {formatRelative(latestSignalAt)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#2EE6A6]/20 bg-[#2EE6A6]/6 px-3 py-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#2EE6A6]"
                    style={{ boxShadow: "0 0 5px rgba(46,230,166,0.7)" }}
                  />
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#2EE6A6]">
                    Live
                  </span>
                </div>
              </div>

              {/* ── Empty state ───────────────────────────────── */}
              {sorted.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                    No rivals tracked
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Competitors will appear once added
                  </p>
                </div>
              )}

              {/* ── All clear banner ──────────────────────────── */}
              {movingCount === 0 && sorted.length > 0 && (
                <div
                  className="mb-5 rounded-[12px] border border-[#1a3a1a] px-4 py-3 text-center"
                  style={{ background: "rgba(46,230,166,0.03)" }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(46,230,166,0.5)" }}>
                    Monitoring Active
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                    No new signals — {sorted.length} rival{sorted.length !== 1 ? "s" : ""} under active surveillance
                  </p>
                </div>
              )}

              {/* ── Contact list ──────────────────────────────── */}
              <div className="space-y-1">
                {sorted.map((competitor) => {
                  const color    = getMovementColor(competitor.latest_movement_type);
                  const momentum = Number(competitor.momentum_score ?? 0);
                  const fresh    = isNewToday(competitor);
                  const isActive = competitor.latest_movement_type !== null;
                  return (
                    <div
                      key={competitor.competitor_id}
                      onClick={() => handleBlipClick(competitor.competitor_id)}
                      className="group flex cursor-pointer items-center gap-3 rounded-[12px] border border-transparent px-3.5 py-3 transition-all hover:border-[#1c3a1c] hover:bg-[#060d06]"
                      style={isActive ? {
                        borderLeftColor: `${color}45`,
                        borderLeftWidth: "2px",
                      } : undefined}
                    >
                      {/* Movement color dot */}
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: isActive ? `0 0 8px ${color}99` : `0 0 4px ${color}44`,
                        }}
                      />

                      {/* Name + movement / timestamp (2-line) */}
                      <div className="min-w-0 flex-1 transition-transform group-hover:translate-x-px">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-100">
                            {competitor.competitor_name}
                          </span>
                          {fresh && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                              style={{ background: "rgba(46,230,166,0.12)", color: "#2EE6A6" }}
                            >
                              Signal
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 truncate text-[11px]">
                          {isActive ? (
                            <span
                              className="font-medium uppercase tracking-[0.14em]"
                              style={{ color }}
                            >
                              {translateMovementType(competitor.latest_movement_type, sector)}
                            </span>
                          ) : (
                            <span className="uppercase tracking-[0.14em] text-slate-600">Dormant</span>
                          )}
                          <span className="text-slate-700">/</span>
                          <span className="tabular-nums text-slate-600">
                            {formatRelative(
                              competitor.latest_movement_last_seen_at ??
                                competitor.last_signal_at
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Momentum score + bar + state */}
                      {(() => {
                        const mCfg = getMomentumConfig(momentum);
                        return (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <div className="text-[14px] font-bold tabular-nums text-slate-200">
                              {formatNumber(momentum)}
                            </div>
                            <div className="h-[3px] w-14 overflow-hidden rounded-full bg-[#0d1f0d]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round((momentum / maxMomentum) * 100)}%`,
                                  backgroundColor: color,
                                  boxShadow: `0 0 5px ${color}77`,
                                }}
                              />
                            </div>
                            <span
                              className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                              style={{ color: mCfg.color }}
                            >
                              {mCfg.arrow} {mCfg.label}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}
