"use client";

/**
 * TelescopePanel — Redesigned Market Intelligence Visualiser
 *
 * 4 scenes, each a direct encoding of live signal field data.
 * Scenes are derived from RadarStats and reflect actual strategic conditions.
 *
 * Tier 4 — SINGULARITY   accelerating ≥ 2   Multiple competitors collapsing inward
 * Tier 3 — BLACK HOLE    accelerating ≥ 1   One competitor exerting gravitational pull
 * Tier 2 — CONSTELLATION rising ≥ 1 or signals7d ≥ 3   Active signal network
 * Tier 1 — RARE COMET    signals7d > 0 or default      Isolated detection, quiet field
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
  rare_comet:    { sky: "#00080f", tint: "#000610" },
  constellation: { sky: "#000a08", tint: "#000c06" },
  black_hole:    { sky: "#090001", tint: "#060001" },
  singularity:   { sky: "#000d06", tint: "#000a04" },
};

// ── Constants ──────────────────────────────────────────────────────────────────

const W  = 240;
const H  = 150;
const CX = W / 2;
const CY = H / 2;

const B = {
  green:  "#2EE6A6",
  blue:   "#57a6ff",
  amber:  "#F59E0B",
  red:    "#EF4444",
  white:  "#E2E8F0",
} as const;

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

// ── Scene: Constellation ───────────────────────────────────────────────────────
// Signal network map — nodes represent the field, colored by momentum state.
// Connection lines pulse to encode signal flow between tracked competitors.

function SceneConstellation({ stats }: { stats: RadarStats }) {
  const { total, accelerating, rising, signals7d } = stats;
  const nodeCount = Math.min(Math.max(total, 3), 12);

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const isAccel  = i < accelerating;
    const isRising = !isAccel && i < accelerating + rising;
    const angle    = ((i / nodeCount) * Math.PI * 2) - Math.PI / 2;
    const baseR    = isAccel ? 20 + pseudoRand(i * 3.7) * 10
                   : isRising ? 36 + pseudoRand(i * 3.7) * 14
                   : 52 + pseudoRand(i * 3.7) * 18;
    const jitter   = (pseudoRand(i * 7.1) - 0.5) * 0.55;
    return {
      cx:         CX + baseR * Math.cos(angle + jitter),
      cy:         CY + baseR * Math.sin(angle + jitter) * 0.70,
      r:          isAccel ? 2.8 : isRising ? 2.2 : 1.5,
      color:      isAccel ? B.red : isRising ? B.amber : B.green,
      brightness: isAccel ? 0.95 : isRising ? 0.78 : 0.50,
      speed:      isAccel ? 1.4 : isRising ? 2.0 : 3.0 + pseudoRand(i * 4.1) * 1.8,
    };
  });

  const edges: { a: number; b: number; delay: number }[] = [];
  for (let i = 0; i < nodes.length && edges.length < 16; i++) {
    for (let j = i + 1; j < nodes.length && edges.length < 16; j++) {
      const dx = nodes[i].cx - nodes[j].cx;
      const dy = nodes[i].cy - nodes[j].cy;
      if (Math.sqrt(dx * dx + dy * dy) < 70) {
        edges.push({ a: i, b: j, delay: (edges.length * 0.30) % 4.0 });
      }
    }
  }

  return (
    <g>
      {/* Ambient field glow */}
      <ellipse cx={CX} cy={CY} rx={88} ry={52} fill="rgba(46,230,166,0.022)" />

      {/* Connection lines — sequential pulse encoding signal flow */}
      {edges.map(({ a, b, delay }, i) => {
        const edgeColor =
          nodes[a].color === B.red || nodes[b].color === B.red ? B.red :
          nodes[a].color === B.amber || nodes[b].color === B.amber ? B.amber :
          B.green;
        return (
          <motion.line
            key={i}
            x1={nodes[a].cx} y1={nodes[a].cy}
            x2={nodes[b].cx} y2={nodes[b].cy}
            stroke={edgeColor}
            strokeWidth="0.55"
            strokeOpacity="0"
            animate={{ strokeOpacity: [0, 0.20, 0.12, 0.20, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, delay, ease: "easeInOut" }}
          />
        );
      })}

      {/* Atmospheric halos on accelerating/rising nodes */}
      {nodes
        .filter((n) => n.color !== B.green)
        .map((n, i) => (
          <motion.circle
            key={`halo-${i}`}
            cx={n.cx} cy={n.cy}
            r={n.r * 3.8}
            fill={n.color}
            animate={{ opacity: [0.03, 0.11, 0.03] }}
            transition={{ duration: n.speed, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
          />
        ))}

      {/* Nodes */}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.cx} cy={n.cy}
          r={n.r}
          fill={n.color}
          animate={{ opacity: [n.brightness * 0.60, n.brightness, n.brightness * 0.60] }}
          transition={{
            duration: n.speed,
            repeat: Infinity,
            ease: "easeInOut",
            delay: pseudoRand(i * 9.1) * 2.2,
          }}
        />
      ))}

      {/* Signal emanation from most-active node — scales with signals7d */}
      {signals7d > 0 && nodes.length > 0 && (
        <>
          {Array.from({ length: Math.min(signals7d, 8) }, (_, i) => {
            const a = (i / Math.min(signals7d, 8)) * Math.PI * 2;
            const origin = nodes[0];
            return (
              <motion.line
                key={`sig-${i}`}
                x1={origin.cx} y1={origin.cy}
                x2={origin.cx + 10 * Math.cos(a)}
                y2={origin.cy + 10 * Math.sin(a)}
                stroke={B.green}
                strokeWidth="0.45"
                animate={{ opacity: [0, 0.28, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </>
      )}
    </g>
  );
}

// ── Scene: Rare Comet ──────────────────────────────────────────────────────────
// A solitary signal transiting quiet space. HUD reticle at field center.
// Background star count mirrors total tracked competitors.

function SceneRareComet({ stats }: { stats: RadarStats }) {
  const starCount = Math.min(stats.total + 6, 22);
  const stars = Array.from({ length: starCount }, (_, i) => ({
    cx:      pseudoRand(i * 7.3) * W,
    cy:      pseudoRand(i * 4.1) * H,
    r:       0.45 + pseudoRand(i * 2.2) * 0.65,
    opacity: 0.12 + pseudoRand(i * 6.1) * 0.24,
    speed:   5.5 + pseudoRand(i * 3.3) * 5.5,
  }));

  return (
    <g>
      {/* Background stars — monitored competitors at rest */}
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill={B.white}
          animate={{ opacity: [s.opacity * 0.45, s.opacity, s.opacity * 0.45] }}
          transition={{ duration: s.speed, repeat: Infinity, ease: "easeInOut", delay: pseudoRand(i * 11) * 5 }}
        />
      ))}

      {/* Faint trajectory guide */}
      <line
        x1={-10} y1={20} x2={250} y2={130}
        stroke="rgba(46,230,166,0.055)"
        strokeWidth="0.35"
        strokeDasharray="2.5 9"
      />

      {/* Comet — translates diagonally across the field */}
      <motion.g
        initial={{ x: -72, y: -32 }}
        animate={{ x: 312, y: 96 }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: [0.22, 0.06, 0.58, 1],
          repeatDelay: 5.5,
        }}
      >
        {/* Decay trail — 7 particles with exponential falloff */}
        {Array.from({ length: 7 }, (_, i) => (
          <circle
            key={i}
            cx={-i * 7.5}
            cy={-i * 4.2}
            r={Math.max(0.35, 2.2 - i * 0.26)}
            fill={i === 0 ? B.amber : B.green}
            opacity={Math.max(0, 0.68 - i * 0.10)}
          />
        ))}
        {/* Nucleus outer glow */}
        <circle cx={0} cy={0} r={6.5} fill={B.green} opacity={0.07} />
        {/* Nucleus */}
        <circle cx={0} cy={0} r={2.8} fill={B.white} opacity={0.55} />
        {/* Core */}
        <circle cx={0} cy={0} r={1.4} fill={B.green} opacity={0.95} />
      </motion.g>

      {/* HUD targeting reticle — center field scan */}
      <motion.g
        animate={{ opacity: [0.15, 0.32, 0.15] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <g stroke="rgba(46,230,166,0.60)" strokeWidth="0.65" fill="none">
          <polyline points={`${CX - 17},${CY - 9} ${CX - 17},${CY - 17} ${CX - 9},${CY - 17}`} />
          <polyline points={`${CX + 9},${CY - 17} ${CX + 17},${CY - 17} ${CX + 17},${CY - 9}`} />
          <polyline points={`${CX - 17},${CY + 9} ${CX - 17},${CY + 17} ${CX - 9},${CY + 17}`} />
          <polyline points={`${CX + 9},${CY + 17} ${CX + 17},${CY + 17} ${CX + 17},${CY + 9}`} />
        </g>
        <line x1={CX - 4} y1={CY} x2={CX + 4} y2={CY} stroke="rgba(46,230,166,0.30)" strokeWidth="0.55" />
        <line x1={CX} y1={CY - 4} x2={CX} y2={CY + 4} stroke="rgba(46,230,166,0.30)" strokeWidth="0.55" />
      </motion.g>
    </g>
  );
}

// ── Scene: Black Hole ──────────────────────────────────────────────────────────
// One accelerating competitor exerting gravitational pull on the field.
// Layered counter-rotating accretion disk: green outer → amber mid → red inner.
// Particle stream density scales with signals7d.

function SceneBlackHole({ stats }: { stats: RadarStats }) {
  const particleCount = Math.min(8 + stats.signals7d * 2, 28);

  const diskRings = [
    { rx: 70, ry: 18, color: B.green, sw: 0.65, speed: 30, dir:  1  },
    { rx: 58, ry: 14, color: B.green, sw: 0.75, speed: 24, dir: -1  },
    { rx: 46, ry: 11, color: B.amber, sw: 0.85, speed: 17, dir:  1  },
    { rx: 34, ry: 8,  color: B.amber, sw: 0.95, speed: 12, dir: -1  },
    { rx: 22, ry: 5,  color: B.red,   sw: 1.10, speed: 8,  dir:  1  },
  ];

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    angle:   (i / particleCount) * Math.PI * 2,
    r:       40 + pseudoRand(i * 5.3) * 30,
    size:    0.45 + pseudoRand(i * 2.1) * 0.75,
    color:   i % 5 === 0 ? B.red : i % 3 === 0 ? B.amber : B.green,
    opacity: 0.28 + pseudoRand(i * 3.7) * 0.42,
  }));

  return (
    <g>
      <defs>
        <radialGradient id="bh-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#350308" stopOpacity="0.55" />
          <stop offset="55%"  stopColor="#0d0204" stopOpacity="0.32" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Atmospheric void */}
      <ellipse cx={CX} cy={CY} rx={75} ry={75} fill="url(#bh-core)" />

      {/* Accretion disk — counter-rotating layers */}
      {diskRings.map((ring, i) => (
        <motion.ellipse
          key={i}
          cx={CX} cy={CY}
          rx={ring.rx} ry={ring.ry}
          fill="none"
          stroke={ring.color}
          strokeWidth={ring.sw}
          strokeOpacity={0.10 + i * 0.048}
          animate={{ rotate: [0, ring.dir * 360] }}
          transition={{ duration: ring.speed, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}

      {/* Particle stream rotating on disk plane */}
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={CX + p.r * Math.cos(p.angle)}
            cy={CY + p.r * Math.sin(p.angle) * 0.24}
            r={p.size}
            fill={p.color}
            opacity={p.opacity}
          />
        ))}
      </motion.g>

      {/* Event horizon — absolute void */}
      <circle cx={CX} cy={CY} r={13} fill="#000000" fillOpacity={0.97} />

      {/* Photon ring */}
      <motion.circle
        cx={CX} cy={CY} r={13}
        fill="none" stroke={B.red} strokeWidth={1.6}
        animate={{ strokeOpacity: [0.28, 0.60, 0.28], r: [12.5, 14, 12.5] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Inner atmospheric bleed */}
      <motion.circle
        cx={CX} cy={CY} r={8}
        fill={B.red}
        animate={{ opacity: [0.05, 0.13, 0.05] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Singularity point */}
      <circle cx={CX} cy={CY} r={2.2} fill={B.white} opacity={0.60} />
    </g>
  );
}

// ── Scene: Singularity ─────────────────────────────────────────────────────────
// 2+ competitors accelerating simultaneously. Maximum strategic tension.
// Dual force nodes with tension filament. Ring count and burst intensity
// scale with accelerating count. Only the core pulse is fast — all else slow.

function SceneSingularity({ stats }: { stats: RadarStats }) {
  const accelCount = Math.max(2, stats.accelerating);
  const ringCount  = Math.min(accelCount + 2, 5);

  const rings = Array.from({ length: ringCount }, (_, i) => ({
    r:     8 + i * 10,
    color: i === 0 ? B.white : i === 1 ? B.red : i === 2 ? B.amber : B.green,
    speed: 1.5 + i * 0.65,
    delay: i * 0.38,
    sw:    1.2 - i * 0.14,
  }));

  const filaments = Array.from({ length: 10 }, (_, i) => ({
    angle:  (i / 10) * Math.PI * 2,
    length: 44 + pseudoRand(i * 3.7) * 24,
    color:  i % 3 === 0 ? B.red : i % 2 === 0 ? B.amber : B.green,
    speed:  2.0 + pseudoRand(i * 2.3) * 0.9,
    delay:  pseudoRand(i * 5.1) * 1.4,
  }));

  // Two opposing force nodes representing converging accelerators
  const nodeA = { cx: CX - 30, cy: CY - 7 };
  const nodeB = { cx: CX + 30, cy: CY + 7 };

  return (
    <g>
      <defs>
        <radialGradient id="sg-void" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#001a08" stopOpacity="0.65" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={CX} cy={CY} rx={92} ry={62} fill="url(#sg-void)" />

      {/* Tension filament between the two force nodes */}
      <motion.line
        x1={nodeA.cx} y1={nodeA.cy}
        x2={nodeB.cx} y2={nodeB.cy}
        stroke={B.amber}
        strokeWidth="0.75"
        strokeDasharray="3.5 4.5"
        animate={{ strokeOpacity: [0.12, 0.42, 0.12] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Radial burst filaments from center */}
      {filaments.map((f, i) => (
        <motion.line
          key={i}
          x1={CX} y1={CY}
          x2={CX + f.length * Math.cos(f.angle)}
          y2={CY + f.length * Math.sin(f.angle)}
          stroke={f.color}
          strokeWidth="0.65"
          animate={{ opacity: [0, 0.36, 0] }}
          transition={{ duration: f.speed, repeat: Infinity, delay: f.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Collapsing rings — centered between the two nodes */}
      {rings.map((ring, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY}
          r={ring.r}
          fill="none"
          stroke={ring.color}
          strokeWidth={ring.sw}
          animate={{
            r:       [ring.r, ring.r * 1.09, ring.r],
            opacity: [0.07, 0.40, 0.07],
          }}
          transition={{ duration: ring.speed, repeat: Infinity, delay: ring.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Force node halos */}
      {[nodeA, nodeB].map((n, i) => (
        <motion.circle
          key={`nh-${i}`}
          cx={n.cx} cy={n.cy} r={7}
          fill={B.red}
          animate={{ opacity: [0.05, 0.18, 0.05], r: [6, 8, 6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.50 }}
        />
      ))}
      {[nodeA, nodeB].map((n, i) => (
        <circle key={`np-${i}`} cx={n.cx} cy={n.cy} r={2.4} fill={B.white} opacity={0.82} />
      ))}

      {/* Core — the only fast element, encodes maximum urgency */}
      <motion.circle
        cx={CX} cy={CY} r={4.5}
        fill={B.white}
        animate={{ opacity: [0.55, 1.0, 0.55], r: [4.0, 5.5, 4.0] }}
        transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx={CX} cy={CY} r={11}
        fill={B.green}
        animate={{ opacity: [0.04, 0.17, 0.04] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
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

// ── HUD Signal Bar — animated fill + precise value label ──────────────────────

function SignalBar({
  value, max, color, label,
}: {
  value: number;
  max: number;
  color: string;
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
        background: "rgba(255,255,255,0.025)",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {/* Fill bar */}
        <motion.div
          animate={{ height: `${fillPct * 100}%` }}
          initial={{ height: 0 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            background: overflow
              ? `linear-gradient(to top, ${color}, ${color}99)`
              : `linear-gradient(to top, ${color}cc, ${color}44)`,
            borderRadius: 2,
            boxShadow: fillPct > 0.08 ? `0 0 7px ${color}3a` : "none",
          }}
        />
        {/* Value */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 11, fontWeight: 700, lineHeight: 1,
          color: fillPct > 0.28 ? "rgba(255,255,255,0.92)" : color,
          zIndex: 1,
        }}>
          {value}
        </div>
      </div>
      {/* Label */}
      <div style={{
        fontFamily: "monospace",
        fontSize: 6, letterSpacing: "0.16em",
        color: "rgba(255,255,255,0.26)",
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

  const derivedSceneId                    = deriveSceneId(radarStats);
  const [manualIdx, setManualIdx]         = useState<number | null>(null);

  // Reset manual override when live data changes tier
  useEffect(() => { setManualIdx(null); }, [derivedSceneId]);

  const effectiveIdx  = manualIdx !== null
    ? manualIdx
    : Math.max(0, SCENES.findIndex((s) => s.id === derivedSceneId));
  const scene         = SCENES[effectiveIdx];
  const statusColor   = STATUS_COLORS[scene.status];
  const bg            = SCENE_BG[scene.id];

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
        border: "1px solid rgba(255,255,255,0.06)",
        background: bg.tint,
        minHeight: 160,
      }}
    >
      {/* ── Sky canvas ──────────────────────────────────────────────────── */}
      <div
        style={{ position: "relative", lineHeight: 0, flex: 1, cursor: "pointer", minHeight: 112 }}
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
                <stop offset="50%"  stopColor="#000000" stopOpacity="0"    />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.68" />
              </radialGradient>
            </defs>

            {/* Sky base */}
            <rect width={W} height={H} fill={bg.sky} />

            {/* Scene content */}
            <SceneRenderer id={scene.id} stats={stats} />

            {/* Vignette */}
            <rect width={W} height={H} fill={`url(#vig-${scene.id})`} />

            {/* HUD corner brackets */}
            <g stroke="rgba(255,255,255,0.065)" strokeWidth="0.75" fill="none">
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
              fill="rgba(255,255,255,0.78)"
            >
              {scene.label}
            </text>

            {/* Status dot beside label */}
            <motion.circle
              cx={10 + scene.label.length * 4.85 + 6}
              cy={H - 19.5}
              r={2.2}
              fill={statusColor}
              animate={{ opacity: [0.65, 1.0, 0.65] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Rival count — top right */}
            <text
              x={W - 10} y={15}
              textAnchor="end" fontSize="6"
              fontFamily="monospace" letterSpacing="1.5"
              fill="rgba(255,255,255,0.26)"
            >
              {stats.total} RIVALS
            </text>
          </motion.svg>
        </AnimatePresence>

        {/* Inner frame depth */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 -18px 28px rgba(0,0,0,0.32)",
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
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Animated signal bars */}
          <div style={{ display: "flex", gap: 5, padding: "6px 8px 4px" }}>
            <SignalBar value={stats.accelerating} max={5}  color={B.red}   label="ACCEL"  />
            <SignalBar value={stats.rising}        max={10} color={B.amber} label="RISING" />
            <SignalBar value={stats.signals7d}     max={20} color={B.green} label="SIG/7D" />
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
                color: "rgba(255,255,255,0.24)",
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
                    width: i === effectiveIdx ? 10 : 3,
                    height: 3, borderRadius: 2,
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
