"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scaleLinear } from "d3-scale";
import type { RadarCompetitor } from "../lib/api";

const SIZE = 720;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 270;
const RING_FACTORS = [1, 0.72, 0.46, 0.24];

type Point = {
  x: number;
  y: number;
};

function getMovementColor(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift":
      return "#ff6b6b";
    case "product_expansion":
      return "#57a6ff";
    case "market_reposition":
      return "#4ade80";
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
  const factors = [0.2, 0.38, 0.56, 0.74];

  return factors.map((factor) => {
    const r = radius * factor;
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
    };
  });
}

function getNodeSize(momentum: number): number {
  return 5.5 + Math.sqrt(Math.max(momentum, 0)) * 2;
}

export default function Radar({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = sortCompetitors(competitors).slice(0, 24);

  const maxMomentum = Math.max(
    ...sorted.map((c) => Number(c.momentum_score ?? 0)),
    1
  );

  const radiusScale = scaleLinear()
    .domain([0, maxMomentum])
    .range([68, OUTER_RADIUS]);

  const selected = selectedId
    ? (sorted.find((c) => c.competitor_id === selectedId) ?? null)
    : null;

  function handleBlipClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      {/* ── Radar panel ─────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-[#112033] bg-[#060d16] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="rounded-[24px] border border-[#0f1a29] bg-[linear-gradient(180deg,#07111b_0%,#050b12_100%)] p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Radar scope
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              passive sonar
            </div>
          </div>

          <div className="flex justify-center overflow-hidden rounded-[22px] border border-[#0c1623] bg-[#040910]">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="h-auto w-full max-w-[720px]"
              role="img"
              aria-label="Competitor radar"
            >
              <defs>
                <radialGradient id="radarCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.16" />
                  <stop offset="38%" stopColor="#22d3ee" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>

                <filter
                  id="blipGlow"
                  x="-250%"
                  y="-250%"
                  width="500%"
                  height="500%"
                >
                  <feGaussianBlur stdDeviation="4.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter
                  id="blipGlowStrong"
                  x="-300%"
                  y="-300%"
                  width="700%"
                  height="700%"
                >
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient
                  id="panelSheen"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              <rect
                x="0"
                y="0"
                width={SIZE}
                height={SIZE}
                fill="url(#panelSheen)"
                opacity="0.55"
              />

              <circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="url(#radarCore)"
              />

              {RING_FACTORS.map((factor) => (
                <circle
                  key={factor}
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_RADIUS * factor}
                  fill="none"
                  stroke={factor === 1 ? "#213247" : "#162334"}
                  strokeWidth={factor === 1 ? 1.1 : 1}
                />
              ))}

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
                    stroke="#0f1a28"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Sonar pulse field */}
              <g>
                {[0, 1, 2, 3].map((i) => (
                  <motion.circle
                    key={`sonar-ring-${i}`}
                    cx={CENTER}
                    cy={CENTER}
                    r={18}
                    fill="none"
                    stroke="#4fd1e8"
                    strokeWidth="1.1"
                    strokeOpacity="0.75"
                    initial={{ scale: 0.18, opacity: 0.42 }}
                    animate={{ scale: 1.85, opacity: 0 }}
                    transition={{
                      duration: 4.8,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 1.15,
                    }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}

                {[0, 1].map((i) => (
                  <motion.circle
                    key={`sonar-core-halo-${i}`}
                    cx={CENTER}
                    cy={CENTER}
                    r={10}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="0.8"
                    strokeOpacity="0.32"
                    initial={{ scale: 0.7, opacity: 0.22 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 1.4,
                    }}
                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  />
                ))}

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={22}
                  fill="url(#radarCore)"
                  opacity="0.95"
                />

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={8}
                  fill="#67e8f9"
                  opacity="0.18"
                  filter="url(#blipGlow)"
                />

                <motion.circle
                  cx={CENTER}
                  cy={CENTER}
                  r={4.5}
                  fill="#d9fbff"
                  filter="url(#blipGlow)"
                  animate={{ opacity: [0.9, 0.45, 0.9], scale: [1, 1.08, 1] }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={2}
                  fill="#ecfeff"
                  opacity="0.95"
                />
              </g>

              {sorted.map((competitor, index) => {
                const momentum = Number(competitor.momentum_score ?? 0);
                const radius = radiusScale(momentum);
                const { x, y } = getNodePosition(index, sorted.length, radius);
                const trail = getTrailPoints(index, radius);
                const color = getMovementColor(competitor.latest_movement_type);
                const nodeSize = getNodeSize(momentum);
                const isSelected = competitor.competitor_id === selectedId;
                const isDimmed = selectedId !== null && !isSelected;

                return (
                  <g
                    key={competitor.competitor_id}
                    onClick={() => handleBlipClick(competitor.competitor_id)}
                    style={{ cursor: "pointer" }}
                    opacity={isDimmed ? 0.28 : 1}
                  >
                    {trail.map((point, pointIndex) => (
                      <circle
                        key={pointIndex}
                        cx={point.x}
                        cy={point.y}
                        r={2 + pointIndex * 1}
                        fill={color}
                        opacity={0.08 + pointIndex * 0.08}
                      />
                    ))}

                    {/* Enlarged transparent hit target */}
                    <circle
                      cx={x}
                      cy={y}
                      r={nodeSize + 8}
                      fill="transparent"
                    />

                    {/* Selected: outer pulsing ring */}
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
                          opacity: {
                            duration: 2.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          },
                          scale: { duration: 0.28, ease: "easeOut" },
                        }}
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      />
                    )}

                    {/* Selected: second faint outer ring */}
                    {isSelected && (
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={nodeSize + 15}
                        fill="none"
                        stroke={color}
                        strokeWidth="0.75"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.15, 0.32, 0.15] }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0.5,
                        }}
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      />
                    )}

                    <motion.circle
                      cx={x}
                      cy={y}
                      r={nodeSize}
                      fill={color}
                      filter={
                        isSelected ? "url(#blipGlowStrong)" : "url(#blipGlow)"
                      }
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{
                        duration: 3.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    <text
                      x={x}
                      y={y + nodeSize + 16}
                      textAnchor="middle"
                      fill={isSelected ? "#f1f5f9" : "#e2e8f0"}
                      fontSize="10.5"
                      fontWeight={isSelected ? "600" : "500"}
                      letterSpacing="0.01em"
                    >
                      {competitor.competitor_name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </section>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <aside className="rounded-[28px] border border-[#112033] bg-[#060d16] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <AnimatePresence mode="wait">
          {selected ? (
            /* ── Intelligence drawer ──────────────────────────── */
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Target acquired
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                    {selected.competitor_name}
                  </h2>
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
                  </div>
                </div>

                <button
                  onClick={() => setSelectedId(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1e3348] bg-[#07111d] text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
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

              <div className="mb-5 h-px bg-[#112033]" />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Momentum
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.momentum_score)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Velocity
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.weighted_velocity_7d, 0)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Signals
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {formatNumber(selected.latest_movement_signal_count, 0)}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 rounded-2xl border border-[#112033] bg-[#040910] px-3 py-2.5 text-sm leading-6 text-slate-400">
                {selected.latest_movement_summary
                  ? selected.latest_movement_summary
                  : "No active strategic summary yet."}
              </div>

              {/* Timeline */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    First seen
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_first_seen_at)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Last seen
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-300">
                    {formatDate(selected.latest_movement_last_seen_at)}
                  </div>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-4 rounded-2xl border border-[#112033] bg-[#040910] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Signal confidence
                  </div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    {selected.latest_movement_confidence !== null
                      ? `${Math.round((selected.latest_movement_confidence ?? 0) * 100)}%`
                      : "—"}
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0c1623]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: getMovementColor(
                        selected.latest_movement_type
                      ),
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.round((selected.latest_movement_confidence ?? 0) * 100)}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Default card list ────────────────────────────── */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Active intelligence
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                    Top movements
                  </h2>
                </div>
                <div className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                  live
                </div>
              </div>

              <div className="space-y-4">
                {sorted.map((competitor) => {
                  const color = getMovementColor(
                    competitor.latest_movement_type
                  );

                  return (
                    <div
                      key={competitor.competitor_id}
                      onClick={() =>
                        handleBlipClick(competitor.competitor_id)
                      }
                      className="cursor-pointer rounded-[22px] border bg-[linear-gradient(180deg,rgba(12,18,28,0.98),rgba(8,13,20,0.98))] p-4 transition-colors"
                      style={{ borderColor: "#142234" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-slate-100">
                            {competitor.competitor_name}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {getMovementLabel(competitor.latest_movement_type)}
                          </div>
                        </div>

                        <span
                          className="mt-1 h-3.5 w-3.5 rounded-full shadow-[0_0_18px_currentColor]"
                          style={{ backgroundColor: color, color }}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Momentum
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-100">
                            {formatNumber(competitor.momentum_score)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Velocity
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-100">
                            {formatNumber(competitor.weighted_velocity_7d, 0)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#112033] bg-[#050c14] p-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Signals
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-100">
                            {formatNumber(
                              competitor.latest_movement_signal_count,
                              0
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-[#112033] bg-[#040910] px-3 py-2.5 text-sm leading-6 text-slate-400">
                        {competitor.latest_movement_summary
                          ? competitor.latest_movement_summary
                          : "No active strategic summary yet."}
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
