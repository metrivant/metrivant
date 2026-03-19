"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
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
import ActivityTimeline from "./ActivityTimeline";

// ─── Radar geometry ──────────────────────────────────────────────────────────
const SIZE = 1000;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 420;
const RING_FACTORS = [1, 0.857, 0.571, 0.286];

// ─── Gravity Mode colour system ────────────────────────────────────────────────
// Violet/indigo field language — distinct from Standard Mode scan-green.
const G = {
  primary:  "#cbd5e1", // near-white — orbit lines, structural elements
  core:     "#ffffff", // pure white — central star
  coreLt:   "#e2e8f0", // near-white — orbit rings
  ring:     "#0c0c12", // near-black — grid rings, crosshairs
  bg:       "#000000", // black — space background
  dot:      "#ffffff", // white — center emitter
  glow:     "#94a3b8", // soft grey — glow
  dim:      "#1c1c28", // very dark — dimmed inactive
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
      return "#FF2AD4";
    case "product_expansion":
      return "#00F5FF";
    case "market_reposition":
      return "#FF7A00";
    case "enterprise_push":
      return "#9B5CFF";
    case "ecosystem_expansion":
      return "#9B5CFF";
    default:
      return "#4A6FA5";
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

// ─── Zone-aware layout ─────────────────────────────────────────────────────
// Dormant competitors park in the inner orbit band — clear of the center point.
// Each zone has a radius min/max; competitors spread across the band by zone rank.
// Gaps between zones create visual tiers: quiet inside, active outside.
const ZONE_RADII = {
  dormant:  { min: 90,  max: 175 }, // momentum < 1.5
  watch:    { min: 192, max: 252 }, // 1.5 ≤ momentum < 3
  active:   { min: 270, max: 330 }, // 3 ≤ momentum < 5
  critical: { min: 348, max: 408 }, // momentum ≥ 5
} as const;

function getRadialZone(momentum: number): keyof typeof ZONE_RADII {
  if (momentum >= 5)   return "critical";
  if (momentum >= 3)   return "active";
  if (momentum >= 1.5) return "watch";
  return "dormant";
}

function movAbbreviation(type: string): string {
  switch (type) {
    case "pricing_strategy_shift": return "PRICING VEC";
    case "product_expansion":      return "PROD SURGE";
    case "market_reposition":      return "MKT REPOS";
    case "enterprise_push":        return "ENT PUSH";
    case "ecosystem_expansion":    return "ECO EXPND";
    default: return type.replace(/_/g, " ").toUpperCase().slice(0, 11);
  }
}

// FNV-1a 32-bit hash → stable 0–1 float from competitor_id.
// Same id always maps to the same angle across refreshes.
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  return h / 0xFFFFFFFF;
}

// Zone-aware, ID-anchored placement.
// competitorId → deterministic angle; momentum → zone; zoneIndex/zoneTotal → radius within band.
function getZoneNodePosition(
  competitorId: string,
  momentum: number,
  zoneIndex: number,
  zoneTotal: number,
): Point {
  const band = ZONE_RADII[getRadialZone(momentum)];
  const angle = idHash(competitorId) * 2 * Math.PI;
  const t = zoneTotal > 1 ? zoneIndex / (zoneTotal - 1) : 0.5;
  const r = band.min + t * (band.max - band.min);
  return {
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  };
}

function getNodeSize(momentum: number): number {
  return 16 + Math.sqrt(Math.max(momentum, 0)) * 3.2;
}

// ─── Gravity Field: field functions ──────────────────────────────────────────
// Mass model: momentum (primary) + ambient pressure bonus (secondary).
function getNodeMass(c: RadarCompetitor): number {
  return Math.max(0, Number(c.momentum_score ?? 0) + Number(c.pressure_index ?? 0) * 0.15);
}

// Converts sampled closed-curve points to a smooth SVG cubic bezier path.
// Uses Catmull-Rom tangents for C1 continuity across all segments.
function ptsToSmoothPath(pts: Point[]): string {
  const n = pts.length;
  if (n < 3) return "";
  const ALPHA = 1 / 6; // standard Catmull-Rom tension
  const parts: string[] = [`M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) * ALPHA;
    const cp1y = p1.y + (p2.y - p0.y) * ALPHA;
    const cp2x = p2.x - (p3.x - p1.x) * ALPHA;
    const cp2y = p2.y - (p3.y - p1.y) * ALPHA;
    parts.push(`C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

// Computes deformed contour rings for the Gravity Field.
// Each ring is a smooth closed curve displaced toward nearby node masses.
// Scalar field: influence = mass / (dist^P_EXP + EPSILON) summed across all masses.
// Inner rings deform more (higher MAX_DISP); outer rings fade gracefully.
// Returns SVG path d-strings (11 rings, innermost to outermost).
function computeGravityContours(
  competitors: RadarCompetitor[],
  gravPositions: Map<string, Point>,
): string[] {
  const N_RINGS  = 11;
  const N_PTS    = 60;   // sample points per ring — enough for smooth curves
  const R_MIN    = 36;   // innermost ring radius (px)
  const R_MAX    = OUTER_RADIUS * 0.83;
  const EPSILON  = 2800; // distance² softening — prevents singularity at node center
  const P_EXP    = 1.4;  // falloff exponent: > 1 = more localised deformation
  const MAX_DISP = 42;   // max displacement (inner ring); scales down for outer rings

  const masses = competitors
    .map((c) => ({ pos: gravPositions.get(c.competitor_id), mass: getNodeMass(c) }))
    .filter((m): m is { pos: Point; mass: number } => m.pos !== undefined && m.mass > 0.5);

  if (masses.length === 0) return [];

  return Array.from({ length: N_RINGS }, (_, ri) => {
    const t = ri / (N_RINGS - 1);
    // Log-spacing: inner rings denser, showing tighter curvature near masses
    const r0 = R_MIN * Math.pow(R_MAX / R_MIN, t);
    const ringMaxDisp = MAX_DISP * (1 - t * 0.45);

    const pts: Point[] = Array.from({ length: N_PTS }, (_, pi) => {
      const angle = (pi / N_PTS) * Math.PI * 2;
      const bx = CENTER + r0 * Math.cos(angle);
      const by = CENTER + r0 * Math.sin(angle);
      let dx = 0, dy = 0;
      for (const { pos, mass } of masses) {
        const ddx = pos.x - bx;
        const ddy = pos.y - by;
        const dist2 = ddx * ddx + ddy * ddy;
        const f = mass / (Math.pow(dist2, P_EXP / 2) + EPSILON);
        dx += ddx * f;
        dy += ddy * f;
      }
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > ringMaxDisp) { dx = (dx / mag) * ringMaxDisp; dy = (dy / mag) * ringMaxDisp; }
      return { x: bx + dx, y: by + dy };
    });

    return ptsToSmoothPath(pts);
  });
}

// ─── Orbit metadata per node ──────────────────────────────────────────────
type OrbitNodeData = {
  shell:      number;   // 0 = central star, 1-4 = orbital shells
  radius:     number;   // orbital radius in SVG units
  startAngle: number;   // initial angle (radians) at t=0
  period:     number;   // full orbit duration (seconds); Infinity for shell 0
  jitterX:    number;   // deterministic jitter for shell-0 star
  jitterY:    number;
};

// Pre-computes per-node orbit metadata. Pure function — no side effects.
// Uses Kepler's third law for periods: T ∝ r^1.5 (inner orbits faster).
function computeOrbitData(
  competitors: RadarCompetitor[],
): Map<string, OrbitNodeData> {
  if (competitors.length === 0) return new Map();

  const byMass = [...competitors].sort(
    (a, b) => getNodeMass(b) - getNodeMass(a),
  );
  const n = byMass.length;

  const SHELL_RADII = [22, 95, 175, 265, 360] as const;
  const SHELL_CAPS  = [1, 3, 7, 12, Infinity] as const;
  const GOLDEN      = 2.39996322972865332;
  // Orbital periods by Kepler: T = BASE * (r / r1)^1.5
  // Shell 1 (r=95) → 28s, Shell 4 (r=360) → ~155s (graceful, majestic)
  const BASE_PERIOD = 28;
  const REF_RADIUS  = 95;

  const shells: RadarCompetitor[][] = [[], [], [], [], []];
  let rank = 0;
  for (let s = 0; s < 5 && rank < n; s++) {
    const cap = SHELL_CAPS[s] === Infinity ? n - rank : (SHELL_CAPS[s] as number);
    for (let i = 0; i < cap && rank < n; i++) shells[s].push(byMass[rank++]);
  }

  const result = new Map<string, OrbitNodeData>();

  for (let s = 0; s < 5; s++) {
    const group = shells[s];
    if (!group.length) continue;
    const r = SHELL_RADII[Math.min(s, SHELL_RADII.length - 1)];

    if (s === 0) {
      const c = group[0];
      const jitter = (idHash(c.competitor_id) - 0.5) * 6;
      result.set(c.competitor_id, {
        shell: 0, radius: 0,
        startAngle: 0, period: Infinity,
        jitterX: jitter, jitterY: jitter * 0.4,
      });
      continue;
    }

    const count = group.length;
    for (let i = 0; i < count; i++) {
      const c = group[i];
      const angle  = (i / count) * Math.PI * 2 + s * GOLDEN;
      const nudge  = (idHash(c.competitor_id) - 0.5) * r * 0.08;
      const finalR = Math.min(OUTER_RADIUS * 0.90, r + nudge);
      const period = BASE_PERIOD * Math.pow(finalR / REF_RADIUS, 1.5);
      result.set(c.competitor_id, {
        shell: s, radius: finalR,
        startAngle: angle, period,
        jitterX: 0, jitterY: 0,
      });
    }
  }

  return result;
}

// ─── ORBIT mode: heliocentric node placement ───────────────────────────────
// Competitors are ranked by mass (momentum_score + pressure_index × 0.15).
// The highest-mass node is placed at the centre (the "sun"). All others
// are distributed across five orbital shells at increasing radii.
// Deterministic: same input → same layout every time.
function computeOrbitPositions(
  competitors: RadarCompetitor[],
  timeMs = 0,
): Map<string, Point> {
  const orbitData = computeOrbitData(competitors);
  const result    = new Map<string, Point>();

  for (const [id, data] of orbitData) {
    if (data.shell === 0) {
      result.set(id, { x: CENTER + data.jitterX, y: CENTER + data.jitterY });
      continue;
    }
    const angle = data.startAngle + (timeMs / 1000) * (2 * Math.PI / data.period);
    result.set(id, {
      x: CENTER + data.radius * Math.cos(angle),
      y: CENTER + data.radius * Math.sin(angle),
    });
  }

  // Collision resolution not applied to animated positions — too expensive per frame.
  // Static snapshot (timeMs=0) is used for contour computation.
  return result;
}

// ─── Enhanced Gravity Field: high-fidelity scalar-field contour deformation ──
// Same model as computeGravityContours but with tighter wells, more rings,
// and higher base opacity so warping is legible at a glance.
// Returns { path, fillOpacity } per ring — inner rings carry a depth fill.
function computeEnhancedContours(
  competitors: RadarCompetitor[],
  gravPositions: Map<string, Point>,
): { path: string; fillOpacity: number }[] {
  const N_RINGS  = 16;
  const N_PTS    = 80;
  const R_MIN    = 32;
  const R_MAX    = OUTER_RADIUS * 0.85;
  const EPSILON  = 1600;   // tighter than classic (2800) — sharper local wells
  const P_EXP    = 1.55;   // more localised falloff than classic (1.4)
  const MAX_DISP = 88;     // 2× classic (42) — dramatic field curvature

  const masses = competitors
    .map((c) => ({ pos: gravPositions.get(c.competitor_id), mass: getNodeMass(c) }))
    .filter((m): m is { pos: Point; mass: number } => m.pos !== undefined && m.mass > 0.3);

  if (masses.length === 0) return [];

  return Array.from({ length: N_RINGS }, (_, ri) => {
    const t = ri / (N_RINGS - 1);
    const r0 = R_MIN * Math.pow(R_MAX / R_MIN, t);
    const ringMaxDisp = MAX_DISP * (1 - t * 0.50);

    const pts: Point[] = Array.from({ length: N_PTS }, (_, pi) => {
      const angle = (pi / N_PTS) * Math.PI * 2;
      const bx = CENTER + r0 * Math.cos(angle);
      const by = CENTER + r0 * Math.sin(angle);
      let dx = 0, dy = 0;
      for (const { pos, mass } of masses) {
        const ddx = pos.x - bx;
        const ddy = pos.y - by;
        const dist2 = ddx * ddx + ddy * ddy;
        const f = mass / (Math.pow(dist2, P_EXP / 2) + EPSILON);
        dx += ddx * f;
        dy += ddy * f;
      }
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > ringMaxDisp) { dx = (dx / mag) * ringMaxDisp; dy = (dy / mag) * ringMaxDisp; }
      return { x: bx + dx, y: by + dy };
    });

    return {
      path: ptsToSmoothPath(pts),
      // Inner 6 rings carry a very faint depth fill to suggest gravitational depth
      fillOpacity: ri < 6 ? 0.011 * (1 - ri / 6) : 0,
    };
  });
}

