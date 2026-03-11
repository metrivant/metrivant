"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scaleLinear } from "d3-scale";
import type { RadarCompetitor, CompetitorDetail, MonitoredPage } from "../lib/api";
import { formatRelative } from "../lib/format";

// ─── Radar geometry ──────────────────────────────────────────────────────────
const SIZE = 720;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 270;
const RING_FACTORS = [1, 0.72, 0.46, 0.24];

// ─── Sweep beam ───────────────────────────────────────────────────────────────
// Two layered sectors:
//  1. Wide dim trail  — 45° phosphor memory
//  2. Narrow hot zone — 12° near the leading edge
// Beam rotates clockwise; leading edge starts at angle 0 (east).
const SWEEP_DURATION = 12; // seconds — slow, heavy military sweep

const SWEEP_TRAIL_DEG = 45;
const SWEEP_HOT_DEG = 12;
const SWEEP_TRAIL_RAD = (SWEEP_TRAIL_DEG * Math.PI) / 180;
const SWEEP_HOT_TRAIL_RAD = (SWEEP_HOT_DEG * Math.PI) / 180;

const SWEEP_TIP_X = CENTER + OUTER_RADIUS;
const SWEEP_TIP_Y = CENTER;

const SWEEP_TAIL_X = CENTER + OUTER_RADIUS * Math.cos(-SWEEP_TRAIL_RAD);
const SWEEP_TAIL_Y = CENTER + OUTER_RADIUS * Math.sin(-SWEEP_TRAIL_RAD);
const SWEEP_SECTOR = `M ${CENTER} ${CENTER} L ${SWEEP_TAIL_X.toFixed(2)} ${SWEEP_TAIL_Y.toFixed(2)} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${SWEEP_TIP_X.toFixed(2)} ${SWEEP_TIP_Y.toFixed(2)} Z`;

const SWEEP_HOT_TAIL_X = CENTER + OUTER_RADIUS * Math.cos(-SWEEP_HOT_TRAIL_RAD);
const SWEEP_HOT_TAIL_Y = CENTER + OUTER_RADIUS * Math.sin(-SWEEP_HOT_TRAIL_RAD);
const SWEEP_HOT_SECTOR = `M ${CENTER} ${CENTER} L ${SWEEP_HOT_TAIL_X.toFixed(2)} ${SWEEP_HOT_TAIL_Y.toFixed(2)} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${SWEEP_TIP_X.toFixed(2)} ${SWEEP_TIP_Y.toFixed(2)} Z`;

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
      return "#ff6b6b";
    case "product_expansion":
      return "#57a6ff";
    case "market_reposition":
      return "#34d399";
    case "enterprise_push":
      return "#c084fc";
    case "ecosystem_expansion":
      return "#facc15";
    default:
      return "#94a3b8";
  }
}

