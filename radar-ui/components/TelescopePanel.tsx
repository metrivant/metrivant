"use client";

/**
 * TelescopePanel — Signal Field
 *
 * One unified visualization. All elements encode live RadarStats directly.
 *
 * Center pulse  → speed encodes signal frequency (slow = quiet, fast = active)
 * Expanding rings → one per accelerating competitor
 * Competitor dots → one per tracked rival; brightness + size = momentum tier
 * Header strip  → status level + current movement type (always readable)
 * Metrics row   → ACCEL / RISING / SIG·7D as large numbers
 */

import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RadarStats = {
  total: number;
  accelerating: number;
  rising: number;
  signals7d: number;
  topMovement: string | null;
};

type StatusLevel = "QUIET" | "ACTIVE" | "HIGH" | "CRITICAL";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StatusLevel, string> = {
  QUIET:    "#2EE6A6",
  ACTIVE:   "#57a6ff",
  HIGH:     "#F59E0B",
  CRITICAL: "#EF4444",
};

const STATUS_LABELS: Record<StatusLevel, string> = {
  QUIET:    "No movement",
  ACTIVE:   "Activity detected",
  HIGH:     "Competitor accelerating",
  CRITICAL: "Market convergence",
};

const W  = 220;
const H  = 96;
const CX = W / 2;
// Center of visual field — leaves ~18px strip at bottom for competitor dots
const CY = 38;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(stats: RadarStats | undefined): StatusLevel {
  if (!stats || stats.total === 0) return "QUIET";
  const { accelerating, rising, signals7d } = stats;
  if (accelerating >= 2) return "CRITICAL";
  if (accelerating >= 1) return "HIGH";
  if (rising >= 1 || signals7d >= 3) return "ACTIVE";
  return "QUIET";
}

function fmtMovement(m: string | null): string {
  if (!m) return "";
  return m.replace(/_/g, " ").toUpperCase().slice(0, 20);
}

// Pulse duration inversely encodes signal frequency — the key data link
function pulseDur(signals7d: number): number {
  if (signals7d === 0)  return 4.8;
  if (signals7d <= 3)   return 3.2;
  if (signals7d <= 8)   return 1.9;
  if (signals7d <= 15)  return 1.1;
  return 0.72;
}

// ── Signal Field SVG ──────────────────────────────────────────────────────────

