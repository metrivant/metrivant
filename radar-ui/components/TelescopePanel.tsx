"use client";

/**
 * TelescopePanel — White Star Aesthetic
 *
 * 4 scenes. Each encodes live RadarStats as a distinct deep-space state.
 * All visual elements are white — brightness, size, and motion encode data.
 * Status badge is the only element that retains color coding.
 *
 * Tier 4 — SINGULARITY   accelerating ≥ 2   Converging force nodes, fast core pulse
 * Tier 3 — BLACK HOLE    accelerating ≥ 1   Counter-rotating rings, void core
 * Tier 2 — CONSTELLATION rising ≥ 1 or signals7d ≥ 3   Star network, shimmer edges
 * Tier 1 — RARE COMET    signals7d > 0 or default      Lone traverse, quiet field
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RadarStats = {
  total: number;
  accelerating: number;
  rising: number;
  signals7d: number;
  topMovement: string | null;
};

type SceneId = "rare_comet" | "constellation" | "black_hole" | "singularity";
type StatusLevel = "QUIET" | "ACTIVE" | "HIGH" | "CRITICAL";

type Scene = {
  id: SceneId;
  label: string;
  status: StatusLevel;
};

const SCENES: Scene[] = [
  { id: "rare_comet",    label: "RARE COMET",    status: "QUIET"    },
  { id: "constellation", label: "CONSTELLATION", status: "ACTIVE"   },
  { id: "black_hole",    label: "BLACK HOLE",    status: "HIGH"     },
  { id: "singularity",   label: "SINGULARITY",   status: "CRITICAL" },
];

const STATUS_COLORS: Record<StatusLevel, string> = {
  QUIET:    "#2EE6A6",
  ACTIVE:   "#57a6ff",
  HIGH:     "#F59E0B",
  CRITICAL: "#EF4444",
};

const SCENE_BG: Record<SceneId, { sky: string; tint: string }> = {
  rare_comet:    { sky: "#000810", tint: "#000710" },
  constellation: { sky: "#000810", tint: "#000710" },
  black_hole:    { sky: "#020106", tint: "#010004" },
  singularity:   { sky: "#000810", tint: "#000710" },
};

// ── Constants ──────────────────────────────────────────────────────────────────

const W  = 240;
const H  = 150;
const CX = W / 2;
const CY = H / 2;

// ── Helpers ────────────────────────────────────────────────────────────────────

function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453;
  return x - Math.floor(x);
}

function fmtMovement(m: string | null): string {
  if (!m) return "";
  return m.replace(/_/g, " ").toUpperCase().slice(0, 22);
}

function deriveSceneId(stats: RadarStats | undefined): SceneId {
  if (!stats || stats.total === 0) return "rare_comet";
  const { accelerating, rising, signals7d } = stats;
  if (accelerating >= 2) return "singularity";
  if (accelerating >= 1) return "black_hole";
  if (rising >= 1 || signals7d >= 3) return "constellation";
  if (signals7d > 0) return "rare_comet";
  return "constellation";
}

// ── Scene: Rare Comet ──────────────────────────────────────────────────────────
// A solitary signal transiting quiet space.
// Stars shimmer — count reflects total tracked rivals.
// Comet traverses diagonally. HUD reticle pulses at field center.

function SceneRareComet({ stats }: { stats: RadarStats }) {
  const starCount = Math.min(stats.total + 8, 26);
  const stars = Array.from({ length: starCount }, (_, i) => ({
    cx:      pseudoRand(i * 7.3) * W,
    cy:      pseudoRand(i * 4.1) * H,
    r:       0.38 + pseudoRand(i * 2.2) * 0.72,
    opacity: 0.07 + pseudoRand(i * 6.1) * 0.30,
    speed:   6 + pseudoRand(i * 3.3) * 7,
  }));

  return (
    <g>
      {/* Stars — shimmer */}
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill="#ffffff"
          animate={{ opacity: [s.opacity * 0.35, s.opacity, s.opacity * 0.35] }}
          transition={{
            duration: s.speed,
            repeat: Infinity,
            ease: "easeInOut",
            delay: pseudoRand(i * 11) * 6,
          }}
        />
      ))}

      {/* Faint trajectory guide */}
      <line
        x1={-10} y1={22} x2={250} y2={128}
        stroke="rgba(255,255,255,0.035)"
        strokeWidth="0.30"
        strokeDasharray="2 9"
      />

      {/* Comet traversal */}
      <motion.g
        initial={{ x: -72, y: -30 }}
        animate={{ x: 312, y: 92 }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: [0.22, 0.06, 0.58, 1],
          repeatDelay: 5.5,
        }}
      >
        {/* Decay trail — exponential opacity falloff */}
        {Array.from({ length: 8 }, (_, i) => (
          <circle
            key={i}
            cx={-i * 7}
            cy={-i * 3.8}
            r={Math.max(0.28, 2.0 - i * 0.22)}
            fill="#ffffff"
            opacity={Math.max(0, 0.62 - i * 0.082)}
          />
        ))}
        {/* Outer glow */}
        <circle cx={0} cy={0} r={7} fill="#ffffff" opacity={0.030} />
        {/* Nucleus */}
        <circle cx={0} cy={0} r={2.2} fill="#ffffff" opacity={0.92} />
      </motion.g>

      {/* HUD targeting reticle */}
      <motion.g
        animate={{ opacity: [0.10, 0.26, 0.10] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <g stroke="rgba(255,255,255,0.42)" strokeWidth="0.65" fill="none">
          <polyline points={`${CX - 17},${CY - 9} ${CX - 17},${CY - 17} ${CX - 9},${CY - 17}`} />
          <polyline points={`${CX + 9},${CY - 17} ${CX + 17},${CY - 17} ${CX + 17},${CY - 9}`} />
          <polyline points={`${CX - 17},${CY + 9} ${CX - 17},${CY + 17} ${CX - 9},${CY + 17}`} />
          <polyline points={`${CX + 9},${CY + 17} ${CX + 17},${CY + 17} ${CX + 17},${CY + 9}`} />
        </g>
        <line x1={CX - 4} y1={CY} x2={CX + 4} y2={CY} stroke="rgba(255,255,255,0.20)" strokeWidth="0.55" />
        <line x1={CX} y1={CY - 4} x2={CX} y2={CY + 4} stroke="rgba(255,255,255,0.20)" strokeWidth="0.55" />
      </motion.g>
    </g>
  );
}