function getMovementLabel(movementType: string | null): string {
  if (!movementType) return "Quiet";
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

// Fresh signals are fully opaque; older ones fade gracefully.
function getAgeOpacity(lastSeenAt: string | null): number {
  if (!lastSeenAt) return 0.5;
  const daysSince =
    (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1.0;
  if (daysSince <= 30) return 0.78;
  if (daysSince <= 90) return 0.52;
  return 0.32;
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
  return 5.5 + Math.sqrt(Math.max(momentum, 0)) * 2;
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
  onSelect: (id: string) => void;
};

const BlipNode = memo(function BlipNode({
  competitor,
  index,
  total,
  radiusScale,
  isSelected,
  isDimmed,
  onSelect,
}: BlipNodeProps) {
  const momentum = Number(competitor.momentum_score ?? 0);
  const radius = radiusScale(momentum);
  const { x, y } = getNodePosition(index, total, radius);
  const trail = getTrailPoints(index, radius);
  const color = getMovementColor(competitor.latest_movement_type);
  const nodeSize = getNodeSize(momentum);

  const ageOpacity = getAgeOpacity(competitor.latest_movement_last_seen_at);
  const groupOpacity = isDimmed ? 0.22 : isSelected ? 1.0 : ageOpacity;

  // When the beam crosses this blip (seconds into the 12s sweep cycle)
  const sweepDelay = getSweepDelay(x, y);

  return (
    <g
      onClick={() => onSelect(competitor.competitor_id)}
      style={{ cursor: "pointer" }}
      opacity={groupOpacity}
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
          animate={{ opacity: [0, 0.68, 0] }}
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
            duration: ECHO_DURATION,
            repeat: Infinity,
            repeatDelay: SWEEP_DURATION - ECHO_DURATION,
            delay: sweepDelay + 0.06,
            ease: "easeOut",
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
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
        y={y + nodeSize + 16}
        textAnchor="middle"
        fill={isSelected ? "#e2f5e2" : "#546d54"}
        fontSize="10"
        fontWeight={isSelected ? "600" : "400"}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.02em"
      >
        {competitor.competitor_name}
      </text>
    </g>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Radar({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => sortCompetitors(competitors).slice(0, 24),
    [competitors]
  );

  const radiusScale = useMemo(() => {
    const maxMomentum = Math.max(
      ...sorted.map((c) => Number(c.momentum_score ?? 0)),
      1
    );
    return scaleLinear().domain([0, maxMomentum]).range([68, OUTER_RADIUS]);
  }, [sorted]);

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

  const tickerItems = useMemo(
    () =>
      sorted
        .filter((c) => c.latest_movement_type)
        .map((c) => ({
          name: c.competitor_name,
          label: getMovementLabel(c.latest_movement_type),
          date: formatDate(c.latest_movement_last_seen_at),
        })),
    [sorted]
  );

  const handleBlipClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const [detail, setDetail] = useState<CompetitorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

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
        if (json.ok) setDetail(json);
        else setDetailError(true);
      })
      .catch(() => setDetailError(true))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      {/* ── Radar panel ─────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-[#0a1a0a] bg-[#030803] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.72)]">
        <div className="rounded-[24px] border border-[#0a170a] bg-[linear-gradient(180deg,#040a04_0%,#020602_100%)] p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Radar scope
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-green-400">
              active surveillance
            </div>
          </div>

          <div className="flex justify-center overflow-hidden rounded-[22px] border border-[#090f09] bg-[#020502]">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="h-auto w-full max-w-[720px]"
              role="img"
              aria-label="Competitor radar"
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
                  <stop offset="52%" stopColor="#020502" stopOpacity="0" />
                  <stop offset="80%" stopColor="#020502" stopOpacity="0.68" />
                  <stop offset="100%" stopColor="#020502" stopOpacity="0.92" />
                </radialGradient>

                {/* Blip soft glow */}
                <filter
                  id="blipGlow"
                  x="-200%"
                  y="-200%"
                  width="500%"
                  height="500%"
                >
                  <feGaussianBlur stdDeviation="4.5" result="blur" />
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
                  <feGaussianBlur stdDeviation="12" result="blur" />
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

                {/* Sweep sector glow */}
                <filter
                  id="sweepSectorGlow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Sweep leading edge line glow */}
                <filter
                  id="sweepGlow"
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="5" result="blur" />
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

                {/* Hard circular clip — enforces a clean instrument boundary */}
                <clipPath id="radarClip">
                  <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} />
                </clipPath>
              </defs>

              {/* All radar content clipped to a perfect circle */}
              <g clipPath="url(#radarClip)">

              {/* Panel sheen */}
              <rect
                x="0"
                y="0"
                width={SIZE}
                height={SIZE}
                fill="url(#panelSheen)"
                opacity="0.6"
              />

              {/* Central atmospheric glow */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="url(#radarCore)"
              />

              {/* ── Range rings — stepped brightness outward→inward ── */}
              {RING_FACTORS.map((factor, i) => {
                const strokes = ["#22573a", "#1b4830", "#153a25", "#102e1c"];
                const widths = [1.8, 1.3, 1.0, 0.8];
                return (
                  <circle
                    key={factor}
                    cx={CENTER}
                    cy={CENTER}
                    r={OUTER_RADIUS * factor}
                    fill="none"
                    stroke={strokes[i]}
                    strokeWidth={widths[i]}
                  />
                );
              })}

              {/* ── Crosshair lines ─────────────────────────────────── */}
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
                    stroke="#132c1a"
                    strokeWidth="1"
                  />
                );
              })}

              {/* ── Perimeter tick marks ─────────────────────────────── */}
              {TICK_MARKS.map((tick, i) => (
                <line
                  key={i}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke={
                    tick.isMajor
                      ? "#2d6b3e"
                      : tick.isMedium
                        ? "#1a4025"
                        : "#112418"
                  }
                  strokeWidth={tick.isMajor ? 1.5 : tick.isMedium ? 1.0 : 0.7}
                />
              ))}

              {/* ── Cardinal labels (N / E / S / W) ─────────────────── */}
              {CARDINAL_LABELS.map(({ label, x, y }) => (
                <text
                  key={label}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#2d6b3e"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.06em"
                >
                  {label}
                </text>
              ))}

              {/* ── Sweep beam ──────────────────────────────────────── */}
              <motion.g
                animate={{ rotate: [0, 360] }}
                transition={{
                  duration: SWEEP_DURATION,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              >
                {/* Wide dim phosphor memory trail (45°) */}
                <path
                  d={SWEEP_SECTOR}
                  fill="#22c55e"
                  opacity="0.055"
                  filter="url(#sweepSectorGlow)"
                />
                {/* Bright hot zone near leading edge (12°) */}
                <path
                  d={SWEEP_HOT_SECTOR}
                  fill="#4ade80"
                  opacity="0.19"
                  filter="url(#sweepSectorGlow)"
                />
                {/* Leading edge line */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={SWEEP_TIP_X}
                  y2={SWEEP_TIP_Y}
                  stroke="#bbf7d0"
                  strokeWidth="2.5"
                  opacity="0.95"
                  filter="url(#sweepGlow)"
                />
              </motion.g>

              {/* ── Sonar pulse field ───────────────────────────────── */}
              {/* Main pulse rings — thick, luminous.
                  Duration 12s = sweep cycle. Stagger 4s = perfect 3-ring coverage.
                  Near-linear ease: physically accurate constant-speed wavefront. */}
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={`sonar-main-${i}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_RADIUS}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="4"
                  filter="url(#sonarGlow)"
                  initial={{ scale: 0.08, opacity: 0.8 }}
                  animate={{ scale: 1.0, opacity: 0 }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: [0.2, 0, 0.6, 1],
                    delay: i * 4,
                  }}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                />
              ))}

              {/* Echo pulses — thinner, 2× slower, atmospheric depth.
                  Duration 24s, stagger 12s = 2 even echoes between main pulses. */}
              {[0, 1].map((i) => (
                <motion.circle
                  key={`sonar-echo-${i}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_RADIUS}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2"
                  filter="url(#sonarGlow)"
                  initial={{ scale: 0.08, opacity: 0.45 }}
                  animate={{ scale: 1.0, opacity: 0 }}
                  transition={{
                    duration: 24,
                    repeat: Infinity,
                    ease: [0.2, 0, 0.6, 1],
                    delay: i * 12 + 6,
                  }}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                />
              ))}

              {/* Core emitter rings — tight alive pulses */}
              {[0, 1].map((i) => (
                <motion.circle
                  key={`core-ring-${i}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_RADIUS * 0.14}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.2"
                  initial={{ scale: 0.12, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 0 }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: i * 1.75,
                  }}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                />
              ))}

              {/* Center atmospheric fill */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={32}
                fill="url(#radarCore)"
                opacity="0.95"
              />

              {/* Emitter bloom */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={22}
                fill="#22c55e"
                opacity="0.14"
                filter="url(#blipGlowStrong)"
              />

              {/* Breathing emitter dot */}
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={5}
                fill="#dcfce7"
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
                r={2}
                fill="#ffffff"
                opacity="0.98"
              />

              {/* ── Competitor blips ────────────────────────────────── */}
              {sorted.map((competitor, index) => (
                <BlipNode
                  key={competitor.competitor_id}
                  competitor={competitor}
                  index={index}
                  total={sorted.length}
                  radiusScale={radiusScale}
                  isSelected={competitor.competitor_id === selectedId}
                  isDimmed={selectedId !== null && competitor.competitor_id !== selectedId}
                  onSelect={handleBlipClick}
                />
              ))}

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
                    NO RIVALS TRACKED
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
                    Add competitors to begin monitoring
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

              </g>{/* end radarClip */}
            </svg>
          </div>

          {/* ── Color legend ───────────────────────────────────────── */}
          <div className="mt-2 flex items-center justify-center gap-4 pb-1">
            {(
              [
                { color: "#ff6b6b", label: "Pricing" },
                { color: "#57a6ff", label: "Product" },
                { color: "#34d399", label: "Market" },
                { color: "#94a3b8", label: "No change" },
              ] as { color: string; label: string }[]
            ).map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
                  {label}
                </span>
              </span>
            ))}
          </div>

          {/* ── Signal ticker ──────────────────────────────────────── */}
          {tickerItems.length > 0 && (
            <div
              className="relative mt-2 h-7 overflow-hidden rounded-[14px] border border-[#0b180b] bg-[#020502]"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
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
                        className="inline-flex items-center gap-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.13em]"
                        style={{ color: "#1d7a42" }}
                      >
                        <span style={{ color: "#22c55e", opacity: 0.45 }}>
                          ▸
                        </span>
                        {item.name}
                        <span style={{ color: "#0f3a1e" }}>·</span>
                        {item.label}
                        <span style={{ color: "#0f3a1e" }}>·</span>
                        {item.date}
                        <span className="ml-2" style={{ color: "#0f3a1e" }}>
                          ///
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* ── Right panel ─────────────────────────────────────────── */}
      {/* Border color subtly echoes selected movement type — reinforces lock-on. */}
      <aside
        className="rounded-[28px] border bg-[#050c05] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] transition-colors duration-500"
        style={{
          borderColor: selected
            ? `${getMovementColor(selected.latest_movement_type)}28`
            : "#0d1e0d",
        }}
      >
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
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Intelligence report
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                    {selected.competitor_name}
                  </h2>
                  {selected.website_url && (
                    <a
                      href={selected.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block text-[10px] text-slate-600 transition-colors hover:text-slate-400"
                    >
                      {selected.website_url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]"
                      style={{
                        backgroundColor: getMovementColor(
                          selected.latest_movement_type
                        ),
                        color: getMovementColor(selected.latest_movement_type),
                      }}
                    />
                    <span className="text-sm text-slate-400">
                      {getMovementLabel(selected.latest_movement_type)}
                    </span>
                    {!detailLoading && primarySignal?.urgency != null && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]"
                        style={getUrgencyStyle(primarySignal.urgency)}
                      >
                        {getUrgencyLabel(primarySignal.urgency)}
                      </span>
                    )}
                    {!detailLoading && primarySignal?.page_type && (
                      <span className="text-[9px] text-slate-600">
                        · {getPageTypeLabel(primarySignal.page_type)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedId(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1a301a] bg-[#060d06] text-slate-500 transition-colors hover:border-[#2a4a2a] hover:text-slate-300"
                  aria-label="Close"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-5 h-px bg-[#192b19]" />

              {/* Assessment — shown first: the intelligence is the product */}
              <div className="rounded-2xl border border-[#0c1c0c] bg-[#030703] px-3 py-2.5">
                <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Assessment
                </div>
                {detailLoading ? (
                  <div className="h-14 animate-pulse rounded-lg bg-[#0a1a0a]" />
                ) : detailError ? (
                  <p className="text-sm leading-6 text-slate-600">
                    Could not load intelligence. Try selecting again.
                  </p>
                ) : primarySignal?.strategic_implication ? (
                  <p className="text-sm leading-6 text-slate-400">
                    {primarySignal.strategic_implication}
                  </p>
                ) : detail?.signals && detail.signals.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-600">
                    Monitoring active — no signals yet.
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    Analysing…
                  </p>
                )}
              </div>

              {/* Recommended action — left border uses movement accent color */}
              {!detailLoading && primarySignal?.recommended_action && (
                <div
                  className="mt-3 rounded-2xl border border-[#0c1c0c] bg-[#030703] px-3 py-2.5"
                  style={{
                    borderLeftColor: `${getMovementColor(selected.latest_movement_type)}55`,
                    borderLeftWidth: "2px",
                  }}
                >
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Recommended action
                  </div>
                  <p className="text-sm leading-6 text-slate-200">
                    {primarySignal.recommended_action}
                  </p>
                </div>
              )}

              {/* Stats — supporting context, shown after the intelligence */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[#0c1c0c] bg-[#040a04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Momentum
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.momentum_score)}
                  </div>
                  <div className="mt-0.5 text-[9px] text-slate-600">
                    activity score
                  </div>
                </div>
                <div className="rounded-2xl border border-[#0c1c0c] bg-[#040a04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Changes 7d
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.signals_7d, 0)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#0c1c0c] bg-[#040a04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Evidence
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.latest_movement_signal_count, 0)}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#0c1c0c] bg-[#040a04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    First seen
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_first_seen_at)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#0c1c0c] bg-[#040a04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Last seen
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_last_seen_at)}
                  </div>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-4 rounded-2xl border border-[#0c1c0c] bg-[#030703] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    AI confidence
                  </div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    {interpretationConf !== null
                      ? `${Math.round(interpretationConf * 100)}%`
                      : "—"}
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#091509]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: getMovementColor(
                        selected.latest_movement_type
                      ),
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.round((interpretationConf ?? 0) * 100)}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Evidence chain */}
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    What changed
                  </div>
                  <div className="text-[9px] text-slate-700">
                    Live captures
                  </div>
                </div>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded-xl bg-[#060d06]"
                      />
                    ))}
                  </div>
                ) : sortedSignals.length > 0 ? (
                  <div className="space-y-2">
                    {sortedSignals.slice(0, 3).map((signal) => {
                      const sigColor = getSignalColor(signal.signal_type);
                      return (
                        <div
                          key={signal.id}
                          className="rounded-xl border border-[#0c1c0c] bg-[#040a04] p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]"
                                style={{
                                  backgroundColor: `${sigColor}18`,
                                  color: sigColor,
                                }}
                              >
                                {getSignalTypeLabel(signal.signal_type)}
                              </span>
                              {signal.urgency != null && signal.urgency >= 3 && (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]"
                                  style={getUrgencyStyle(signal.urgency)}
                                >
                                  {getUrgencyLabel(signal.urgency)}
                                </span>
                              )}
                              <span className="text-[9px] uppercase tracking-[0.1em] text-slate-600">
                                {getPageTypeLabel(signal.page_type)}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                              {formatDate(signal.detected_at)}
                            </span>
                          </div>

                          {signal.summary && (
                            <p className="mb-2 text-[11px] leading-5 text-slate-400">
                              {signal.summary}
                            </p>
                          )}

                          {signal.previous_excerpt && signal.current_excerpt && (
                            <div className="space-y-1">
                              <div className="rounded bg-[#020402] px-2 py-1.5">
                                <span className="text-[8px] uppercase tracking-[0.1em] text-slate-600">
                                  Was
                                </span>
                                <p className="mt-0.5 line-clamp-2 font-mono text-[10px] text-slate-500">
                                  {signal.previous_excerpt}
                                </p>
                              </div>
                              <div className="rounded bg-[#020502] px-2 py-1.5">
                                <span className="text-[8px] uppercase tracking-[0.1em] text-slate-500">
                                  Now
                                </span>
                                <p className="mt-0.5 line-clamp-2 font-mono text-[10px] text-slate-400">
                                  {signal.current_excerpt}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#0c1c0c] bg-[#030703] px-3 py-2.5 text-center">
                    <p className="text-xs text-slate-600">
                      No changes detected yet
                    </p>
                  </div>
                )}
              </div>

              {/* Active movements — only shown when multiple movement types detected */}
              {!detailLoading && detail && detail.movements.length >= 1 && (
                <div className="mt-5">
                  <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Movements detected
                  </div>
                  <div className="space-y-1.5">
                    {detail.movements.map((m, i) => {
                      const mColor = getMovementColor(m.movement_type);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-[#0c1c0c] bg-[#040a04] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: mColor }}
                            />
                            <span className="text-[11px] text-slate-300">
                              {getMovementLabel(m.movement_type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] tabular-nums text-slate-600">
                            <span>{m.signal_count} signals</span>
                            <span>{formatRelative(m.last_seen_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monitored pages coverage */}
              {!detailLoading && detail && detail.monitoredPages.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Coverage
                    </div>
                    <div className="text-[9px] text-slate-700">
                      monitored for changes
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.monitoredPages.map((p: MonitoredPage, i: number) => (
                      <span
                        key={i}
                        className="rounded-full border border-[#0d1e0d] bg-[#030703] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-500"
                      >
                        {getPageTypeLabel(p.page_type)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* ── Compact contact list ─────────────────────────── */
            /* Condensed from the previous heavy card layout.
               Details live only in the drawer — the list is scannable. */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Under watch
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                    Rivals
                  </h2>
                  <p className="mt-1 text-[9px] text-slate-700">
                    Select a rival to open intelligence
                  </p>
                </div>
                <div className="rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-green-400">
                  live
                </div>
              </div>

              {sorted.length === 0 && (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    No rivals tracked
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    Competitors will appear here once added
                  </p>
                </div>
              )}

              {movingCount === 0 && sorted.length > 0 && (
                <div className="mb-4 rounded-xl border border-[#0c1c0c] bg-[#030703] px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    All clear
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    No movement detected · all surfaces clear
                  </p>
                </div>
              )}

              <div className="space-y-1">
                {sorted.map((competitor) => {
                  const color = getMovementColor(
                    competitor.latest_movement_type
                  );
                  const momentum = Number(competitor.momentum_score ?? 0);
                  return (
                    <div
                      key={competitor.competitor_id}
                      onClick={() =>
                        handleBlipClick(competitor.competitor_id)
                      }
                      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[#163416] hover:bg-[#030903]"
                    >
                      {/* Movement color dot */}
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}88`,
                        }}
                      />

                      {/* Name + movement type + last seen */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-200">
                          {competitor.competitor_name}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          {competitor.latest_movement_type
                            ? getMovementLabel(competitor.latest_movement_type)
                            : "No change"}
                        </div>
                        <div className="mt-0.5 text-[9px] tabular-nums text-slate-600">
                          {formatRelative(
                            competitor.latest_movement_last_seen_at ??
                              competitor.last_signal_at
                          )}
                        </div>
                      </div>

                      {/* Momentum score + relative bar */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <div className="text-sm font-semibold tabular-nums text-slate-300">
                          {formatNumber(momentum)}
                        </div>
                        <div className="h-[3px] w-14 overflow-hidden rounded-full bg-[#091509]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((momentum / maxMomentum) * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
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