function SignalField({ stats }: { stats: RadarStats }) {
  const { total, accelerating, rising, signals7d } = stats;
  const pulse      = pulseDur(signals7d);
  const coreOpac   = signals7d === 0 ? 0.18 : signals7d <= 5 ? 0.55 : 0.90;
  const ringCount  = Math.min(accelerating, 3);

  // Competitor dot strip
  const dotCount   = Math.min(total, 20);
  const dotSpacing = dotCount > 1 ? Math.min(9.5, (W - 28) / (dotCount - 1)) : 0;
  const dotsStartX = CX - (dotSpacing * (dotCount - 1)) / 2;

  return (
    <g>
      {/* ── Static reference rings — structural skeleton */}
      <circle cx={CX} cy={CY} r={42} fill="none" stroke="rgba(255,255,255,0.048)" strokeWidth={0.6} />
      <circle cx={CX} cy={CY} r={24} fill="none" stroke="rgba(255,255,255,0.036)" strokeWidth={0.5} />

      {/* ── Expanding rings — one per accelerating competitor */}
      {Array.from({ length: ringCount }, (_, i) => (
        <motion.circle
          key={`ring-${i}`}
          cx={CX} cy={CY}
          r={9}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.85 - i * 0.18}
          animate={{ r: [9, 46 + i * 8], opacity: [0.42, 0] }}
          transition={{
            duration:    1.5 + i * 0.38,
            repeat:      Infinity,
            delay:       i * 0.65,
            ease:        "easeOut",
            repeatDelay: 0.05,
          }}
        />
      ))}

      {/* ── Center pulse — speed IS the signal frequency data */}
      <motion.circle
        cx={CX} cy={CY} r={4}
        fill="#ffffff"
        animate={{
          opacity: [coreOpac * 0.38, coreOpac, coreOpac * 0.38],
          r:       [3.0, 5.2, 3.0],
        }}
        transition={{ duration: pulse, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Glow — only renders when there is signal activity */}
      {signals7d > 0 && (
        <motion.circle
          cx={CX} cy={CY} r={16}
          fill="#ffffff"
          animate={{ opacity: [0, coreOpac * 0.09, 0] }}
          transition={{ duration: pulse, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* ── Competitor dot strip — one dot per rival */}
      {dotCount === 0 ? (
        <text
          x={CX} y={H - 6}
          textAnchor="middle"
          fontSize={6}
          fontFamily="monospace"
          letterSpacing={2}
          fill="rgba(255,255,255,0.14)"
        >
          NO RIVALS TRACKED
        </text>
      ) : (
        Array.from({ length: dotCount }, (_, i) => {
          const isAccel  = i < accelerating;
          const isRising = !isAccel && i < accelerating + rising;
          const cx       = dotsStartX + i * dotSpacing;
          // Accelerating dots float slightly above the baseline
          const cy       = isAccel ? H - 12 : isRising ? H - 10 : H - 8;
          const r        = isAccel ? 2.2 : isRising ? 1.5 : 0.95;
          const opacity  = isAccel ? 0.92 : isRising ? 0.52 : 0.18;

          return isAccel ? (
            // Accelerating dots pulse in sync with center
            <motion.circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="#ffffff"
              animate={{ opacity: [0.55, 0.94, 0.55] }}
              transition={{
                duration: pulse * 0.75,
                repeat:   Infinity,
                ease:     "easeInOut",
                delay:    i * 0.07,
              }}
            />
          ) : (
            <circle key={i} cx={cx} cy={cy} r={r} fill="#ffffff" opacity={opacity} />
          );
        })
      )}

      {/* ── Dot strip legend */}
      {dotCount > 0 && (
        <text
          x={W - 6} y={H - 4}
          textAnchor="end"
          fontSize={5.5}
          fontFamily="monospace"
          letterSpacing={1.2}
          fill="rgba(255,255,255,0.13)"
        >
          {total} RIVALS
        </text>
      )}
    </g>
  );
}

// ── Metric column ─────────────────────────────────────────────────────────────

function Metric({
  value, label, highlight,
}: {
  value: number;
  label: string;
  highlight?: string;
}) {
  const active = value > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
      <div style={{
        fontFamily:    "monospace",
        fontSize:      15,
        fontWeight:    700,
        lineHeight:    1,
        letterSpacing: "-0.01em",
        color: active && highlight ? highlight : active ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.16)",
      }}>
        {value}
      </div>
      <div style={{
        fontFamily:    "monospace",
        fontSize:      6.5,
        letterSpacing: "0.16em",
        color:         "rgba(255,255,255,0.20)",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ radarStats }: { radarStats?: RadarStats }) {
  const stats: RadarStats = radarStats ?? {
    total: 0, accelerating: 0, rising: 0, signals7d: 0, topMovement: null,
  };

  const status      = deriveStatus(radarStats);
  const statusColor = STATUS_COLORS[status];
  const movement    = fmtMovement(stats.topMovement);

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        borderRadius:  8,
        overflow:      "hidden",
        border:        "1px solid rgba(255,255,255,0.06)",
        background:    "#040404",
        minHeight:     175,
        userSelect:    "none",
      }}
    >
      {/* ── Header strip — always readable status + movement ── */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "6px 8px 5px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink:   0,
        }}
      >
        {/* Pulsing status dot */}
        <motion.div
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: statusColor, flexShrink: 0,
          }}
          animate={{ opacity: [0.50, 1.0, 0.50] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Status level — the primary read */}
        <span style={{
          fontFamily:    "monospace",
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: "0.18em",
          color:         statusColor,
          flexShrink:    0,
        }}>
          {status}
        </span>
        {/* Status description */}
        <span style={{
          fontFamily:    "monospace",
          fontSize:      6.5,
          letterSpacing: "0.07em",
          color:         "rgba(255,255,255,0.22)",
          flexShrink:    0,
        }}>
          —
        </span>
        <span style={{
          fontFamily:     "monospace",
          fontSize:       6.5,
          letterSpacing:  "0.07em",
          color:          "rgba(255,255,255,0.25)",
          overflow:       "hidden",
          textOverflow:   "ellipsis",
          whiteSpace:     "nowrap",
          flex:           1,
        }}>
          {movement || STATUS_LABELS[status]}
        </span>
      </div>

      {/* ── Signal field — visual encoding of live data ── */}
      <div style={{ flex: 1, position: "relative", lineHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.svg
            key={status}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="96"
            style={{ display: "block" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.40, ease: "easeInOut" }}
            aria-hidden
          >
            <rect width={W} height={H} fill="#040404" />
            <SignalField stats={stats} />
          </motion.svg>
        </AnimatePresence>
      </div>

      {/* ── Metrics row — exact numbers, always visible ── */}
      <div
        style={{
          display:      "flex",
          borderTop:    "1px solid rgba(255,255,255,0.05)",
          padding:      "7px 6px 6px",
          gap:          0,
          flexShrink:   0,
        }}
      >
        <Metric value={stats.accelerating} label="ACCEL"  highlight={STATUS_COLORS.CRITICAL} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />
        <Metric value={stats.rising}        label="RISING" highlight={STATUS_COLORS.HIGH}     />
        <div style={{ width: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />
        <Metric value={stats.signals7d}     label="SIG·7D"                                    />
      </div>
    </div>
  );
}