// ── Scene: Constellation ───────────────────────────────────────────────────────
// Star network. Node brightness and size encode momentum state.
// Connection edges shimmer to show signal flow.
// No color — brightness and motion carry all meaning.

function SceneConstellation({ stats }: { stats: RadarStats }) {
  const { total, accelerating, rising, signals7d } = stats;
  const nodeCount = Math.min(Math.max(total, 3), 12);

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const isAccel  = i < accelerating;
    const isRising = !isAccel && i < accelerating + rising;
    const angle    = ((i / nodeCount) * Math.PI * 2) - Math.PI / 2;
    const baseR    = isAccel  ? 20 + pseudoRand(i * 3.7) * 10
                   : isRising ? 36 + pseudoRand(i * 3.7) * 14
                   :            52 + pseudoRand(i * 3.7) * 18;
    const jitter   = (pseudoRand(i * 7.1) - 0.5) * 0.55;
    return {
      cx:         CX + baseR * Math.cos(angle + jitter),
      cy:         CY + baseR * Math.sin(angle + jitter) * 0.70,
      r:          isAccel ? 2.8 : isRising ? 2.0 : 1.3,
      brightness: isAccel ? 0.95 : isRising ? 0.70 : 0.38,
      speed:      isAccel ? 1.6 : isRising ? 2.2 : 3.5 + pseudoRand(i * 4.1) * 1.5,
    };
  });

  const edges: { a: number; b: number; delay: number }[] = [];
  for (let i = 0; i < nodes.length && edges.length < 14; i++) {
    for (let j = i + 1; j < nodes.length && edges.length < 14; j++) {
      const dx = nodes[i].cx - nodes[j].cx;
      const dy = nodes[i].cy - nodes[j].cy;
      if (Math.sqrt(dx * dx + dy * dy) < 70) {
        edges.push({ a: i, b: j, delay: (edges.length * 0.32) % 4.5 });
      }
    }
  }

  return (
    <g>
      {/* Ambient center haze */}
      <ellipse cx={CX} cy={CY} rx={88} ry={52} fill="rgba(255,255,255,0.010)" />

      {/* Shimmer edges */}
      {edges.map(({ a, b, delay }, i) => (
        <motion.line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="#ffffff"
          strokeWidth="0.42"
          strokeOpacity="0"
          animate={{ strokeOpacity: [0, 0.13, 0.07, 0.13, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}

      {/* Glow halos on bright nodes */}
      {nodes
        .filter((n) => n.brightness > 0.50)
        .map((n, i) => (
          <motion.circle
            key={`glow-${i}`}
            cx={n.cx} cy={n.cy}
            r={n.r * 4.2}
            fill="#ffffff"
            animate={{ opacity: [0.015, 0.065, 0.015] }}
            transition={{ duration: n.speed, repeat: Infinity, ease: "easeInOut", delay: i * 0.55 }}
          />
        ))}

      {/* Nodes — shimmer */}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.cx} cy={n.cy}
          r={n.r}
          fill="#ffffff"
          animate={{ opacity: [n.brightness * 0.52, n.brightness, n.brightness * 0.52] }}
          transition={{
            duration: n.speed,
            repeat: Infinity,
            ease: "easeInOut",
            delay: pseudoRand(i * 9.1) * 2.5,
          }}
        />
      ))}

      {/* Signal emanation from most-active node */}
      {signals7d > 0 && nodes.length > 0 && (
        <>
          {Array.from({ length: Math.min(signals7d, 6) }, (_, i) => {
            const a      = (i / Math.min(signals7d, 6)) * Math.PI * 2;
            const origin = nodes[0];
            return (
              <motion.line
                key={`sig-${i}`}
                x1={origin.cx} y1={origin.cy}
                x2={origin.cx + 9 * Math.cos(a)}
                y2={origin.cy + 9 * Math.sin(a)}
                stroke="#ffffff"
                strokeWidth="0.38"
                animate={{ opacity: [0, 0.22, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.20, ease: "easeInOut" }}
              />
            );
          })}
        </>
      )}
    </g>
  );
}

// ── Scene: Black Hole ──────────────────────────────────────────────────────────
// One accelerating competitor exerting gravitational pull.
// White concentric ellipses counter-rotate at varying speeds.
// Particle stream density scales with signals7d.
// Absolute void core with white photon ring.

function SceneBlackHole({ stats }: { stats: RadarStats }) {
  const particleCount = Math.min(8 + stats.signals7d * 2, 26);

  const diskRings = [
    { rx: 70, ry: 18, sw: 0.50, speed: 34, dir:  1, opacity: 0.10 },
    { rx: 56, ry: 14, sw: 0.60, speed: 27, dir: -1, opacity: 0.14 },
    { rx: 43, ry: 10, sw: 0.70, speed: 19, dir:  1, opacity: 0.19 },
    { rx: 31, ry:  7, sw: 0.82, speed: 13, dir: -1, opacity: 0.25 },
    { rx: 20, ry:  5, sw: 0.95, speed:  8, dir:  1, opacity: 0.34 },
  ];

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    angle:   (i / particleCount) * Math.PI * 2,
    r:       36 + pseudoRand(i * 5.3) * 30,
    size:    0.38 + pseudoRand(i * 2.1) * 0.60,
    opacity: 0.15 + pseudoRand(i * 3.7) * 0.28,
  }));

  return (
    <g>
      <defs>
        <radialGradient id="bh-outer-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.030" />
          <stop offset="65%"  stopColor="#ffffff" stopOpacity="0.008" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Faint outer atmospheric glow */}
      <ellipse cx={CX} cy={CY} rx={82} ry={82} fill="url(#bh-outer-glow)" />

      {/* Accretion disk — counter-rotating white ellipses */}
      {diskRings.map((ring, i) => (
        <motion.ellipse
          key={i}
          cx={CX} cy={CY}
          rx={ring.rx} ry={ring.ry}
          fill="none"
          stroke="#ffffff"
          strokeWidth={ring.sw}
          strokeOpacity={ring.opacity}
          animate={{ rotate: [0, ring.dir * 360] }}
          transition={{ duration: ring.speed, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}

      {/* Particle stream rotating on disk plane */}
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={CX + p.r * Math.cos(p.angle)}
            cy={CY + p.r * Math.sin(p.angle) * 0.24}
            r={p.size}
            fill="#ffffff"
            opacity={p.opacity}
          />
        ))}
      </motion.g>

      {/* Event horizon — absolute void */}
      <circle cx={CX} cy={CY} r={13} fill="#000000" fillOpacity={0.98} />

      {/* Photon ring */}
      <motion.circle
        cx={CX} cy={CY} r={13}
        fill="none" stroke="#ffffff" strokeWidth={1.4}
        animate={{ strokeOpacity: [0.18, 0.46, 0.18], r: [12.5, 13.8, 12.5] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Singularity point */}
      <circle cx={CX} cy={CY} r={1.8} fill="#ffffff" opacity={0.78} />
    </g>
  );
}