// Label positions for enhanced mode: radial outward placement + 4 repulsion passes.
// Prevents vertical label overlap for nodes within 80px horizontal proximity.
function computeEnhancedLabelPositions(
  competitors: RadarCompetitor[],
  positions: Map<string, Point>,
): Map<string, { x: number; y: number; anchor: "start" | "end" | "middle" }> {
  const result = new Map<string, { x: number; y: number; anchor: "start" | "end" | "middle" }>();

  for (const c of competitors) {
    const pos = positions.get(c.competitor_id);
    if (!pos) continue;
    const nodeR = getNodeSize(Number(c.momentum_score ?? 0));
    const dist = Math.sqrt((pos.x - CENTER) ** 2 + (pos.y - CENTER) ** 2) || 1;
    const nx = (pos.x - CENTER) / dist;
    const ny = (pos.y - CENTER) / dist;
    result.set(c.competitor_id, {
      x: pos.x + nx * (nodeR + 16),
      y: pos.y + ny * (nodeR + 16) + 4,
      anchor: nx > 0.3 ? "start" : nx < -0.3 ? "end" : "middle",
    });
  }

  // Vertical repulsion: 4 passes, labels within 80px horizontal proximity
  const MIN_SEP = 16;
  const H_PROX  = 80;
  const entries = [...result.values()];
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (Math.abs(b.x - a.x) >= H_PROX) continue;
        const dy = b.y - a.y;
        const gap = MIN_SEP - Math.abs(dy);
        if (gap <= 0) continue;
        const push = gap * 0.45;
        if (dy >= 0) { a.y -= push; b.y += push; }
        else         { a.y += push; b.y -= push; }
      }
    }
  }

  return result;
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
  /** ORBIT mode: override position (skips golden-spiral layout) */
  gravityPos?: Point;
  /** ORBIT mode: suppress trail dots */
  orbitMode?: boolean;
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
  /** Enhanced gravity mode: precomputed label position with collision avoidance */
  gravityLabelOverride?: { x: number; y: number; anchor: "start" | "end" | "middle" };
  orbitShell?: number | null;
  onOrbitHover?: (shell: number | null, competitorId: string) => void;
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
  orbitMode,
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
  gravityLabelOverride,
  orbitShell = null,
  onOrbitHover,
}: BlipNodeProps) {
  const [hovered, setHovered] = useState(false);
  const momentum = Number(competitor.momentum_score ?? 0);

  // Dormant: momentum below stable threshold — receives de-emphasis treatment
  const isDormantNode = momentum < 1.5;

  // "Movement building" — rising momentum with a recent signal (not yet critical)
  const isBuilding =
    momentum >= 3 &&
    momentum < 5 &&
    !!competitor.last_signal_at &&
    Date.now() - new Date(competitor.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  const radius = radiusScale(momentum);
  const { x, y } = gravityPos ?? getNodePosition(index, total, radius);
  const color = competitor.latest_movement_type
    ? getMovementColor(competitor.latest_movement_type)
    : competitor.latest_signal_type
      ? getSignalColor(competitor.latest_signal_type)
      : getMovementColor(null);
  const nodeSize = getNodeSize(momentum);
  const echoDuration = getMomentumEchoDuration(momentum);
  // Ping brightness scaled by signal recency — fresh nodes flash brighter
  const pingPeak = (momentum >= 5 ? 0.88 : 0.68) * (0.45 + signalAgeGlow * 0.55);

  const ageOpacity = getAgeOpacity(competitor.latest_movement_last_seen_at);
  // Confidence-proportional opacity — low-confidence nodes render subtly subdued
  const conf = Number(competitor.latest_movement_confidence ?? 1.0);
  const confMult = isDimmed || timeDimmed || isSelected ? 1.0 : conf >= 0.65 ? 1.0 : conf >= 0.4 ? 0.88 : 0.75;
  // Dormant de-emphasis: lower base opacity when quiet and not selected/dimmed
  const dormantFade = isDormantNode && !isSelected && !isDimmed && !timeDimmed ? 0.52 : 1.0;
  const groupOpacity = (isDimmed ? 0.22 : timeDimmed ? 0.12 : isSelected ? 1.0 : ageOpacity) * confMult * dormantFade;

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
      {/* Signal age atmospheric glow — larger + more diffuse in Gravity Mode (influence sphere) */}
      {!isDimmed && !timeDimmed && signalAgeGlow > 0.18 && (
        <circle
          cx={x}
          cy={y}
          r={orbitMode ? nodeSize + 34 : nodeSize + 16}
          fill={color}
          fillOpacity={orbitMode ? signalAgeGlow * 0.12 : signalAgeGlow * 0.08}
          filter={orbitMode ? "url(#gravityGlow)" : "url(#blipGlow)"}
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
      <circle cx={x} cy={y} r={nodeSize + 8} fill="transparent"
        onMouseEnter={() => onOrbitHover?.(orbitShell ?? null, competitor.competitor_id)}
        onMouseLeave={() => onOrbitHover?.(null, competitor.competitor_id)}
      />

      {/* ── Ping flash (pinged state) ────────────────────────── */}
      {/* Fires once per revolution, timed to beam crossing.
          Hidden on dimmed blips so focus stays on the selected target.
          Gated on momentum >= 0.5 — cooling nodes don't animate. */}
      {!isDimmed && momentum >= 0.5 && (
        <motion.circle
          cx={x}
          cy={y}
          r={nodeSize + 5}
          fill={color}
          filter={momentum >= 3 ? "url(#blipGlow)" : undefined}
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
          Hidden on dimmed blips. Gated on momentum >= 0.5 — cooling nodes skip. */}
      {!isDimmed && momentum >= 0.5 && (
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
      {!isDimmed && momentum >= 0.5 && signalAgeGlow > 0.35 && (
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

      {/* Core blip — dormant: hollow outline; active: filled */}
      <motion.circle
        cx={x}
        cy={y}
        r={nodeSize}
        fill={isDormantNode ? "none" : color}
        stroke={isDormantNode ? color : "none"}
        strokeWidth={isDormantNode ? "1.2" : "0"}
        filter={isSelected ? "url(#blipGlowStrong)" : (isDormantNode ? "none" : "url(#blipGlow)")}
        animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />

      {/* Label — hidden for dormant nodes by default; shown on hover or selection */}
      {(!isDormantNode || isSelected || hovered) && (
        <text
          x={gravityLabelOverride ? gravityLabelOverride.x : (() => {
            if (!orbitMode) return x;
            const nx = (x - CENTER) / (Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2) || 1);
            return x + nx * (nodeSize + 13);
          })()}
          y={gravityLabelOverride ? gravityLabelOverride.y : (() => {
            if (!orbitMode) return y + nodeSize + 14;
            const dy = y - CENTER;
            const ny = dy / (Math.sqrt((x - CENTER) ** 2 + dy ** 2) || 1);
            return y + ny * (nodeSize + 13) + 4;
          })()}
          textAnchor={gravityLabelOverride ? gravityLabelOverride.anchor : (() => {
            if (!orbitMode) return "middle";
            const nx = (x - CENTER) / (Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2) || 1);
            return nx > 0.3 ? "start" : nx < -0.3 ? "end" : "middle";
          })()}
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
      )}

      {/* Dormant state hint — shown on hover to confirm presence without signal label */}
      {isDormantNode && hovered && !isSelected && (
        <text
          x={x}
          y={y + nodeSize + 27}
          textAnchor="middle"
          fill="rgba(100,116,139,0.50)"
          fontSize="9"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.05em"
          style={{ pointerEvents: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.98))" }}
        >
          dormant
        </text>
      )}

      {/* Tension description — shown on hover when strategic tension exists */}
      {hovered && tensionDescription && (
        <text
          x={x}
          y={y + nodeSize + (isDormantNode ? 40 : 28)}
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
          y={y + nodeSize + (tensionDescription ? (isDormantNode ? 53 : 40) : (isDormantNode ? 40 : 28))}
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

  // ── Signal arrival pulse rings ────────────────────────────────────────────
  // Detects competitors whose last_signal_at advanced since the previous
  // competitors prop (i.e. a real new signal, not just initial load).
  // One active pulse per node; dormant nodes are excluded.
  const [pulsing, setPulsing] = useState<Map<string, { color: string; key: string }>>(new Map());
  const prevSignalAtRef    = useRef<Map<string, string>>(new Map());
  const signalPulseInitRef = useRef(false);

  useEffect(() => {
    if (competitors.length === 0) return;

    if (!signalPulseInitRef.current) {
      // Record baseline on first load — do not fire any pulses yet
      competitors.forEach((c) => {
        if (c.last_signal_at) prevSignalAtRef.current.set(c.competitor_id, c.last_signal_at);
      });
      signalPulseInitRef.current = true;
      return;
    }

    const toAdd: [string, { color: string; key: string }][] = [];
    competitors.forEach((c) => {
      if (!c.last_signal_at || !c.latest_movement_type) return; // dormant = no pulse
      const prev = prevSignalAtRef.current.get(c.competitor_id);
      if (!prev || c.last_signal_at > prev) {
        toAdd.push([
          c.competitor_id,
          {
            color: getMovementColor(c.latest_movement_type),
            key: `pulse-${c.competitor_id}-${c.last_signal_at}`,
          },
        ]);
      }
      prevSignalAtRef.current.set(c.competitor_id, c.last_signal_at);
    });

    if (toAdd.length > 0) {
      setPulsing((prev) => {
        const next = new Map(prev);
        toAdd.forEach(([id, val]) => {
          if (!next.has(id)) next.set(id, val); // max 1 active pulse per node
        });
        return next;
      });
    }
  }, [competitors]);

  function clearPulse(competitorId: string) {
    setPulsing((prev) => {
      const next = new Map(prev);
      next.delete(competitorId);
      return next;
    });
  }

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
  const [orbitMode, setOrbitMode] = useState(false);
  // Enhanced sub-mode inside Gravity Field — deeper contours + label avoidance
  const [orbitHudActive, setOrbitHudActive] = useState(false);
  const orbitEverRef = useRef(false);
  // HUD panel hover — highlights matching nodes on the radar
  const [hudHighlight, setHudHighlight] = useState<
    | { type: 'category'; value: 'critical' | 'rising' | 'active' | 'convergence' }
    | { type: 'node'; id: string }
    | null
  >(null);

  // ── ORBIT animation — useAnimationFrame loop ─────────────────────────────
  // orbitTimeRef stores raw timestamp (ms). orbitTick triggers re-renders at ≈15fps.
  const orbitTimeRef = useRef(0);
  const [orbitTick, setOrbitTick] = useState(0);
  // Paused shell tracking — maps shell index → frozen angle (radians)
  const pausedShells  = useRef(new Map<number, number>());
  // Migration tracking — fires when a node moves to a different orbital shell
  const prevOrbitShells = useRef(new Map<string, number>());
  const activeMigrations = useRef(new Map<string, { fromR: number; toR: number; startMs: number }>());
  const [migrationTick, setMigrationTick] = useState(0);

  // Framer Motion's useAnimationFrame runs on every rAF tick with proper cleanup.
  // Updates React state at ≈15fps (66ms budget) — enough for graceful orbital motion.
  const lastTickRef = useRef(0);
  useAnimationFrame((t) => {
    if (!orbitMode) return;
    orbitTimeRef.current = t;
    if (t - lastTickRef.current > 66) {
      setOrbitTick(t);
      lastTickRef.current = t;
    }
  });
  // Reset tick when leaving orbit mode
  useEffect(() => { if (!orbitMode) { setOrbitTick(0); lastTickRef.current = 0; } }, [orbitMode]);

  // Dispatch gravity_shift achievement on first activation
  useEffect(() => {
    if (orbitMode && !orbitEverRef.current) {
      orbitEverRef.current = true;
      window.dispatchEvent(new CustomEvent("mv:achieve", { detail: "gravity_shift" }));
    }
  }, [orbitMode]);

  // Orbit metadata — stable per sorted set. Drives Items 2, 3, 5, 6.
  const orbitDataMap = useMemo(() => computeOrbitData(sorted), [sorted]);

  // The shell-0 node is the "sun" — highest mass competitor, placed at centre.
  const centralStarId = useMemo(() => {
    for (const [id, data] of orbitDataMap) {
      if (data.shell === 0) return id;
    }
    return null;
  }, [orbitDataMap]);

  // ── Migration detection — fires when sorted changes in ORBIT mode ────────
  useEffect(() => {
    if (!orbitMode || orbitDataMap.size === 0) return;
    const now = performance.now();
    let hasMigration = false;
    for (const [id, data] of orbitDataMap) {
      const prevShell = prevOrbitShells.current.get(id);
      if (prevShell !== undefined && prevShell !== data.shell) {
        const fromR = [22, 95, 175, 265, 360][Math.min(prevShell, 4)];
        const toR   = data.radius;
        activeMigrations.current.set(id, { fromR, toR, startMs: now });
        hasMigration = true;
      }
      prevOrbitShells.current.set(id, data.shell);
    }
    if (hasMigration) setMigrationTick(t => t + 1);
  }, [orbitMode, orbitDataMap, sorted]);

  // Positions are computed once per sorted set — memoized, deterministic, ~1ms
  const orbitPositions = useMemo(
    () => computeOrbitPositions(sorted),
    [sorted],
  );

  // Animated positions — updated at ≈15fps when ORBIT mode is active.
  // Uses orbitTick (which changes at ~15fps) to trigger recomputation.
  // Contours and other field geometry still use orbitPositions (static t=0 snapshot).
  const animatedOrbitPositions = useMemo(() => {
    if (!orbitMode) return orbitPositions;
    // Build positions respecting paused shells
    const orbitData = orbitDataMap;
    const result    = new Map<string, Point>();
    const tSec      = orbitTimeRef.current / 1000;
    for (const [id, data] of orbitData) {
      if (data.shell === 0) {
        result.set(id, { x: CENTER + data.jitterX, y: CENTER + data.jitterY });
        continue;
      }
      // Use frozen angle if shell is paused
      const frozenAngle = pausedShells.current.get(data.shell);
      const angle = frozenAngle !== undefined
        ? frozenAngle
        : data.startAngle + tSec * (2 * Math.PI / data.period);
      result.set(id, {
        x: CENTER + data.radius * Math.cos(angle),
        y: CENTER + data.radius * Math.sin(angle),
      });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbitMode, sorted, orbitTick, orbitDataMap]);


  // Spacetime grid — warped mesh showing gravitational influence of high-momentum nodes
  const orbitContours = useMemo(() => {
    if (!orbitMode || orbitPositions.size === 0) return [];
    return computeGravityContours(sorted, orbitPositions);
  }, [orbitMode, sorted, orbitPositions]);

  // Enhanced contours — deeper deformation, more rings, depth fills (enhanced sub-mode only)
  const enhancedContours = useMemo(() => {
    if (!orbitMode || !orbitHudActive || orbitPositions.size === 0) return [];
    return computeEnhancedContours(sorted, orbitPositions);
  }, [orbitMode, orbitHudActive, sorted, orbitPositions]);

  // Enhanced label positions — collision-resolved radial placement (enhanced sub-mode only)
  const enhancedLabelPositions = useMemo(() => {
    if (!orbitMode || !orbitHudActive) {
      return new Map<string, { x: number; y: number; anchor: "start" | "end" | "middle" }>();
    }
    return computeEnhancedLabelPositions(sorted, orbitPositions);
  }, [orbitMode, orbitHudActive, sorted, orbitPositions]);

  // Standard-mode node positions: zone-aware, ID-anchored placement.
  // Competitors are grouped by radial zone then spread across the zone's radius band.
  // sorted order is preserved within each zone for stable radius assignment.
  const standardPositions = useMemo((): Map<string, Point> => {
    const zoneGroups: Record<string, RadarCompetitor[]> = {
      dormant: [], watch: [], active: [], critical: [],
    };
    for (const c of sorted) {
      zoneGroups[getRadialZone(Number(c.momentum_score ?? 0))].push(c);
    }
    const map = new Map<string, Point>();
    for (const members of Object.values(zoneGroups)) {
      members.forEach((c, zi) => {
        map.set(
          c.competitor_id,
          getZoneNodePosition(c.competitor_id, Number(c.momentum_score ?? 0), zi, members.length),
        );
      });
    }
    return map;
  }, [sorted]);

  // ── HUD sector density — stable (uses orbitPositions/standardPositions, not animated) ──
  // Prevents sector density from recomputing on every orbitTick re-render.
  const hudSectorDensity = useMemo(() => {
    const positions = orbitMode ? orbitPositions : standardPositions;
    const counts = Array(6).fill(0) as number[];
    for (const c of sorted) {
      if (Number(c.momentum_score ?? 0) < 1.5) continue;
      const pos = positions.get(c.competitor_id);
      if (!pos) continue;
      const angle = Math.atan2(pos.y - CENTER, pos.x - CENTER);
      const norm = ((angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
      const sector = Math.floor(norm / (Math.PI / 3)) % 6;
      counts[sector]++;
    }
    return counts;
  }, [orbitMode, sorted, orbitPositions, standardPositions]);

  // ── Record positions for temporal trails ─────────────────────────────────
  // Fire-and-forget POST after each layout. Server dedup prevents more than
  // ~4 inserts per day per org. Visualization-only — failures are non-fatal.
  useEffect(() => {
    if (!orgId || sorted.length === 0 || standardPositions.size === 0) return;
    const rows = sorted
      .map((c) => {
        const pos = standardPositions.get(c.competitor_id);
        if (!pos) return null;
        return {
          competitor_id: c.competitor_id,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          pressure_index: c.pressure_index ?? 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length === 0) return;
    fetch("/api/record-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions: rows }),
    }).catch(() => {});
  }, [orgId, standardPositions]); // eslint-disable-line react-hooks/exhaustive-deps


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
  const usedFiltersRef = useRef(new Set<string>(["all"]));
  const zoomCanvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ screenX: 0, screenY: 0, panX: 0, panY: 0 });
  const touchDistRef = useRef(0);

  // Dispatch temporal_lens when all 3 filters used in a session
  useEffect(() => {
    usedFiltersRef.current.add(temporalFilter);
    if (usedFiltersRef.current.size >= 3) {
      window.dispatchEvent(new CustomEvent("mv:achieve", { detail: "temporal_lens" }));
    }
  }, [temporalFilter]);

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

  // Resolved color for the selected competitor's intelligence drawer.
  // Falls back to signal type color when no movement type is declared yet.
  const selectedColor = selected
    ? (selected.latest_movement_type
        ? getMovementColor(selected.latest_movement_type)
        : selected.latest_signal_type
          ? getSignalColor(selected.latest_signal_type)
          : getMovementColor(null))
    : getMovementColor(null);

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

  // Pauses the orbital shell of the hovered node so it can be clicked precisely.
  const handleOrbitHover = useCallback((shell: number | null, competitorId: string) => {
    if (!orbitMode) return;
    if (shell !== null && shell > 0) {
      if (!pausedShells.current.has(shell)) {
        const data = orbitDataMap.get(competitorId);
        if (data) {
          const frozenAngle = data.startAngle +
            (orbitTimeRef.current / 1000) * (2 * Math.PI / data.period);
          pausedShells.current.set(shell, frozenAngle);
        }
      }
    } else {
      pausedShells.current.clear();
    }
  }, [orbitMode, orbitDataMap]);

  const handleBlipClick = useCallback((id: string) => {
    getAudioManager().play("echo");
    setVisitedIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    setSelectedId((prev) => {
      if (prev !== id) {
        capture("competitor_selected", { competitor_id: id, source: "radar" });
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
    const positions = orbitMode ? orbitPositions : standardPositions;
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
  }, [isMobile, orbitMode, orbitPositions, standardPositions, handleBlipClick]);

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

  // ── Silent detail refresh on background radar update ─────────────────────
  // When router.refresh() fires (competitors prop changes) and the drawer is open,
  // silently re-fetch detail so signals stay current without closing the drawer.
  useEffect(() => {
    if (!selectedId || detailLoading) return;
    fetch(`/api/competitor-detail?id=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok || json.competitor) setDetail(json);
      })
      .catch(() => { /* non-fatal — stale data is acceptable on background refresh */ });
  // competitors is the dependency — fires when router.refresh() delivers new props
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors]);

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
    <div className="grid h-full gap-3 grid-cols-1 grid-rows-[1fr] lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_370px]">
      {/* ── Radar panel ─────────────────────────────────────────── */}
      <section
        className={`flex min-h-0 flex-1 flex-col overflow-hidden${isolated ? "" : " rounded-[20px]"}`}
        style={{
          background: "#000000",
          border: `1px solid ${orbitMode ? "#1a1040" : "#0d2010"}`,
          boxShadow: orbitMode
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
              borderBottom: `1px solid ${orbitMode ? "#150f30" : "#0a1c0a"}`,
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
                    background: orbitMode ? "#07051a" : "#020602",
                    border: `1px solid ${orbitMode ? "#1e1545" : "#0e2210"}`,
                    transition: "background 0.8s ease, border-color 0.8s ease",
                  }}
                >
                  <button
                    onClick={() => { if (orbitMode) { setOrbitMode(false); getAudioManager().play("orbit-exit"); } }}
                    className="rounded-[6px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: !orbitMode ? "rgba(46,230,166,0.09)" : "transparent",
                      color: !orbitMode ? "#2EE6A6" : orbitMode ? G.dim : "#3a5a3a",
                      boxShadow: !orbitMode ? "inset 0 0 0 1px rgba(46,230,166,0.18)" : "none",
                      transition: "color 0.6s ease, background 0.6s ease",
                    }}
                  >
                    Radar
                  </button>
                  <button
                    onClick={() => { if (!orbitMode) { setOrbitMode(true); getAudioManager().play("orbit-enter"); } }}
                    className="rounded-[6px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: orbitMode ? "rgba(129,140,248,0.12)" : "transparent",
                      color: orbitMode ? G.primary : "#3a5a3a",
                      boxShadow: orbitMode ? `inset 0 0 0 1px rgba(129,140,248,0.28)` : "none",
                      transition: "color 0.6s ease, background 0.6s ease, box-shadow 0.6s ease",
                    }}
                  >
                    ORBIT
                  </button>
                </div>

                {/* Enhanced sub-toggle — HUD overlay */}
                <button
                  onClick={() => setOrbitHudActive((v) => !v)}
                  className="rounded-[6px] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition-all duration-300"
                  style={{
                    background: orbitHudActive ? "rgba(203,213,225,0.10)" : "transparent",
                    color: orbitHudActive ? "#e2e8f0" : "#3a4a5a",
                    boxShadow: orbitHudActive
                      ? "inset 0 0 0 1px rgba(203,213,225,0.28)"
                      : "inset 0 0 0 1px rgba(30,30,40,0.6)",
                    marginLeft: "4px",
                  }}
                  aria-label={orbitHudActive ? "Disable HUD overlay" : "Enable HUD overlay"}
                  title="HUD — tactical intelligence overlay"
                >
                  HUD
                </button>

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
                {/* HUD: tight neon glow for text + key values */}
                <filter id="hudNeonGlow" x="-30%" y="-60%" width="160%" height="220%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* HUD: scanline pattern for glass panels */}
                <pattern id="hudScanlines" x="0" y="0" width="1" height="3" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="1000" y2="0" stroke="#ffffff" strokeWidth="0.35" strokeOpacity="0.03" />
                </pattern>
                {/* HUD: glass sheen gradient */}
                <linearGradient id="hudGlassSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.05" />
                  <stop offset="40%" stopColor="#ffffff" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </linearGradient>

                {/* ORBIT: wide bloom for central star sun flare */}
                <filter id="sunFlareGlow" x="-150%" y="-150%" width="400%" height="400%">
                  <feGaussianBlur stdDeviation="22" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* All radar content clipped to a perfect circle */}
              <g clipPath="url(#radarClip)">

              {/* Base field — shifts from black-green to black-violet in Gravity Mode */}
              <rect
                x="0"
                y="0"
                width={SIZE}
                height={SIZE}
                fill={orbitMode ? G.bg : "#010201"}
                style={{ transition: "fill 0.9s ease" }}
              />

              {/* Panel sheen — Standard Mode only; suppressed in Orbit (pure black) */}
              <rect
                x="0" y="0" width={SIZE} height={SIZE}
                fill="url(#panelSheen)"
                style={{ opacity: orbitMode ? 0 : 0.6, transition: "opacity 0.9s ease" }}
              />
              <rect
                x="0" y="0" width={SIZE} height={SIZE}
                fill="url(#panelSheenGravity)"
                style={{ opacity: 0 }}
              />

              {/* Central atmospheric glow — Standard Mode only; suppressed in Orbit */}
              <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="url(#radarCore)"
                style={{ opacity: orbitMode ? 0 : 1, transition: "opacity 0.9s ease" }}
              />
              <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="url(#radarCoreGravity)"
                style={{ opacity: 0 }}
              />

              {/* ── Rotating grid layer — rings, crosshairs, ticks ─── */}
              {/* Hidden in ORBIT mode — the circular instrument dissolves. */}
              <g style={{ opacity: orbitMode || orbitHudActive ? 0 : 1, transition: "opacity 0.8s ease" }}>
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
                    stroke={orbitMode ? G.ring : "#1e5c40"}
                    strokeWidth="1.8"
                    opacity={factor <= 0.3 ? 0.88 : factor <= 0.6 ? 0.70 : factor <= 0.9 ? 0.58 : 0.46}
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
                      stroke={orbitMode ? G.ring : "#1e5c40"}
                      strokeWidth="1.2"
                      opacity="0.72"
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
                    stroke={orbitMode ? G.ring : "#1e5c40"}
                    strokeWidth={tick.isMajor ? 1.5 : tick.isMedium ? 1.0 : 0.7}
                    opacity={tick.isMajor ? 0.90 : tick.isMedium ? 0.65 : 0.42}
                    style={{ transition: "stroke 0.8s ease" }}
                  />
                ))}

              </motion.g>
              </g>

              {/* Cardinal labels rendered outside clip (see below) */}

              {/* ── Sonar pulse field — Standard Mode (fades out in Gravity) ── */}
              <g style={{ opacity: orbitMode ? 0 : 1, transition: "opacity 1.0s ease", pointerEvents: "none" }}>
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

              {/* ── Gravity field propagation — suppressed in Orbit (pure black) ── */}
              <g style={{ opacity: 0, pointerEvents: "none" }}>
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

              {/* Center atmospheric fill — Standard Mode only */}
              <circle cx={CENTER} cy={CENTER} r={44} fill="url(#radarCore)"
                style={{ opacity: orbitMode ? 0 : 0.95, transition: "opacity 0.9s ease" }}
              />
              <circle cx={CENTER} cy={CENTER} r={44} fill="url(#radarCoreGravity)"
                style={{ opacity: 0 }}
              />

              {/* Emitter bloom — Standard Mode only */}
              <circle
                cx={CENTER} cy={CENTER} r={30}
                fill="#2EE6A6"
                opacity={orbitMode ? 0 : 0.14}
                filter="url(#blipGlowStrong)"
                style={{ transition: "opacity 0.8s ease" }}
              />

              {/* Breathing emitter dot — Standard Mode only */}
              <motion.circle
                cx={CENTER} cy={CENTER} r={7}
                fill="#dcfce7"
                filter="url(#blipGlow)"
                animate={{ opacity: orbitMode ? 0 : [1.0, 0.55, 1.0], scale: [1, 1.18, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              />

              {/* Hard center point — Standard Mode only */}
              <circle
                cx={CENTER} cy={CENTER} r={3}
                fill="#ffffff"
                opacity={orbitMode ? 0 : 0.98}
                style={{ transition: "opacity 0.8s ease" }}
              />

              {/* ── Gravity Field layers ────────────────────────────────────── */}
              {orbitMode && (
                <g style={{ opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.55s ease" }}>

                  {/* ── ORBIT: orbital shell guide rings — rendered below other gravity layers ── */}
                  {/* Moved outside radarClip (see below) so they render in full SVG space.       */}
                  {null /* rings rendered after radarClip group — see orbit-ring-outer below */}

                  {/* ── ORBIT: Central star — bright white, sun flare, neon corona ── */}
                  {centralStarId && (() => {
                    const starPos = orbitPositions.get(centralStarId);
                    if (!starPos) return null;
                    const starC = sorted.find(c => c.competitor_id === centralStarId);
                    const starR = getNodeSize(Number(starC?.momentum_score ?? 0)) + 6;
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        {/* Wide bloom — fills space around star */}
                        <circle cx={starPos.x} cy={starPos.y} r={starR + 8}
                          fill="#ffffff" fillOpacity="0.90"
                          filter="url(#sunFlareGlow)" />
                        {/* Solid white star disc */}
                        <circle cx={starPos.x} cy={starPos.y} r={starR}
                          fill="#ffffff" fillOpacity="1.0" />
                        {/* Inner hard rim */}
                        <circle cx={starPos.x} cy={starPos.y} r={starR + 3}
                          fill="none" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.55" />
                        {/* Rotating flare spokes — 12 rays, slow 18s rotation */}
                        <motion.g
                          animate={{ rotate: 360 }}
                          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                          style={{ transformOrigin: `${starPos.x}px ${starPos.y}px` }}
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const a = (i / 12) * Math.PI * 2;
                            const isMajor = i % 3 === 0;
                            const inner = starR + 4;
                            const outer = isMajor ? starR + 52 : starR + 28;
                            return (
                              <line key={`flare-${i}`}
                                x1={starPos.x + Math.cos(a) * inner}
                                y1={starPos.y + Math.sin(a) * inner}
                                x2={starPos.x + Math.cos(a) * outer}
                                y2={starPos.y + Math.sin(a) * outer}
                                stroke="#ffffff"
                                strokeWidth={isMajor ? 0.9 : 0.45}
                                strokeOpacity={isMajor ? 0.70 : 0.35}
                              />
                            );
                          })}
                        </motion.g>
                        {/* Slow corona pulse rings */}
                        {[0, 1, 2].map((i) => (
                          <motion.circle
                            key={`corona-${i}`}
                            cx={starPos.x} cy={starPos.y}
                            r={starR + 10}
                            fill="none" stroke="#ffffff" strokeWidth="0.8"
                            animate={{
                              r:       [starR + 10, starR + 70 + i * 22, starR + 10],
                              opacity: [0.55,        0,                    0.55],
                            }}
                            transition={{
                              duration: 4 + i * 1.8,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: i * 1.2,
                            }}
                          />
                        ))}
                        {/* Counter-rotating secondary flare — offset 15° */}
                        <motion.g
                          animate={{ rotate: -360 }}
                          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
                          style={{ transformOrigin: `${starPos.x}px ${starPos.y}px` }}
                        >
                          {Array.from({ length: 4 }, (_, i) => {
                            const a = (i / 4) * Math.PI * 2 + Math.PI / 12;
                            const inner = starR + 6;
                            const outer = starR + 38;
                            return (
                              <line key={`flare2-${i}`}
                                x1={starPos.x + Math.cos(a) * inner}
                                y1={starPos.y + Math.sin(a) * inner}
                                x2={starPos.x + Math.cos(a) * outer}
                                y2={starPos.y + Math.sin(a) * outer}
                                stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.28"
                              />
                            );
                          })}
                        </motion.g>
                      </g>
                    );
                  })()}

                  {/* ── GRAVITY FIELD: Cartesian grid — black field, blue lines ── */}
                  {orbitMode && (
                    <g style={{ pointerEvents: "none" }}>
                      {Array.from({ length: 13 }, (_, i) => {
                        const gx = CENTER - OUTER_RADIUS + (i / 12) * OUTER_RADIUS * 2;
                        return (
                          <line key={`gv-${i}`}
                            x1={gx} y1={CENTER - OUTER_RADIUS}
                            x2={gx} y2={CENTER + OUTER_RADIUS}
                            stroke="#3b82f6" strokeWidth="0.55" strokeOpacity="0.28"
                          />
                        );
                      })}
                      {Array.from({ length: 13 }, (_, i) => {
                        const gy = CENTER - OUTER_RADIUS + (i / 12) * OUTER_RADIUS * 2;
                        return (
                          <line key={`gh-${i}`}
                            x1={CENTER - OUTER_RADIUS} y1={gy}
                            x2={CENTER + OUTER_RADIUS} y2={gy}
                            stroke="#3b82f6" strokeWidth="0.55" strokeOpacity="0.28"
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* ── GRAVITY FIELD: deformed field contours — white, minimal ── */}
                  {false && (
                    <g style={{ pointerEvents: "none" }}>
                      {orbitContours.map((d, i) => {
                        const t = i / (orbitContours.length - 1);
                        return (
                          <path key={`gc-${i}`} d={d} fill="none"
                            stroke="#ffffff"
                            strokeWidth={0.55 - t * 0.22}
                            strokeOpacity={0.052 - t * 0.030}
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* ── GRAVITY FIELD: per-node mass aura — soft radial depth well ── */}
                  {false && sorted.map((c) => {
                    const mPos = orbitPositions.get(c.competitor_id);
                    if (!mPos) return null;
                    const mass = getNodeMass(c);
                    if (mass < 0.5) return null;
                    const nR = getNodeSize(Number(c.momentum_score ?? 0));
                    const auraR = nR + 22 + mass * 7;
                    const auraColor = c.latest_movement_type
                      ? getMovementColor(c.latest_movement_type)
                      : G.primary;
                    return (
                      <circle key={`aura-${c.competitor_id}`}
                        cx={mPos.x} cy={mPos.y} r={auraR}
                        fill={auraColor} fillOpacity={0.020 + mass * 0.008}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  })}

                  {/* ── GRAVITY FIELD: relationship threads — same movement type ── */}
                  {false && (() => {
                    const threads: React.ReactNode[] = [];
                    const seen = new Set<string>();
                    for (let i = 0; i < sorted.length; i++) {
                      for (let j = i + 1; j < sorted.length; j++) {
                        const a = sorted[i], b = sorted[j];
                        if (!a.latest_movement_type || a.latest_movement_type !== b.latest_movement_type) continue;
                        const tKey = `${a.competitor_id}|${b.competitor_id}`;
                        if (seen.has(tKey)) continue;
                        seen.add(tKey);
                        const tPosA = orbitPositions.get(a.competitor_id);
                        const tPosB = orbitPositions.get(b.competitor_id);
                        if (!tPosA || !tPosB) continue;
                        threads.push(
                          <line key={tKey}
                            x1={(tPosA as {x:number;y:number}).x} y1={(tPosA as {x:number;y:number}).y} x2={(tPosB as {x:number;y:number}).x} y2={(tPosB as {x:number;y:number}).y}
                            stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.28"
                            style={{ pointerEvents: "none" }}
                          />,
                        );
                      }
                    }
                    return <g style={{ pointerEvents: "none" }}>{threads}</g>;
                  })()}

                  {/* ── GRAVITY FIELD: center anchor ── */}
                  {false && (
                    <circle cx={CENTER} cy={CENTER} r={3.5}
                      fill="#ffffff" fillOpacity={0.25}
                      style={{ pointerEvents: "none" }}
                    />
                  )}

                  {/* ── DEEP FIELD: iso-contour terrain — topographic mass landscape ── */}
                  {false && (
                    <g style={{ pointerEvents: "none" }}>
                      {enhancedContours.map(({ path, fillOpacity: _ }, i) => {
                        const t = i / (enhancedContours.length - 1);
                        return (
                          <path key={`ec-${i}`} d={path} fill="none"
                            stroke="#ffffff"
                            strokeWidth={0.55 - t * 0.35}
                            strokeOpacity={0.058 - t * 0.040}
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* ── DEEP FIELD: thread fabric — nearest-neighbor connections ── */}
                  {false && (() => {
                    const dfEntries = sorted
                      .map((c) => ({
                        id: c.competitor_id,
                        pos: orbitPositions.get(c.competitor_id),
                        mass: getNodeMass(c),
                      }))
                      .filter((e): e is { id: string; pos: Point; mass: number } => e.pos !== undefined);
                    const dfThreads: React.ReactNode[] = [];
                    const dfSeen = new Set<string>();
                    for (const node of dfEntries) {
                      const neighbors = dfEntries
                        .filter((e) => e.id !== node.id)
                        .map((e) => ({
                          ...e,
                          dist: Math.sqrt(
                            (e.pos.x - node.pos.x) ** 2 + (e.pos.y - node.pos.y) ** 2,
                          ),
                        }))
                        .sort((a, b) => a.dist - b.dist)
                        .slice(0, 2);
                      for (const nb of neighbors) {
                        const dfKey = [node.id, nb.id].sort().join("|");
                        if (dfSeen.has(dfKey)) continue;
                        dfSeen.add(dfKey);
                        const sim = 1 - Math.abs(node.mass - nb.mass) /
                          Math.max(node.mass + nb.mass, 0.01);
                        dfThreads.push(
                          <line key={dfKey}
                            x1={node.pos.x} y1={node.pos.y}
                            x2={nb.pos.x}   y2={nb.pos.y}
                            stroke="#ffffff" strokeWidth="0.40"
                            strokeOpacity={0.035 + sim * 0.055}
                            style={{ pointerEvents: "none" }}
                          />,
                        );
                      }
                    }
                    return <g style={{ pointerEvents: "none" }}>{dfThreads}</g>;
                  })()}

                  {/* ── Selected: relationship lines ── */}
                  {selected && (() => {
                    const selPos = animatedOrbitPositions.get(selected.competitor_id);
                    if (!selPos || !selected.latest_movement_type) return null;
                    const relColor = orbitHudActive
                      ? "rgba(255,255,255,0.50)"
                      : selectedColor;
                    return sorted
                      .filter(
                        (c) =>
                          c.competitor_id !== selected.competitor_id &&
                          c.latest_movement_type === selected.latest_movement_type,
                      )
                      .map((c) => {
                        const pos = animatedOrbitPositions.get(c.competitor_id);
                        if (!pos) return null;
                        return (
                          <line
                            key={`rel-${c.competitor_id}`}
                            x1={selPos.x} y1={selPos.y}
                            x2={pos.x} y2={pos.y}
                            stroke={relColor}
                            strokeWidth={1.2}
                            strokeOpacity={0.38}
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      });
                  })()}

                  {/* ── ORBIT: Conjunction arcs — brief arc when same-type nodes approach ── */}
                  {(() => {
                    const conjunctions: React.ReactNode[] = [];
                    const CONJ_DIST = 70;
                    const seen = new Set<string>();
                    for (let i = 0; i < sorted.length; i++) {
                      for (let j = i + 1; j < sorted.length; j++) {
                        const a = sorted[i], b = sorted[j];
                        if (!a.latest_movement_type || a.latest_movement_type !== b.latest_movement_type) continue;
                        const pA = animatedOrbitPositions.get(a.competitor_id);
                        const pB = animatedOrbitPositions.get(b.competitor_id);
                        if (!pA || !pB) continue;
                        const dx = pB.x - pA.x, dy = pB.y - pA.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > CONJ_DIST) continue;
                        const key = [a.competitor_id, b.competitor_id].sort().join('|');
                        if (seen.has(key)) continue;
                        seen.add(key);
                        // Proximity factor: 1 = touching, 0 = at threshold
                        const proximity = 1 - dist / CONJ_DIST;
                        // Arc midpoint slightly offset perpendicular
                        const mx = (pA.x + pB.x) / 2;
                        const my = (pA.y + pB.y) / 2;
                        const px = -dy / dist * 20;
                        const py =  dx / dist * 20;
                        const d = `M ${pA.x.toFixed(1)},${pA.y.toFixed(1)} Q ${(mx + px).toFixed(1)},${(my + py).toFixed(1)} ${pB.x.toFixed(1)},${pB.y.toFixed(1)}`;
                        const arcColor = getMovementColor(a.latest_movement_type);
                        conjunctions.push(
                          <g key={`conj-${key}`} style={{ pointerEvents: "none" }}>
                            <path d={d} fill="none"
                              stroke={arcColor}
                              strokeWidth={0.6 + proximity * 0.8}
                              strokeOpacity={0.15 + proximity * 0.40}
                            />
                            <text x={mx + px * 0.5} y={my + py * 0.5 - 5}
                              textAnchor="middle"
                              fill={arcColor} fillOpacity={0.35 + proximity * 0.30}
                              fontFamily="'Courier New', Monaco, monospace"
                              fontSize="5" letterSpacing="0.14em"
                            >
                              CONJUNCTION
                            </text>
                          </g>
                        );
                      }
                    }
                    return <g>{conjunctions}</g>;
                  })()}

                  {/* ── ORBIT: Migration rings — node moving to new shell ── */}
                  {migrationTick >= 0 && (() => {
                    const now = performance.now();
                    const rings: React.ReactNode[] = [];
                    for (const [id, mig] of activeMigrations.current) {
                      const elapsed = now - mig.startMs;
                      if (elapsed > 2200) { activeMigrations.current.delete(id); continue; }
                      const pos = animatedOrbitPositions.get(id);
                      if (!pos) continue;
                      const t = elapsed / 2000; // 0→1
                      const r = mig.fromR + (mig.toR - mig.fromR) * t;
                      rings.push(
                        <circle key={`mig-${id}`}
                          cx={CENTER} cy={CENTER} r={r}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={1.0 - t * 0.7}
                          strokeOpacity={0.45 - t * 0.40}
                          strokeDasharray="6 12"
                          style={{ pointerEvents: "none" }}
                        />,
                      );
                    }
                    return <g>{rings}</g>;
                  })()}

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
                      const pos = orbitMode
                        ? animatedOrbitPositions.get(echo.competitorId)
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

              {/* ── Temporal movement trails — rendered behind blips ──────── */}
              {/* Shows each competitor's historical SVG positions as a fading   */}
              {/* line, newest-to-oldest, with a directional arrowhead.          */}
              {!orbitMode && entryPhase >= 2 && sorted.some((c) => (c.trail ?? []).length > 0) && (
                <g style={{ pointerEvents: "none" }} aria-hidden>
                  {sorted.map((competitor) => {
                    const trail = competitor.trail ?? [];
                    if (trail.length === 0) return null;
                    const pos = standardPositions.get(competitor.competitor_id);
                    if (!pos) return null;

                    // Dimmed nodes lose their trails to avoid visual noise
                    if (selectedId !== null && competitor.competitor_id !== selectedId) return null;

                    const color = competitor.latest_movement_type
                      ? getMovementColor(competitor.latest_movement_type)
                      : competitor.latest_signal_type
                        ? getSignalColor(competitor.latest_signal_type)
                        : getMovementColor(null);

                    // Density control: reduce opacity when many competitors are visible
                    const baseOpacity = sorted.length > 12 ? 0.45 : 1.0;

                    // Points: current position + up to 7 historical
                    const pts = [{ x: pos.x, y: pos.y }, ...trail.slice(0, 7)];

                    // Fading segments from current toward oldest
                    const momentum = Number(competitor.momentum_score ?? 0);
                    const nodeSize = getNodeSize(momentum);

                    // Direction arrow: from trail[0] → current pos, just outside node edge
                    let arrow: React.ReactNode = null;
                    if (pts.length >= 2) {
                      const dx = pts[0].x - pts[1].x;
                      const dy = pts[0].y - pts[1].y;
                      const len = Math.sqrt(dx * dx + dy * dy);
                      if (len > nodeSize + 6) {
                        const ux = dx / len;
                        const uy = dy / len;
                        // Arrowhead tip just outside node radius
                        const tipX = pts[0].x - ux * (nodeSize + 2);
                        const tipY = pts[0].y - uy * (nodeSize + 2);
                        const sz = 5.5;
                        const b1x = tipX - ux * sz - uy * sz * 0.55;
                        const b1y = tipY - uy * sz + ux * sz * 0.55;
                        const b2x = tipX - ux * sz + uy * sz * 0.55;
                        const b2y = tipY - uy * sz - ux * sz * 0.55;
                        arrow = (
                          <polygon
                            points={`${tipX.toFixed(1)},${tipY.toFixed(1)} ${b1x.toFixed(1)},${b1y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)}`}
                            fill={color}
                            fillOpacity={0.50 * baseOpacity}
                          />
                        );
                      }
                    }

                    return (
                      <g key={`trail-${competitor.competitor_id}`}>
                        {pts.slice(0, -1).map((pt, i) => {
                          const next = pts[i + 1];
                          const opacity = 0.52 * Math.pow(0.62, i) * baseOpacity;
                          const sw = Math.max(0.4, 1.6 - i * 0.20);
                          return (
                            <line
                              key={i}
                              x1={pt.x} y1={pt.y}
                              x2={next.x} y2={next.y}
                              stroke={color}
                              strokeWidth={sw}
                              strokeOpacity={opacity}
                              strokeLinecap="round"
                            />
                          );
                        })}
                        {arrow}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* ── Signal arrival pulse rings ─────────────────────────── */}
              {/* Expand from node center outward when a fresh signal lands. */}
              {/* One ring per competitor, auto-cleaned after animation.    */}
              {entryPhase >= 2 && pulsing.size > 0 && (
                <g style={{ pointerEvents: "none" }} aria-hidden>
                  {[...pulsing.entries()].map(([competitorId, { color, key }]) => {
                    const pos = standardPositions.get(competitorId);
                    if (!pos) return null;
                    const c = sorted.find((sc) => sc.competitor_id === competitorId);
                    const r0 = getNodeSize(Number(c?.momentum_score ?? 0));
                    return (
                      <motion.circle
                        key={key}
                        cx={pos.x}
                        cy={pos.y}
                        r={r0}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.4}
                        initial={{ r: r0, opacity: 0.70, scale: 1 }}
                        animate={{ r: r0 + 90, opacity: 0, scale: 1 }}
                        transition={{ duration: 1.05, ease: "easeOut" }}
                        onAnimationComplete={() => clearPulse(competitorId)}
                      />
                    );
                  })}
                </g>
              )}

              {/* ── Competitor blips — revealed at entry phase 2 ──────── */}
              {/* ORBIT + HUD: desaturate + brighten to white-star monochrome aesthetic */}
              <g style={{
                opacity: entryPhase >= 2 ? 1 : 0,
                transition: "opacity 0.4s ease, filter 0.8s ease",
                filter: orbitMode && orbitHudActive ? "saturate(0) brightness(3.2)" : "none",
              }}>
              {sorted.map((competitor, index) => (
                <BlipNode
                  key={competitor.competitor_id}
                  competitor={competitor}
                  index={index}
                  total={sorted.length}
                  radiusScale={radiusScale}
                  isSelected={competitor.competitor_id === selectedId}
                  isDimmed={
                    (selectedId !== null && competitor.competitor_id !== selectedId) ||
                    (hudHighlight !== null && !(
                      hudHighlight.type === 'node'
                        ? hudHighlight.id === competitor.competitor_id
                        : hudHighlight.value === 'critical'
                          ? Number(competitor.momentum_score ?? 0) >= 5
                          : hudHighlight.value === 'rising'
                            ? Number(competitor.momentum_score ?? 0) >= 3
                            : hudHighlight.value === 'active'
                              ? Number(competitor.momentum_score ?? 0) >= 1.5
                              : /* convergence */ tensionLinks.some(
                                  l => l.idA === competitor.competitor_id || l.idB === competitor.competitor_id
                                )
                    ))
                  }
                  isAlerted={alertActive && competitor.competitor_id === criticalAlert?.competitor_id}
                  onSelect={handleBlipClick}
                  isMobile={isMobile}
                  gravityPos={
                    orbitMode
                      ? (() => {
                          const pos = animatedOrbitPositions.get(competitor.competitor_id);
                          if (!pos) return undefined;
                          const mass  = getNodeMass(competitor);
                          const depth = Math.min(mass * 8, 70);
                          return { x: pos.x, y: pos.y + depth };
                        })()
                      : standardPositions.get(competitor.competitor_id)
                  }
                  orbitMode={orbitMode}
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
                  gravityLabelOverride={
                    orbitMode && orbitHudActive
                      ? enhancedLabelPositions.get(competitor.competitor_id)
                      : undefined
                  }
                  orbitShell={orbitMode ? (orbitDataMap.get(competitor.competitor_id)?.shell ?? null) : null}
                  onOrbitHover={orbitMode ? handleOrbitHover : undefined}
                />
              ))}
              </g>

              {/* ── HUD: in-circle tactical layer (brackets, scan lines, callout lines, convergence) */}
              {orbitMode && sorted.length > 0 && (() => {
                const hudPos = orbitMode ? animatedOrbitPositions : standardPositions;

                // Sector density — use the memoized computation (avoids per-orbitTick recompute)
                const sectorCounts = hudSectorDensity;
                const maxSectorCount = Math.max(...sectorCounts, 1);
                const hottestSector  = sectorCounts.indexOf(Math.max(...sectorCounts));
                void hottestSector; // used in G annotation below

                // Corner brackets
                const BR = OUTER_RADIUS * 0.66;
                const BL = 20;
                const bracketCorners = [
                  { x: CENTER - BR, y: CENTER - BR, sx:  1, sy:  1 },
                  { x: CENTER + BR, y: CENTER - BR, sx: -1, sy:  1 },
                  { x: CENTER + BR, y: CENTER + BR, sx: -1, sy: -1 },
                  { x: CENTER - BR, y: CENTER + BR, sx:  1, sy: -1 },
                ];

                return (
                  <g style={{ pointerEvents: "none", opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.6s ease" }}>

                    {/* A: Corner targeting brackets */}
                    {bracketCorners.map(({ x, y, sx, sy }, bi) => (
                      <g key={`hud-bracket-${bi}`}>
                        <line x1={x} y1={y} x2={x + sx * BL} y2={y} stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.30" />
                        <line x1={x} y1={y} x2={x} y2={y + sy * BL} stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.30" />
                      </g>
                    ))}

                    {/* B: Field status header arc text — top of circle */}
                    <text
                      x={CENTER} y={CENTER - OUTER_RADIUS + 24}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#ffffff" fillOpacity="0.32"
                      fontFamily="'Courier New', Monaco, monospace"
                      fontSize="6.5" letterSpacing="0.22em"
                    >
                      {`◈ METRIVANT INTELLIGENCE FIELD  ·  ${sorted.length} NODES`}
                    </text>

                    {/* C: Sector radial dividers + Roman numeral labels */}
                    {Array.from({ length: 6 }, (_, si) => {
                      const angle    = (si / 6) * Math.PI * 2 - Math.PI / 2;
                      const midAngle = angle + Math.PI / 6;
                      const x2 = CENTER + OUTER_RADIUS * 0.96 * Math.cos(angle);
                      const y2 = CENTER + OUTER_RADIUS * 0.96 * Math.sin(angle);
                      const labelR = OUTER_RADIUS * 0.82;
                      return (
                        <g key={`hud-sector-${si}`}>
                          {/* Sector density fill — wedge from center to perimeter */}
                          {sectorCounts[si] > 0 && (() => {
                            const density = sectorCounts[si] / maxSectorCount;
                            const nextAngle = ((si + 1) / 6) * Math.PI * 2 - Math.PI / 2;
                            const r = OUTER_RADIUS * 0.95;
                            const x1w = CENTER + r * Math.cos(angle);
                            const y1w = CENTER + r * Math.sin(angle);
                            const x2w = CENTER + r * Math.cos(nextAngle);
                            const y2w = CENTER + r * Math.sin(nextAngle);
                            return (
                              <path
                                d={`M ${CENTER},${CENTER} L ${x1w.toFixed(1)},${y1w.toFixed(1)} A ${r},${r} 0 0,1 ${x2w.toFixed(1)},${y2w.toFixed(1)} Z`}
                                fill="#ffffff"
                                fillOpacity={density * 0.035}
                                style={{ pointerEvents: "none" }}
                              />
                            );
                          })()}
                          <line x1={CENTER} y1={CENTER} x2={x2} y2={y2}
                            stroke="#ffffff" strokeWidth="0.28" strokeOpacity="0.055" />
                          <text
                            x={CENTER + labelR * Math.cos(midAngle)}
                            y={CENTER + labelR * Math.sin(midAngle)}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="#ffffff" fillOpacity="0.10"
                            fontFamily="'Courier New', Monaco, monospace"
                            fontSize="9" letterSpacing="0.18em"
                          >
                            {(["I", "II", "III", "IV", "V", "VI"] as const)[si]}
                          </text>
                        </g>
                      );
                    })}

                    {/* D: Node callout lines — top 5 by momentum — minimal by default */}
                    {sorted.slice(0, 5).map((c) => {
                      const pos = hudPos.get(c.competitor_id);
                      if (!pos) return null;
                      const isSelected = c.competitor_id === selectedId;
                      const nodeR = getNodeSize(Number(c.momentum_score ?? 0));
                      const dx = pos.x - CENTER, dy = pos.y - CENTER;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                      const nx = dx / dist, ny = dy / dist;
                      const lx1 = pos.x + nx * (nodeR + 3);
                      const ly1 = pos.y + ny * (nodeR + 3);
                      const lx2 = pos.x + nx * (nodeR + 28);
                      const ly2 = pos.y + ny * (nodeR + 28);
                      return (
                        <g key={`hud-callout-${c.competitor_id}`} opacity={isSelected ? 0 : 1}>
                          <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
                            stroke="#ffffff" strokeWidth="0.4" strokeOpacity="0.30" />
                          <circle cx={lx2} cy={ly2} r={1.0} fill="#ffffff" fillOpacity="0.40" />
                          <text
                            x={lx2 + (nx > 0.25 ? 3 : nx < -0.25 ? -3 : 0)}
                            y={ly2 - 3}
                            textAnchor={nx > 0.25 ? "start" : nx < -0.25 ? "end" : "middle"}
                            fill="#ffffff" fillOpacity="0.45"
                            fontFamily="'Courier New', Monaco, monospace"
                            fontSize="5.5" letterSpacing="0.10em"
                          >
                            {c.competitor_name.toUpperCase().slice(0, 8)}
                          </text>
                        </g>
                      );
                    })}

                    {/* E: Convergence markers at tension link midpoints */}
                    {tensionLinks
                      .filter(l => l.intensity > 0.72)
                      .slice(0, 6)
                      .map(link => {
                        const pA = hudPos.get(link.idA);
                        const pB = hudPos.get(link.idB);
                        if (!pA || !pB) return null;
                        const mx = (pA.x + pB.x) / 2;
                        const my = (pA.y + pB.y) / 2;
                        return (
                          <g key={`hud-conv-${link.idA}-${link.idB}`}>
                            <text x={mx} y={my - 2} textAnchor="middle" dominantBaseline="middle"
                              fill="#ffffff" fillOpacity="0.35"
                              fontFamily="'Courier New', Monaco, monospace" fontSize="8">
                              ◈
                            </text>
                            <text x={mx} y={my + 8} textAnchor="middle"
                              fill="#ffffff" fillOpacity="0.20"
                              fontFamily="'Courier New', Monaco, monospace"
                              fontSize="4.5" letterSpacing="0.16em">
                              CONVERGING
                            </text>
                          </g>
                        );
                      })}

                    {/* G: Central star annotation in ORBIT+HUD */}
                    {orbitMode && centralStarId && (() => {
                      const starPos = hudPos.get(centralStarId);
                      if (!starPos) return null;
                      const starC = sorted.find(c => c.competitor_id === centralStarId);
                      const starR = getNodeSize(Number(starC?.momentum_score ?? 0));
                      return (
                        <g style={{ pointerEvents: "none" }}>
                          <text
                            x={starPos.x}
                            y={starPos.y - starR - 22}
                            textAnchor="middle"
                            fill="#ffffff" fillOpacity="0.42"
                            fontFamily="'Courier New', Monaco, monospace"
                            fontSize="5.5" letterSpacing="0.24em"
                          >
                            ★ PRIMARY MASS
                          </text>
                          <text
                            x={starPos.x}
                            y={starPos.y - starR - 13}
                            textAnchor="middle"
                            fill="#ffffff" fillOpacity="0.22"
                            fontFamily="'Courier New', Monaco, monospace"
                            fontSize="4.5" letterSpacing="0.16em"
                          >
                            ANCHORED · SHELL 0
                          </text>
                        </g>
                      );
                    })()}

                    {/* F: Selected node targeting reticle (in-circle) — brackets + TRACKING label only */}
                    {selected && (() => {
                      const selPos = hudPos.get(selected.competitor_id);
                      if (!selPos) return null;
                      const nodeR = getNodeSize(Number(selected.momentum_score ?? 0)) + 10;
                      const B = 10;
                      const corners2 = [
                        { x: selPos.x - nodeR, y: selPos.y - nodeR, sx:  1, sy:  1 },
                        { x: selPos.x + nodeR, y: selPos.y - nodeR, sx: -1, sy:  1 },
                        { x: selPos.x + nodeR, y: selPos.y + nodeR, sx: -1, sy: -1 },
                        { x: selPos.x - nodeR, y: selPos.y + nodeR, sx:  1, sy: -1 },
                      ];
                      return (
                        <g>
                          {corners2.map(({ x, y, sx, sy }, ci) => (
                            <g key={`hud-tgt-${ci}`}>
                              <line x1={x} y1={y} x2={x + sx * B} y2={y} stroke="#ffffff" strokeWidth="1.0" strokeOpacity="0.65" />
                              <line x1={x} y1={y} x2={x} y2={y + sy * B} stroke="#ffffff" strokeWidth="1.0" strokeOpacity="0.65" />
                            </g>
                          ))}
                          <text x={selPos.x} y={selPos.y - nodeR - 7}
                            textAnchor="middle"
                            fill="#ffffff" fillOpacity="0.55"
                            fontFamily="'Courier New', Monaco, monospace"
                            fontSize="6" letterSpacing="0.26em">
                            TRACKING
                          </text>
                          {/* Connector line from node toward the corner panel */}
                          {(() => {
                            const panelOnRight = selPos.x < CENTER;
                            const edgeX = panelOnRight ? selPos.x + nodeR + 1 : selPos.x - nodeR - 1;
                            const targetX = panelOnRight ? 820 : 180;
                            return (
                              <line
                                x1={edgeX} y1={selPos.y}
                                x2={targetX} y2={selPos.y}
                                stroke="#ffffff" strokeWidth="0.35"
                                strokeOpacity="0.18"
                                strokeDasharray="3 6"
                              />
                            );
                          })()}
                        </g>
                      );
                    })()}

                  </g>
                );
              })()}

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
                    {sector === "custom" ? "STANDBY" : "CALIBRATING"}
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
                    {sector === "custom"
                      ? "Add rivals from Discover to begin monitoring"
                      : "Establishing baselines · first signals within the hour"}
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
                style={{ opacity: orbitMode ? 0 : 1 }}
              />

              {/* Glass highlight — very faint top-left reflection, instrument polish */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="url(#glassHighlight)"
                pointerEvents="none"
              />

              {/* Radar breathing state — Standard Mode only */}
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS * 0.38}
                fill="url(#radarCore)"
                animate={{ opacity: orbitMode ? 0 : [0.0, 0.09, 0.0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                style={{ pointerEvents: "none" }}
              />

              </g>{/* end radarClip */}

              {/* ── ORBIT: orbital shell guide rings — outside radarClip so they render   */}
              {/* in the full 1000×1000 SVG space without being clipped to r=420.           */}
              {/* Radii 95–360 are all within OUTER_RADIUS=420 so they stay inside the      */}
              {/* visible instrument face, but the group itself is unclipped.               */}
              {orbitMode && (
                <g style={{ pointerEvents: "none", opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.55s ease" }}>
                  {([
                    { r: 95,  stroke: "rgba(80,150,255,0.58)",  dash: "2 5",  width: 0.80 },
                    { r: 175, stroke: "rgba(60,120,230,0.40)",  dash: "3 7",  width: 0.65 },
                    { r: 265, stroke: "rgba(45,95,200,0.28)",   dash: "4 9",  width: 0.52 },
                    { r: 360, stroke: "rgba(35,70,170,0.18)",   dash: "5 11", width: 0.40 },
                  ] as const).map(({ r, stroke, dash, width }, i) => (
                    <circle
                      key={`orbit-ring-outer-${i}`}
                      cx={CENTER} cy={CENTER} r={r}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={width}
                      strokeDasharray={dash}
                    />
                  ))}
                </g>
              )}

              {/* HUD CORNER PANELS — rendered below, inside main SVG, zoom-synced with radar */}

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
                  fill={orbitMode ? "rgba(40,35,80,0.85)" : "rgba(30,41,59,0.7)"}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.06em"
                  style={{ transition: "fill 0.8s ease" }}
                >
                  {label}
                </text>
              ))}

              {/* ══════════════════════════════════════════════════════════════
                  HUD QUADRANT PANELS — inside main SVG, zooms with radar.
                  4 corner quadrants outside radarClip. No overlay SVG needed.
                  ══════════════════════════════════════════════════════════════ */}
              {orbitMode && sorted.length > 0 && (() => {
                // Scaled up for readability at typical display sizes
                const PW  = 242;  // panel width
                const PH1 = 285;  // FIELD INTEL height (8 rows)
                const PH2 = 260;  // NODE STREAM height (4 items)
                const PH4 = 260;  // FIELD ASSESSMENT height (6 rows)
                const PAD = 8;
                const BK  = 24;   // corner bracket arm length
                const NT  = 16;   // notch size

                const hudPos = animatedOrbitPositions;
                const criticalCount    = sorted.filter(c => Number(c.momentum_score ?? 0) >= 5).length;
                const convergenceCount = tensionLinks.filter(l => l.intensity > 0.70).length;
                const totalSignals     = sorted.reduce((s, c) => s + (c.signals_7d ?? 0), 0);
                const fieldAgeStr      = latestSignalAt ? formatRelative(latestSignalAt).toUpperCase() : "PENDING";
                const activeCount      = sorted.filter(c => Number(c.momentum_score ?? 0) >= 1.5).length;
                const risingCount      = sorted.filter(c => Number(c.momentum_score ?? 0) >= 3).length;
                const sectorCounts     = hudSectorDensity;
                const hottestIdx       = sectorCounts.indexOf(Math.max(...sectorCounts));
                const sectorLabels     = ["I", "II", "III", "IV", "V", "VI"] as const;
                const hottestStr       = sectorCounts[hottestIdx] > 0 ? `SECTOR ${sectorLabels[hottestIdx]}` : "UNIFORM";

                const sciPanel = (x: number, y: number, w: number, h: number, key: string, accent = "#00e5ff") => (
                  <g key={key}>
                    <rect x={x} y={y} width={w} height={h} rx="1" fill="#030c18" fillOpacity="0.93" />
                    <rect x={x} y={y} width={w} height={h} rx="1" fill="url(#hudScanlines)" />
                    <rect x={x} y={y} width={w} height={h * 0.45} rx="1" fill="url(#hudGlassSheen)" />
                    <polygon points={`${x+w-NT},${y} ${x+w},${y+NT} ${x+w},${y}`} fill="#030c18" fillOpacity="0.98" />
                    <line x1={x+w-NT} y1={y} x2={x+w} y2={y+NT} stroke={accent} strokeWidth="1.2" strokeOpacity="0.65" />
                    <rect x={x} y={y} width={w} height={h} rx="1" fill="none" stroke={accent} strokeWidth="0.9" strokeOpacity="0.38" />
                    <rect x={x+1} y={y+1} width={w-2} height={h-2} rx="1" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.10" />
                    <line x1={x}   y1={y+BK} x2={x}   y2={y}    stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x}   y1={y}    x2={x+BK} y2={y}    stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x+w-BK} y1={y} x2={x+w} y2={y}    stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x+w} y1={y}    x2={x+w} y2={y+BK} stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x}   y1={y+h-BK} x2={x}   y2={y+h}   stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x}   y1={y+h}    x2={x+BK} y2={y+h}   stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x+w-BK} y1={y+h} x2={x+w} y2={y+h}   stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x+w} y1={y+h-BK} x2={x+w} y2={y+h}   stroke={accent} strokeWidth="2.4" strokeOpacity="0.95" />
                    <line x1={x+1} y1={y+30} x2={x+w-1} y2={y+30} stroke={accent} strokeWidth="0.8" strokeOpacity="0.35" />
                    <line x1={x}   y1={y+44}   x2={x+4} y2={y+44}   stroke={accent} strokeWidth="1.0" strokeOpacity="0.45" />
                    <line x1={x}   y1={y+h-44} x2={x+4} y2={y+h-44} stroke={accent} strokeWidth="1.0" strokeOpacity="0.45" />
                  </g>
                );

                return (
                  <g style={{ opacity: entryPhase >= 2 ? 1 : 0, transition: "opacity 0.6s ease" }}>

                    {/* ── PANEL 1 (TL): FIELD INTEL ─────────────────────── */}
                    {sciPanel(PAD, PAD, PW, PH1, "hud-tl-bg")}
                    <text x={PAD+10} y={PAD+20}
                      fill="#00e5ff" fillOpacity="0.85" filter="url(#hudNeonGlow)"
                      fontFamily="'Courier New', Monaco, monospace" fontSize="10.5" fontWeight="700" letterSpacing="0.22em">
                      FIELD INTEL
                    </text>
                    <text x={PAD+PW-8} y={PAD+20}
                      fill="#00e5ff" fillOpacity="0.35" textAnchor="end"
                      fontFamily="'Courier New', Monaco, monospace" fontSize="8.5" letterSpacing="0.06em">
                      SYS·ACTIVE
                    </text>
                    {([
                      { label: "NODES TRACKED",  value: sorted.length.toString(),    color: "#e8f4ff",  hover: null },
                      { label: "ACTIVE",         value: activeCount.toString(),       color: activeCount > 0 ? "#00ff88" : "#334a5e",      hover: "active" as const },
                      { label: "RISING",         value: risingCount.toString(),       color: risingCount > 0 ? "#ffaa00" : "#334a5e",      hover: "rising" as const },
                      { label: "CRITICAL",       value: criticalCount.toString(),     color: criticalCount > 0 ? "#ff2255" : "#334a5e",    hover: "critical" as const },
                      { label: "CONVERGENCE",    value: convergenceCount.toString(),  color: convergenceCount > 0 ? "#bb66ff" : "#334a5e", hover: "convergence" as const },
                      { label: "SIG·7D",         value: totalSignals.toString(),      color: "#7ad4f0",  hover: null },
                      { label: "LAST SIGNAL",    value: fieldAgeStr,                  color: "#3a6080",  hover: null },
                      { label: "HOT SECTOR",     value: hottestStr,                   color: "#bb66ff",  hover: null },
                    ] as Array<{ label: string; value: string; color: string; hover: 'critical' | 'rising' | 'active' | 'convergence' | null }>).map(({ label, value, color, hover }, ri) => {
                      const isHovered = hudHighlight?.type === 'category' && hudHighlight.value === hover;
                      return (
                        <g key={`hud-tl-${ri}`}
                          style={{ cursor: hover ? 'pointer' : 'default', pointerEvents: hover ? 'auto' : 'none' }}
                          onMouseEnter={() => hover && setHudHighlight({ type: 'category', value: hover })}
                          onMouseLeave={() => setHudHighlight(null)}
                        >
                          {hover && (
                            <rect x={PAD+1} y={PAD+34+ri*27-1} width={PW-2} height={24} rx="1"
                              fill={color} fillOpacity={isHovered ? 0.07 : 0}
                              style={{ transition: "fill-opacity 0.12s ease" }} />
                          )}
                          <text x={PAD+10} y={PAD+47+ri*27}
                            fill="#2a5070" fillOpacity="0.90"
                            fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" letterSpacing="0.12em">
                            {label}
                          </text>
                          <text x={PAD+PW-8} y={PAD+47+ri*27}
                            textAnchor="end"
                            fill={color} fillOpacity="0.90"
                            filter={color !== "#334a5e" && color !== "#3a6080" ? "url(#hudNeonGlow)" : undefined}
                            fontFamily="'Courier New', Monaco, monospace" fontSize="12" fontWeight="bold" letterSpacing="0.06em">
                            {value}
                          </text>
                          <line x1={PAD+8} y1={PAD+50+ri*27} x2={PAD+PW-8} y2={PAD+50+ri*27}
                            stroke="#00e5ff" strokeWidth="0.3" strokeOpacity="0.08" />
                        </g>
                      );
                    })}

                    {/* ── PANEL 2 (BL): NODE STREAM ─────────────────────── */}
                    {sciPanel(PAD, 1000 - PH2 - PAD, PW, PH2, "hud-bl-bg", "#00ff88")}
                    <text x={PAD+10} y={1000 - PH2 - PAD + 20}
                      fill="#00ff88" fillOpacity="0.85" filter="url(#hudNeonGlow)"
                      fontFamily="'Courier New', Monaco, monospace" fontSize="10.5" fontWeight="700" letterSpacing="0.22em">
                      NODE STREAM
                    </text>
                    <text x={PAD+PW-8} y={1000 - PH2 - PAD + 20}
                      fill="#00ff88" fillOpacity="0.35" textAnchor="end"
                      fontFamily="'Courier New', Monaco, monospace" fontSize="8.5" letterSpacing="0.06em">
                      TOP·4
                    </text>
                    {sorted.slice(0, 4).map((c, ri) => {
                      const momentum = Number(c.momentum_score ?? 0);
                      const mCfg = getMomentumConfig(momentum);
                      const movAbbr = c.latest_movement_type ? movAbbreviation(c.latest_movement_type) : "—";
                      const barW = Math.min(130, momentum * 14);
                      const baseY = 1000 - PH2 - PAD + 30 + ri * 53;
                      const isHighlighted = hudHighlight?.type === 'node' && hudHighlight.id === c.competitor_id;
                      return (
                        <g key={`hud-bl-${ri}`}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                          onMouseEnter={() => setHudHighlight({ type: 'node', id: c.competitor_id })}
                          onMouseLeave={() => setHudHighlight(null)}
                        >
                          <rect x={PAD+1} y={baseY-3} width={PW-2} height={46} rx="1"
                            fill={mCfg.color} fillOpacity={isHighlighted ? 0.07 : 0}
                            style={{ transition: "fill-opacity 0.12s ease" }} />
                          <text x={PAD+9} y={baseY+13}
                            fill="#00ff88" fillOpacity="0.30"
                            fontFamily="'Courier New', Monaco, monospace" fontSize="14" fontWeight="700">
                            {`0${ri + 1}`}
                          </text>
                          <text x={PAD+30} y={baseY+13}
                            fill="#d0e8f0" fillOpacity="0.80"
                            fontFamily="'Courier New', Monaco, monospace" fontSize="11" fontWeight="600" letterSpacing="0.10em">
                            {c.competitor_name.toUpperCase().slice(0, 13)}
                          </text>
                          <text x={PAD+PW-8} y={baseY+13}
                            textAnchor="end" fill={mCfg.color} fillOpacity="0.70"
                            fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" letterSpacing="0.08em">
                            {movAbbr}
                          </text>
                          <rect x={PAD+30} y={baseY+18} width={130} height={4} rx="2"
                            fill="#ffffff" fillOpacity="0.05" />
                          <rect x={PAD+30} y={baseY+18} width={barW} height={4} rx="2"
                            fill={mCfg.color} fillOpacity="0.70" />
                          <text x={PAD+PW-8} y={baseY+32}
                            textAnchor="end" fill={mCfg.color} fillOpacity="0.55"
                            fontFamily="'Courier New', Monaco, monospace" fontSize="9" letterSpacing="0.06em">
                            {`M·${momentum.toFixed(1)}`}
                          </text>
                          {ri < 3 && (
                            <line x1={PAD+8} y1={baseY+43} x2={PAD+PW-8} y2={baseY+43}
                              stroke="#00ff88" strokeWidth="0.3" strokeOpacity="0.10" />
                          )}
                        </g>
                      );
                    })}

                    {/* ── PANEL 3 (TR or below TL): TARGET LOCKED ────────── */}
                    {/* panelOnRight=true → top-right corner                  */}
                    {/* panelOnRight=false → left side below Panel 1           */}
                    <AnimatePresence>
                      {selected && (() => {
                        const selPos = hudPos.get(selected.competitor_id);
                        const panelOnRight = !selPos || selPos.x >= CENTER;
                        const px = panelOnRight ? 1000 - PW - PAD : PAD;
                        const py = panelOnRight ? PAD : PAD + PH1 + 10;
                        const ph = 290;
                        const momentum    = Number(selected.momentum_score ?? 0);
                        const mCfg        = getMomentumConfig(momentum);
                        const threatLevel = momentum >= 7 ? "CRITICAL THREAT" : momentum >= 5 ? "HIGH THREAT" : momentum >= 3 ? "ELEVATED" : "NOMINAL";
                        const threatColor = momentum >= 7 ? "#ff2255" : momentum >= 5 ? "#ffaa00" : momentum >= 3 ? "#bb66ff" : "#334a5e";
                        const rivalCount  = tensionLinks.filter(l => l.idA === selected.competitor_id || l.idB === selected.competitor_id).length;
                        const lastSig     = selected.last_signal_at ? formatRelative(selected.last_signal_at).toUpperCase() : "—";
                        const movAbbr     = selected.latest_movement_type ? movAbbreviation(selected.latest_movement_type) : "—";
                        const barW        = Math.min(PW - 20, momentum * 16);
                        const connectorPt = selPos ? { x: selPos.x, y: selPos.y } : null;
                        return (
                          <motion.g
                            key={`hud-target-${selected.competitor_id}`}
                            initial={{ opacity: 0, x: panelOnRight ? 16 : -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: panelOnRight ? 16 : -16 }}
                            transition={{ type: "spring", stiffness: 280, damping: 22 }}
                          >
                            {sciPanel(px, py, PW, ph, "hud-tr-bg", threatColor)}
                            <text x={px+10} y={py+20}
                              fill={threatColor} fillOpacity="0.90" filter="url(#hudNeonGlow)"
                              fontFamily="'Courier New', Monaco, monospace" fontSize="10.5" fontWeight="700" letterSpacing="0.22em">
                              TARGET LOCKED
                            </text>
                            <text x={px+PW/2} y={py+41}
                              textAnchor="middle"
                              fill="#ffffff" fillOpacity="0.95" filter="url(#hudNeonGlow)"
                              fontFamily="'Courier New', Monaco, monospace" fontSize="17" fontWeight="bold" letterSpacing="0.12em">
                              {selected.competitor_name.toUpperCase().slice(0, 14)}
                            </text>
                            <rect x={px+PW/2-50} y={py+48} width={100} height={17} rx="2"
                              fill={threatColor} fillOpacity="0.12" />
                            <rect x={px+PW/2-50} y={py+48} width={100} height={17} rx="2"
                              fill="none" stroke={threatColor} strokeWidth="0.7" strokeOpacity="0.55" />
                            <text x={px+PW/2} y={py+58.5}
                              textAnchor="middle" dominantBaseline="middle"
                              fill={threatColor} fillOpacity="0.90" filter="url(#hudNeonGlow)"
                              fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" fontWeight="700" letterSpacing="0.20em">
                              {threatLevel}
                            </text>
                            <text x={px+10} y={py+80}
                              fill="#2a5070" fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" letterSpacing="0.12em">
                              MOMENTUM
                            </text>
                            <text x={px+PW-10} y={py+80}
                              textAnchor="end" fill={mCfg.color} fillOpacity="0.90" filter="url(#hudNeonGlow)"
                              fontFamily="'Courier New', Monaco, monospace" fontSize="12" fontWeight="bold">
                              {momentum.toFixed(1)}
                            </text>
                            <rect x={px+10} y={py+84} width={PW-20} height={4} rx="2"
                              fill="#ffffff" fillOpacity="0.05" />
                            <rect x={px+10} y={py+84} width={barW} height={4} rx="2"
                              fill={mCfg.color} fillOpacity="0.70" />
                            {([
                              { label: "VECTOR",       value: movAbbr,                                                   color: "#7ad4f0" },
                              { label: "SIG·7D",       value: (selected.signals_7d ?? 0).toString(),                     color: "#e8f4ff" },
                              { label: "LAST SIGNAL",  value: lastSig,                                                   color: "#3a6080" },
                              { label: "RIVALS",       value: rivalCount > 0 ? `${rivalCount} CONVERGING` : "ISOLATED",  color: rivalCount > 0 ? "#bb66ff" : "#334a5e" },
                              { label: "PRESSURE IDX", value: (selected.pressure_index ?? 0).toFixed(1),                 color: "#7ad4f0" },
                            ] as Array<{ label: string; value: string; color: string }>).map(({ label, value, color }, ri) => (
                              <g key={`hud-sel-${ri}`}>
                                <text x={px+10} y={py+106+ri*30}
                                  fill="#2a5070" fillOpacity="0.90"
                                  fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" letterSpacing="0.12em">
                                  {label}
                                </text>
                                <text x={px+PW-10} y={py+106+ri*30}
                                  textAnchor="end" fill={color} fillOpacity="0.90"
                                  filter={color !== "#334a5e" && color !== "#3a6080" ? "url(#hudNeonGlow)" : undefined}
                                  fontFamily="'Courier New', Monaco, monospace" fontSize="11" fontWeight="bold" letterSpacing="0.08em">
                                  {value}
                                </text>
                                <line x1={px+8} y1={py+109+ri*30} x2={px+PW-8} y2={py+109+ri*30}
                                  stroke={threatColor} strokeWidth="0.3" strokeOpacity="0.08" />
                              </g>
                            ))}
                            {selected.latest_movement_type && (
                              <>
                                <line x1={px+8} y1={py+ph-26} x2={px+PW-8} y2={py+ph-26}
                                  stroke={threatColor} strokeWidth="0.5" strokeOpacity="0.22" />
                                <text x={px+PW/2} y={py+ph-11}
                                  textAnchor="middle"
                                  fill={threatColor} fillOpacity="0.60"
                                  fontFamily="'Courier New', Monaco, monospace" fontSize="8.5" letterSpacing="0.16em">
                                  {selected.latest_movement_type.replace(/_/g, " ").toUpperCase()}
                                </text>
                              </>
                            )}
                            {connectorPt && (() => {
                              const nodeR = getNodeSize(momentum) + 10;
                              const panelEdgeX = panelOnRight ? px : px + PW;
                              return (
                                <path
                                  d={`M ${connectorPt.x + (panelOnRight ? -nodeR : nodeR)} ${connectorPt.y} L ${panelEdgeX} ${connectorPt.y} L ${panelEdgeX} ${py + ph / 2}`}
                                  fill="none"
                                  stroke={threatColor} strokeWidth="0.6"
                                  strokeOpacity="0.30"
                                  strokeDasharray="4 6"
                                />
                              );
                            })()}
                          </motion.g>
                        );
                      })()}
                    </AnimatePresence>

                    {/* ── PANEL 4 (BR): FIELD ASSESSMENT ───────────────── */}
                    {sciPanel(1000 - PW - PAD, 1000 - PH4 - PAD, PW, PH4, "hud-br-bg", "#bb66ff")}
                    <text x={1000 - PW - PAD + 10} y={1000 - PH4 - PAD + 20}
                      fill="#bb66ff" fillOpacity="0.85" filter="url(#hudNeonGlow)"
                      fontFamily="'Courier New', Monaco, monospace" fontSize="10.5" fontWeight="700" letterSpacing="0.22em">
                      FIELD ASSESSMENT
                    </text>
                    {([
                      { label: "CRITICAL VECTORS",   value: criticalCount.toString(),           color: criticalCount > 0 ? "#ff2255" : "#334a5e" },
                      { label: "CONVERGENCE ZONES",  value: convergenceCount.toString(),         color: convergenceCount > 0 ? "#bb66ff" : "#334a5e" },
                      { label: "SIGNALS·7D",         value: totalSignals.toString(),             color: "#7ad4f0" },
                      { label: "ORBIT MODE",         value: "ACTIVE",                           color: "#00ff88" },
                      { label: "FIELD AGE",          value: fieldAgeStr,                         color: "#3a6080" },
                      { label: "HOT SECTOR",         value: hottestStr,                          color: "#bb66ff" },
                    ] as Array<{ label: string; value: string; color: string }>).map(({ label, value, color }, ri) => (
                      <g key={`hud-br-${ri}`}>
                        <text x={1000 - PW - PAD + 10} y={1000 - PH4 - PAD + 40 + ri * 32}
                          fill="#2a5070" fillOpacity="0.90"
                          fontFamily="'Courier New', Monaco, monospace" fontSize="9.5" letterSpacing="0.12em">
                          {`▸ ${label}`}
                        </text>
                        <text x={1000 - PAD - 8} y={1000 - PH4 - PAD + 40 + ri * 32}
                          textAnchor="end"
                          fill={color} fillOpacity="0.90"
                          filter={color !== "#334a5e" && color !== "#3a6080" ? "url(#hudNeonGlow)" : undefined}
                          fontFamily="'Courier New', Monaco, monospace" fontSize="11" fontWeight="bold" letterSpacing="0.08em">
                          {value}
                        </text>
                        <line x1={1000 - PW - PAD + 8} y1={1000 - PH4 - PAD + 43 + ri * 32}
                              x2={1000 - PAD - 8}       y2={1000 - PH4 - PAD + 43 + ri * 32}
                          stroke="#bb66ff" strokeWidth="0.3" strokeOpacity="0.08" />
                      </g>
                    ))}

                  </g>
                );
              })()}

            </svg>
            </div>{/* end zoom canvas */}

            {/* HUD panels moved inside main SVG above — zoom-synced with radar */}

            {/* ── Floating controls — mobile only ─────────────────────────── */}
            {/* Gravity toggle + zoom reset, positioned top-right of radar canvas */}
            <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col gap-2 md:hidden">
              <button
                onClick={() => { setOrbitMode((g) => !g); getAudioManager().play("swoosh"); }}
                className="flex h-11 w-11 items-center justify-center rounded-[12px] transition-all active:scale-90"
                style={{
                  background: orbitMode ? "rgba(129,140,248,0.14)" : "rgba(46,230,166,0.08)",
                  border: `1px solid ${orbitMode ? "rgba(129,140,248,0.28)" : "rgba(46,230,166,0.14)"}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                aria-label={orbitMode ? "Switch to Standard mode" : "Switch to Gravity Field mode"}
              >
                {orbitMode ? (
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
                      background: orbitMode ? "rgba(2,1,20,0.90)" : "rgba(0,0,0,0.82)",
                      border: `1px solid ${orbitMode ? "#1e1545" : "#0e2210"}`,
                      backdropFilter: "blur(8px)",
                      transition: "background 0.8s ease, border-color 0.8s ease",
                    }}
                  >
                    <div
                      className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.24em]"
                      style={{ color: orbitMode ? "rgba(129,140,248,0.5)" : "rgb(71,85,105)", transition: "color 0.8s ease" }}
                    >
                      {orbitMode ? "Field Type" : "Signal Type"}
                    </div>
                    {(
                      [
                        { color: "#FF2AD4", label: "Pricing" },
                        { color: "#00F5FF", label: "Product" },
                        { color: "#FF7A00", label: "Market" },
                        { color: "#9B5CFF", label: "Enterprise" },
                        { color: "#4A6FA5", label: "Dormant" },
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
                      background: orbitMode ? "rgba(2,1,20,0.90)" : "rgba(0,0,0,0.82)",
                      border: `1px solid ${orbitMode ? "#1e1545" : "#0e2210"}`,
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
                            ? orbitMode ? "rgba(129,140,248,0.10)" : "rgba(46,230,166,0.09)"
                            : "transparent",
                          color: temporalFilter === f
                            ? orbitMode ? G.primary : "#2EE6A6"
                            : orbitMode ? G.dim : "#3a5a3a",
                          boxShadow: temporalFilter === f
                            ? orbitMode ? "inset 0 0 0 1px rgba(129,140,248,0.22)" : "inset 0 0 0 1px rgba(46,230,166,0.2)"
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
              borderTop: `1px solid ${orbitMode ? "#150f30" : "#0a1c0a"}`,
              transition: "border-color 0.8s ease",
            }}
          >

            {/* Legend row */}
            <div className="flex items-center justify-center gap-5 px-4 py-2.5">
              {(
                [
                  { color: "#FF2AD4", label: "Pricing" },
                  { color: "#00F5FF", label: "Product" },
                  { color: "#FF7A00", label: "Market" },
                  { color: "#9B5CFF", label: "Enterprise" },
                  { color: "#4A6FA5", label: "Dormant" },
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

            {/* Signal ticker — Gravity Field mode only */}
            {orbitMode && !isolated && tickerItems.length > 0 && (
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
      {selected && !isolated && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSelectedId(null)}
          aria-hidden="true"
        />
      )}

      {/* ── Right panel — intelligence console ──────────────────── */}
      {/* Mobile: hidden when nothing selected; bottom-sheet when selected.  */}
      {/* Desktop (lg+): always-visible second grid column.                  */}
      {/* Observatory (isolated): floating right panel over the fullscreen radar. */}
      <aside
        className={isolated && selected
          ? "fixed right-4 top-4 z-[60] h-[min(88vh,740px)] w-[320px] xl:w-[360px] overflow-y-auto rounded-[16px] border p-5"
          : `border bg-[#000000] p-6 lg:static lg:block lg:inset-auto lg:z-auto lg:min-h-0 lg:max-h-none lg:overflow-y-auto lg:rounded-[20px]${
            selected
              ? sheetState === "full"
                ? " fixed inset-x-0 bottom-0 z-40 h-[100svh] overflow-y-auto rounded-t-[20px]"
                : sheetState === "peek"
                ? " fixed inset-x-0 bottom-0 z-40 h-[28vh] overflow-hidden rounded-t-[20px]"
                : " fixed inset-x-0 bottom-0 z-40 max-h-[65vh] overflow-y-auto rounded-t-[20px]"
              : " hidden"
          }`
        }
        onTouchStart={handleSheetTouchStart}
        onTouchEnd={handleSheetTouchEnd}
        style={isolated && selected ? {
          background: "rgba(0, 2, 0, 0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderColor: `${selectedColor}30`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.90), 0 0 0 1px ${selectedColor}15, inset 0 1px 0 ${selectedColor}10`,
          opacity: 1,
          transition: "border-color 0.5s ease",
        } : {
          borderColor: selected ? `${selectedColor}38` : "#0e2010",
          boxShadow: selected
            ? `inset 0 1px 0 0 ${selectedColor}18, 0 0 60px rgba(0,0,0,0.6)`
            : "inset 0 1px 0 0 rgba(46,230,166,0.05), 0 0 60px rgba(0,0,0,0.6)",
          opacity: entryPhase >= 3 ? 1 : 0,
          transition: "opacity 0.4s ease, border-color 0.5s ease, box-shadow 0.5s ease",
        }}
      >
        {/* ── Mobile swipe handle + sheet state indicator ── */}
        <div className="mb-4 flex flex-col items-center gap-2 lg:hidden">
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
                        background: `${selectedColor}18`,
                        border: `1px solid ${selectedColor}30`,
                        color: selectedColor,
                        textShadow: `0 0 10px ${selectedColor}60`,
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
                        backgroundColor: `${selectedColor}18`,
                        color: selectedColor,
                        border: `1px solid ${selectedColor}30`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: selectedColor,
                          boxShadow: `0 0 6px ${selectedColor}`,
                        }}
                      />
                      {selected.latest_movement_type
                        ? translateMovementType(selected.latest_movement_type, sector)
                        : Number(selected.momentum_score ?? 0) >= 1.5 ? "Watching" : "Dormant"}
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
                  {/* State B/E metadata — signal(s) detected but no pattern confirmed yet */}
                  {!selected.latest_movement_type && (selected.signals_7d ?? 0) > 0 && (
                    <div className="mt-1.5 text-[11px] text-slate-600">
                      {selected.signals_7d === 1 ? "1 signal" : `${selected.signals_7d} signals`}
                      {" · "}
                      {formatRelative(selected.last_signal_at)}
                      {" · no pattern detected"}
                    </div>
                  )}
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
                  background: `linear-gradient(90deg, transparent, ${selectedColor}30 40%, ${selectedColor}30 60%, transparent)`,
                }}
              />

              {/* ── Detected Change strip ───────────────────────── */}
              {!detailLoading && primarySignal?.summary && (
                <div
                  className="mb-3 rounded-[10px] border border-[#0f1c0f] px-3.5 py-2.5"
                  style={{ background: "#040904" }}
                >
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.30em]" style={{ color: "rgba(100,116,139,0.55)" }}>
                    Detected Change
                  </div>
                  <p className="text-[12px] leading-snug text-slate-300">
                    {primarySignal.summary}
                  </p>
                </div>
              )}

              {/* ── Assessment ──────────────────────────────────── */}
              <div className="overflow-hidden rounded-[14px] border border-[#152415]" style={{ background: "#071507" }}>
                {/* Movement-color accent line */}
                <div
                  className="h-px w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${selectedColor}45 35%, ${selectedColor}60 50%, ${selectedColor}45 65%, transparent)`,
                  }}
                />
                <div className="px-4 py-3.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: `${selectedColor}90` }}>
                  Intelligence Assessment
                </div>
                {detailLoading ? (
                  // While detail loads, show pre-loaded interpretation summary if available
                  selected.latest_interpretation_summary ? (
                    <p className="text-sm leading-relaxed text-slate-400">
                      {selected.latest_interpretation_summary}
                    </p>
                  ) : (
                    <div className="h-14 animate-pulse rounded-lg bg-[#0c1e0c]" />
                  )
                ) : detailError ? (
                  // On detail error, fall back to pre-loaded interpretation summary
                  selected.latest_interpretation_summary ? (
                    <p className="text-sm leading-relaxed text-slate-400">
                      {selected.latest_interpretation_summary}
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-slate-500">
                      Could not load intelligence. Try selecting again.
                    </p>
                  )
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
                ) : selected.radar_narrative ? (
                  // Fallback: show radar narrative when no signal detail is available
                  <p className="text-sm leading-relaxed text-slate-400">
                    {selected.radar_narrative_generation_reason === "fallback" && (
                      <span className="text-slate-600">preliminary observation — </span>
                    )}
                    {selected.radar_narrative}
                  </p>
                ) : detail?.signals && detail.signals.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-500">
                    {(selected.signals_pending ?? 0) > 0
                      ? `${selected.signals_pending} signal${selected.signals_pending === 1 ? "" : "s"} in analysis — results arriving shortly.`
                      : "Monitoring active — no signals yet."}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    Analyzing…
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
                    borderLeftColor: `${selectedColor}55`,
                    borderLeftWidth: "2px",
                  }}
                >
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: `${selectedColor}95` }}>
                    <span style={{ opacity: 0.7 }}>→</span>
                    <span>Strategic Advisory</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">
                    {primarySignal.recommended_action}
                  </p>
                </div>
              )}

              {/* ── Running Hypothesis ──────────────────────────── */}
              {!detailLoading && detail?.context?.hypothesis && (
                <div
                  className="mt-3 rounded-[14px] border border-[#1a2d18] px-4 py-3.5"
                  style={{ background: "#070e07" }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: `${selectedColor}95` }}>
                      <span style={{ opacity: 0.6 }}>◈</span>
                      <span>Running Hypothesis</span>
                    </div>
                    {detail.context.confidence_level && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                        style={{
                          background:
                            detail.context.confidence_level === "high"
                              ? "rgba(46,230,166,0.12)"
                              : detail.context.confidence_level === "medium"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(100,116,139,0.12)",
                          color:
                            detail.context.confidence_level === "high"
                              ? "#2EE6A6"
                              : detail.context.confidence_level === "medium"
                              ? "#f59e0b"
                              : "#64748b",
                        }}
                      >
                        {detail.context.confidence_level}
                      </span>
                    )}
                  </div>
                  {/* Strategy Pivot banner — shown when hypothesis changed in last 48h */}
                  {detail.context.hypothesis_changed_at &&
                    detail.context.previous_hypothesis &&
                    Date.now() - new Date(detail.context.hypothesis_changed_at).getTime() < 48 * 60 * 60 * 1000 && (
                    <div
                      className="mb-2.5 rounded-[8px] border px-3 py-2"
                      style={{
                        background: "rgba(155,92,255,0.08)",
                        borderColor: "rgba(155,92,255,0.22)",
                      }}
                    >
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "#9B5CFF" }}>
                        Strategy Pivot Detected
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500 line-through">
                        {detail.context.previous_hypothesis}
                      </p>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-slate-200">
                    {detail.context.hypothesis}
                  </p>
                  {detail.context.strategic_arc && (
                    <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500">
                      {detail.context.strategic_arc}
                    </p>
                  )}
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
                    style={{ color: selectedColor }}
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
                    Pressure
                  </div>
                  <div
                    className="mt-2 text-xl font-bold tabular-nums leading-none"
                    style={{
                      color:
                        (selected.pressure_index ?? 0) >= 6
                          ? "#ef4444"
                          : (selected.pressure_index ?? 0) >= 3
                          ? "#f59e0b"
                          : "#475569",
                    }}
                  >
                    {formatNumber(selected.pressure_index ?? 0, 1)}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-700">
                    index
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
                          ? selectedColor
                          : interpretationConf >= 0.5
                          ? "#f59e0b"
                          : "#94a3b8",
                      textShadow:
                        interpretationConf !== null && interpretationConf >= 0.75
                          ? `0 0 14px ${selectedColor}55`
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
                          ? `linear-gradient(90deg, ${selectedColor}70, ${selectedColor})`
                          : interpretationConf !== null && interpretationConf >= 0.5
                          ? "linear-gradient(90deg, #f59e0b70, #f59e0b)"
                          : "linear-gradient(90deg, #64748b50, #64748b)",
                      boxShadow:
                        interpretationConf !== null && interpretationConf >= 0.5
                          ? interpretationConf >= 0.75
                            ? `0 0 12px ${selectedColor}65`
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
                    Captured changes
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

                          {/* Lead with strategic_implication; fall back to summary */}
                          {signal.strategic_implication ? (
                            <p className="mb-2 text-[13px] leading-relaxed text-slate-300">
                              {signal.strategic_implication}
                            </p>
                          ) : signal.summary ? (
                            <p className="mb-2 text-xs leading-5 text-slate-400">
                              {signal.summary}
                            </p>
                          ) : null}

                          {signal.previous_excerpt && signal.current_excerpt && (
                            <div className="space-y-1">
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
                      {(selected.signals_pending ?? 0) > 0
                        ? `${selected.signals_pending} signal${selected.signals_pending === 1 ? "" : "s"} in analysis`
                        : "No changes detected yet"}
                    </p>
                  </div>
                )}
                {/* Pending signals pill — shows after evidence list when interpretation queue is non-empty */}
                {(selected.signals_pending ?? 0) > 0 && sortedSignals.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 px-1">
                    <div
                      className="h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ background: "rgba(245,158,11,0.7)" }}
                    />
                    <span className="text-[11px] text-slate-500">
                      {selected.signals_pending} more in analysis
                    </span>
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
                competitorId={selected?.competitor_id}
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
                      Last signal {formatRelative(latestSignalAt)}
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
                  {sector === "custom" ? (
                    <>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                        Custom sector
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                        No rivals tracked. Add competitors to begin monitoring your market.
                      </p>
                      <a
                        href="/app/discover"
                        className="mt-4 rounded-full border border-[#1a3020] px-4 py-1.5 text-[11px] font-medium transition-colors hover:border-[#2a4a30]"
                        style={{ color: "rgba(46,230,166,0.70)" }}
                      >
                        Open Discover →
                      </a>
                    </>
                  ) : (
                    <>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                        Calibrating
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                        Pipeline running · establishing baselines · first signals within the hour
                      </p>
                    </>
                  )}
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
                  const color    = competitor.latest_movement_type
                    ? getMovementColor(competitor.latest_movement_type)
                    : competitor.latest_signal_type
                      ? getSignalColor(competitor.latest_signal_type)
                      : getMovementColor(null);
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
                            <>
                              <span
                                className="font-medium uppercase tracking-[0.14em]"
                                style={{ color }}
                              >
                                {translateMovementType(competitor.latest_movement_type, sector)}
                              </span>
                              <span className="text-slate-700">/</span>
                              <span className="tabular-nums text-slate-600">
                                {formatRelative(competitor.latest_movement_last_seen_at ?? competitor.last_signal_at)}
                              </span>
                            </>
                          ) : (competitor.signals_7d ?? 0) > 0 ? (
                            <>
                              <span className="uppercase tracking-[0.14em] text-slate-500">
                                {competitor.signals_7d === 1 ? "1 signal" : `${competitor.signals_7d} signals`}
                              </span>
                              <span className="text-slate-700">·</span>
                              <span className="tabular-nums text-slate-600">
                                {formatRelative(competitor.last_signal_at)}
                              </span>
                              <span className="text-slate-700">·</span>
                              <span className="uppercase tracking-[0.12em] text-slate-600">no pattern</span>
                            </>
                          ) : (
                            <>
                              <span className="uppercase tracking-[0.14em] text-slate-600">
                                {momentum >= 1.5 ? "Watching" : "Dormant"}
                              </span>
                              <span className="text-slate-700">/</span>
                              <span className="tabular-nums text-slate-600">
                                {formatRelative(competitor.latest_movement_last_seen_at ?? competitor.last_signal_at)}
                              </span>
                            </>
                          )}
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