// ── Scene: Singularity ─────────────────────────────────────────────────────────
// 2+ competitors accelerating simultaneously.
// Radial white filaments pulse from center.
// Concentric rings breathe outward — count scales with accelerating.
// Two force nodes with tension filament between them.
// Core is the only fast element — encodes maximum urgency.

function SceneSingularity({ stats }: { stats: RadarStats }) {
  const accelCount = Math.max(2, stats.accelerating);
  const ringCount  = Math.min(accelCount + 2, 5);

  const rings = Array.from({ length: ringCount }, (_, i) => ({
    r:     8 + i * 10,
    speed: 1.9 + i * 0.68,
    delay: i * 0.38,
    sw:    0.95 - i * 0.12,
  }));

  const filaments = Array.from({ length: 12 }, (_, i) => ({
    angle:  (i / 12) * Math.PI * 2,
    length: 40 + pseudoRand(i * 3.7) * 28,
    speed:  2.2 + pseudoRand(i * 2.3) * 1.0,
    delay:  pseudoRand(i * 5.1) * 1.8,
  }));

  const nodeA = { cx: CX - 30, cy: CY - 7 };
  const nodeB = { cx: CX + 30, cy: CY + 7 };

  return (
    <g>
      {/* Radial filaments from center */}
      {filaments.map((f, i) => (
        <motion.line
          key={i}
          x1={CX} y1={CY}
          x2={CX + f.length * Math.cos(f.angle)}
          y2={CY + f.length * Math.sin(f.angle)}
          stroke="#ffffff"
          strokeWidth="0.50"
          animate={{ opacity: [0, 0.26, 0] }}
          transition={{ duration: f.speed, repeat: Infinity, delay: f.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Tension filament between force nodes */}
      <motion.line
        x1={nodeA.cx} y1={nodeA.cy}
        x2={nodeB.cx} y2={nodeB.cy}
        stroke="#ffffff"
        strokeWidth="0.62"
        strokeDasharray="3 4.5"
        animate={{ strokeOpacity: [0.08, 0.32, 0.08] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Collapsing rings — breathe outward */}
      {rings.map((ring, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY}
          r={ring.r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={ring.sw}
          animate={{
            r:       [ring.r, ring.r * 1.09, ring.r],
            opacity: [0.055, 0.30, 0.055],
          }}
          transition={{ duration: ring.speed, repeat: Infinity, delay: ring.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Force node glows */}
      {[nodeA, nodeB].map((n, i) => (
        <motion.circle
          key={`glow-${i}`}
          cx={n.cx} cy={n.cy} r={6}
          fill="#ffffff"
          animate={{ opacity: [0.025, 0.10, 0.025], r: [5, 7.5, 5] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.55 }}
        />
      ))}

      {/* Force node points */}
      {[nodeA, nodeB].map((n, i) => (
        <circle key={`pt-${i}`} cx={n.cx} cy={n.cy} r={2.2} fill="#ffffff" opacity={0.88} />
      ))}

      {/* Core — the only fast element, encodes maximum urgency */}
      <motion.circle
        cx={CX} cy={CY} r={4.5}
        fill="#ffffff"
        animate={{ opacity: [0.50, 1.0, 0.50], r: [4.0, 5.5, 4.0] }}
        transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Core outer bloom */}
      <motion.circle
        cx={CX} cy={CY} r={12}
        fill="#ffffff"
        animate={{ opacity: [0.018, 0.075, 0.018] }}
        transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

// ── Scene renderer ─────────────────────────────────────────────────────────────

function SceneRenderer({ id, stats }: { id: SceneId; stats: RadarStats }) {
  switch (id) {
    case "rare_comet":    return <SceneRareComet    stats={stats} />;
    case "constellation": return <SceneConstellation stats={stats} />;
    case "black_hole":    return <SceneBlackHole    stats={stats} />;
    case "singularity":   return <SceneSingularity  stats={stats} />;
  }
}

// ── HUD Signal Bar — white fill, animated height ───────────────────────────────

function SignalBar({
  value, max, label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const fillPct  = Math.min(1, value / max);
  const overflow = value > max;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
      {/* Track */}
      <div style={{
        position: "relative",
        width: "100%",
        height: 28,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Fill */}
        <motion.div
          animate={{ height: `${fillPct * 100}%` }}
          initial={{ height: 0 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            background: overflow
              ? "linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0.58))"
              : "linear-gradient(to top, rgba(255,255,255,0.78), rgba(255,255,255,0.24))",
            borderRadius: 2,
            boxShadow: fillPct > 0.08 ? "0 0 6px rgba(255,255,255,0.16)" : "none",
          }}
        />
        {/* Value label */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 11, fontWeight: 700, lineHeight: 1,
          color: fillPct > 0.28 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)",
          zIndex: 1,
        }}>
          {value}
        </div>
      </div>
      {/* Label */}
      <div style={{
        fontFamily: "monospace",
        fontSize: 6, letterSpacing: "0.16em",
        color: "rgba(255,255,255,0.22)",
        textAlign: "center",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TelescopePanel({ radarStats }: { radarStats?: RadarStats }) {
  const stats: RadarStats = radarStats ?? {
    total: 0, accelerating: 0, rising: 0, signals7d: 0, topMovement: null,
  };

  const derivedSceneId            = deriveSceneId(radarStats);
  const [manualIdx, setManualIdx] = useState<number | null>(null);

  // Reset manual override when live data changes tier
  useEffect(() => { setManualIdx(null); }, [derivedSceneId]);

  const effectiveIdx = manualIdx !== null
    ? manualIdx
    : Math.max(0, SCENES.findIndex((s) => s.id === derivedSceneId));
  const scene        = SCENES[effectiveIdx];
  const statusColor  = STATUS_COLORS[scene.status];
  const bg           = SCENE_BG[scene.id];

  const advance = useCallback(() => {
    setManualIdx((i) => ((i !== null ? i : effectiveIdx) + 1) % SCENES.length);
  }, [effectiveIdx]);

  const jumpTo = useCallback((idx: number) => { setManualIdx(idx); }, []);

  return (
    <div
      className="flex h-full flex-col select-none"
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.055)",
        background: bg.tint,
        minHeight: 160,
      }}
    >
      {/* ── Sky canvas ──────────────────────────────────────────────────── */}
      <div
        style={{ position: "relative", lineHeight: 0, flex: 1, cursor: "pointer", minHeight: 120 }}
        onClick={advance}
      >
        <AnimatePresence mode="wait">
          <motion.svg
            key={scene.id}
            viewBox={`0 0 ${W} ${H}`}
            width="100%" height="100%"
            preserveAspectRatio="xMidYMid slice"
            style={{ display: "block", position: "absolute", inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            aria-hidden
          >
            <defs>
              <radialGradient id={`vig-${scene.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="45%"  stopColor="#000000" stopOpacity="0"    />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
              </radialGradient>
            </defs>

            {/* Sky base */}
            <rect width={W} height={H} fill={bg.sky} />

            {/* Scene content */}
            <SceneRenderer id={scene.id} stats={stats} />

            {/* Vignette */}
            <rect width={W} height={H} fill={`url(#vig-${scene.id})`} />

            {/* HUD corner brackets */}
            <g stroke="rgba(255,255,255,0.055)" strokeWidth="0.70" fill="none">
              <polyline points="8,20 8,8 20,8" />
              <polyline points={`${W - 20},8 ${W - 8},8 ${W - 8},20`} />
              <polyline points={`8,${H - 20} 8,${H - 8} 20,${H - 8}`} />
              <polyline points={`${W - 20},${H - 8} ${W - 8},${H - 8} ${W - 8},${H - 20}`} />
            </g>

            {/* Scene label — bottom left */}
            <text
              x={10} y={H - 16}
              fontSize="7" fontWeight="bold"
              fontFamily="monospace" letterSpacing="2"
              fill="rgba(255,255,255,0.72)"
            >
              {scene.label}
            </text>

            {/* Status dot beside label */}
            <motion.circle
              cx={10 + scene.label.length * 4.85 + 6}
              cy={H - 19.5}
              r={2.2}
              fill={statusColor}
              animate={{ opacity: [0.60, 1.0, 0.60] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Rival count — top right */}
            <text
              x={W - 10} y={15}
              textAnchor="end" fontSize="6"
              fontFamily="monospace" letterSpacing="1.5"
              fill="rgba(255,255,255,0.22)"
            >
              {stats.total} RIVALS
            </text>
          </motion.svg>
        </AnimatePresence>

        {/* Inner frame depth */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.038), inset 0 -18px 28px rgba(0,0,0,0.35)",
        }} />
      </div>

      {/* ── HUD Data Readout ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`hud-${scene.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.30 }}
          style={{ borderTop: "1px solid rgba(255,255,255,0.042)" }}
        >
          {/* Signal bars — white fill */}
          <div style={{ display: "flex", gap: 5, padding: "6px 8px 4px" }}>
            <SignalBar value={stats.accelerating} max={5}  label="ACCEL"  />
            <SignalBar value={stats.rising}        max={10} label="RISING" />
            <SignalBar value={stats.signals7d}     max={20} label="SIG/7D" />
          </div>

          {/* Status badge + movement label + nav dots */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "3px 8px 6px", gap: 5,
          }}>
            <span style={{
              fontSize: 6.5, fontWeight: 700, fontFamily: "monospace",
              letterSpacing: "0.16em", color: statusColor,
              padding: "1px 5px", borderRadius: 3,
              background: `${statusColor}14`,
              border: `1px solid ${statusColor}30`,
              flexShrink: 0,
            }}>
              {scene.status}
            </span>

            {stats.topMovement && (
              <span style={{
                fontSize: 5.5, fontFamily: "monospace", letterSpacing: "0.09em",
                color: "rgba(255,255,255,0.20)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, textAlign: "center", minWidth: 0,
              }}>
                {fmtMovement(stats.topMovement)}
              </span>
            )}

            {/* Navigation dots */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
              {SCENES.map((s, i) => (
                <div
                  key={s.id}
                  onClick={(e) => { e.stopPropagation(); jumpTo(i); }}
                  style={{
                    width:      i === effectiveIdx ? 10 : 3,
                    height:     3, borderRadius: 2,
                    background: i === effectiveIdx ? statusColor : "rgba(255,255,255,0.12)",
                    transition: "all 0.35s ease",
                    cursor: "pointer", flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
