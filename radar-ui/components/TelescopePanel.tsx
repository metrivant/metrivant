"use client";

/**
 * TelescopePanel — Market Intelligence Visualiser
 *
 * Derives scene state from live radar data. The astronomical metaphor maps
 * directly to competitive field conditions: number of accelerating competitors,
 * signal density, and dominant movement type determine the visual state.
 *
 * No decorative randomness. Every state reflects a real data condition.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Radar stats passed from page.tsx ──────────────────────────────────────────

export type RadarStats = {
  total: number;
  accelerating: number;
  rising: number;
  signals7d: number;
  topMovement: string | null;
};

// ── Scene types ────────────────────────────────────────────────────────────────

type SceneId =
  | "starfield"
  | "constellation"
  | "spiral_galaxy"
  | "black_hole"
  | "singularity"
  | "rare_comet"
  | "binary_star"
  | "supernova"
  | "nebula"
  | "cosmic_calm";

type StatusLevel = "QUIET" | "MODERATE" | "ACTIVE" | "HIGH" | "CRITICAL";

const STATUS_COLORS: Record<StatusLevel, string> = {
  QUIET:    "#2EE6A6",
  MODERATE: "#57a6ff",
  ACTIVE:   "#F59E0B",
  HIGH:     "#F97316",
  CRITICAL: "#EF4444",
};

type Scene = {
  id: SceneId;
  label: string;
  status: StatusLevel;
};

const SCENES: Scene[] = [
  { id: "starfield",     label: "STARFIELD",     status: "QUIET"    },
  { id: "constellation", label: "CONSTELLATION", status: "MODERATE" },
  { id: "spiral_galaxy", label: "SPIRAL GALAXY", status: "ACTIVE"   },
  { id: "black_hole",    label: "BLACK HOLE",    status: "HIGH"     },
  { id: "singularity",   label: "SINGULARITY",   status: "CRITICAL" },
  { id: "rare_comet",    label: "RARE COMET",    status: "HIGH"     },
  { id: "binary_star",   label: "BINARY SYSTEM", status: "ACTIVE"   },
  { id: "supernova",     label: "SUPERNOVA",     status: "CRITICAL" },
  { id: "nebula",        label: "NEBULA",        status: "MODERATE" },
  { id: "cosmic_calm",   label: "COSMIC CALM",   status: "QUIET"    },
];

// ── Derive scene from live data ────────────────────────────────────────────────

function deriveSceneId(stats: RadarStats | undefined): SceneId {
  if (!stats || stats.total === 0) return "cosmic_calm";
  const { accelerating, rising, signals7d } = stats;
  if (accelerating >= 3) return "singularity";
  if (accelerating >= 2) return "supernova";
  if (accelerating >= 1) return "black_hole";
  if (rising >= 3) return "spiral_galaxy";
  if (rising >= 2) return "binary_star";
  if (signals7d >= 10) return "constellation";
  if (signals7d >= 3) return "nebula";
  if (signals7d > 0) return "rare_comet";
  return "starfield";
}

function deriveCaption(stats: RadarStats | undefined, scene: Scene): string {
  if (!stats || stats.total === 0) return "NO FIELD DATA";
  const parts: string[] = [];
  if (stats.accelerating > 0) parts.push(`${stats.accelerating} ACCEL`);
  if (stats.rising > 0) parts.push(`${stats.rising} RISING`);
  if (stats.signals7d > 0) parts.push(`${stats.signals7d} SIG/7D`);
  return parts.length > 0 ? parts.join(" · ") : scene.label.toLowerCase() + " — quiet field";
}

function formatMovement(m: string | null): string {
  if (!m) return "—";
  return m.replace(/_/g, " ").toUpperCase();
}

// ── Brand palette ──────────────────────────────────────────────────────────────
const B = {
  green:   "#2EE6A6",
  blue:    "#57a6ff",
  amber:   "#F59E0B",
  indigo:  "#6366F1",
  purple:  "#8B5CF6",
  red:     "#EF4444",
  orange:  "#F97316",
  white:   "#E2E8F0",
  skyA:    "#001208",
  skyB:    "#000a06",
  skyC:    "#020a08",
} as const;

const W = 240;
const H = 150;
const CX = W / 2;
const CY = H / 2;

function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453;
  return x - Math.floor(x);
}

// ── Scene components ───────────────────────────────────────────────────────────

function SceneStarfield() {
  const stars = Array.from({ length: 48 }, (_, i) => ({
    cx: pseudoRand(i * 7.1) * W,
    cy: pseudoRand(i * 3.7) * H,
    r: 0.6 + pseudoRand(i * 5.3) * 1.4,
    opacity: 0.35 + pseudoRand(i * 2.9) * 0.65,
    color: i % 4 === 0 ? B.green : B.white,
  }));
  return (
    <g>
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill={s.color}
          animate={{ opacity: [s.opacity * 0.6, s.opacity, s.opacity * 0.6] }}
          transition={{ duration: 2 + pseudoRand(i) * 4, repeat: Infinity, delay: pseudoRand(i * 11) * 3 }}
        />
      ))}
      <ellipse cx={CX} cy={CY} rx={90} ry={12} fill="rgba(46,230,166,0.04)" />
    </g>
  );
}

const CONST_STARS = [
  { cx: 48, cy: 38 }, { cx: 88, cy: 28 }, { cx: 132, cy: 42 },
  { cx: 170, cy: 34 }, { cx: 108, cy: 72 }, { cx: 72, cy: 98 },
  { cx: 148, cy: 95 }, { cx: 192, cy: 78 }, { cx: 60, cy: 128 },
  { cx: 128, cy: 122 }, { cx: 196, cy: 118 },
];
const CONST_LINES = [
  [0,1],[1,2],[2,3],[1,4],[4,5],[4,6],[6,7],[5,8],[8,9],[9,6],[6,10]
] as [number,number][];

function SceneConstellation() {
  return (
    <g>
      {CONST_LINES.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={CONST_STARS[a].cx} y1={CONST_STARS[a].cy}
          x2={CONST_STARS[b].cx} y2={CONST_STARS[b].cy}
          stroke={B.purple} strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0, 0.35, 0.28] }}
          transition={{ duration: 1.2, delay: i * 0.18 }}
        />
      ))}
      {CONST_STARS.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={i === 4 ? 2.8 : 1.8}
          fill={i === 4 ? B.amber : B.white}
          animate={{ opacity: [0.55, 1.0, 0.55] }}
          transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </g>
  );
}

function SceneSpiralGalaxy() {
  const armStars = Array.from({ length: 60 }, (_, i) => {
    const arm = i % 2;
    const t = (i / 30) * Math.PI * 3;
    const r = 8 + t * 14;
    const baseAngle = arm === 0 ? t : t + Math.PI;
    const spread = (pseudoRand(i * 4.1) - 0.5) * 14;
    const angle = baseAngle + spread * 0.04;
    return {
      cx: CX + r * Math.cos(angle) + (pseudoRand(i * 2.3) - 0.5) * spread,
      cy: CY + r * Math.sin(angle) * 0.45 + (pseudoRand(i * 5.7) - 0.5) * spread * 0.45,
      r: 0.5 + pseudoRand(i * 3.1) * 1.1,
      color: i % 6 === 0 ? B.amber : i % 4 === 0 ? B.green : B.purple,
      opacity: 0.4 + pseudoRand(i * 1.7) * 0.6,
    };
  });
  return (
    <g>
      <defs>
        <radialGradient id="tgal" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor={B.green} stopOpacity="0.30" />
          <stop offset="60%" stopColor={B.indigo} stopOpacity="0.10" />
          <stop offset="100%" stopColor={B.indigo} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={40} fill="url(#tgal)" />
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {armStars.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.color} opacity={s.opacity} />
        ))}
      </motion.g>
      <circle cx={CX} cy={CY} r={4} fill={B.amber} opacity={0.9} />
    </g>
  );
}

function SceneBlackHole() {
  const orbiting = Array.from({ length: 18 }, (_, i) => ({
    angle: (i / 18) * Math.PI * 2,
    r: 35 + pseudoRand(i * 6.2) * 22,
    size: 0.7 + pseudoRand(i * 2.9) * 1.1,
    color: i % 3 === 0 ? B.orange : i % 2 === 0 ? B.blue : B.white,
  }));
  return (
    <g>
      <defs>
        <radialGradient id="tbh" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="1.0" />
          <stop offset="38%" stopColor="#001a0a" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#002818" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[62, 52, 44, 36].map((r, i) => (
        <motion.ellipse
          key={i}
          cx={CX} cy={CY} rx={r} ry={r * 0.30}
          fill="none" stroke={B.indigo}
          strokeWidth={0.6 - i * 0.1} strokeOpacity={0.22 - i * 0.04}
          animate={{ rotate: [0, i % 2 === 0 ? 360 : -360] }}
          transition={{ duration: 18 + i * 6, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {orbiting.map((s, i) => (
          <circle
            key={i}
            cx={CX + s.r * Math.cos(s.angle)}
            cy={CY + s.r * Math.sin(s.angle) * 0.30}
            r={s.size}
            fill={s.color}
            opacity={0.55 + pseudoRand(i) * 0.45}
          />
        ))}
      </motion.g>
      <circle cx={CX} cy={CY} r={22} fill="url(#tbh)" />
    </g>
  );
}

function SceneSingularity() {
  const rays = Array.from({ length: 12 }, (_, i) => ({
    x2: CX + 58 * Math.cos((i / 12) * Math.PI * 2),
    y2: CY + 58 * Math.sin((i / 12) * Math.PI * 2),
  }));
  return (
    <g>
      {rays.map((r, i) => (
        <motion.line
          key={i}
          x1={CX} y1={CY} x2={r.x2} y2={r.y2}
          stroke={i % 3 === 0 ? B.amber : i % 2 === 0 ? B.red : B.blue}
          strokeWidth="0.8"
          animate={{ opacity: [0.0, 0.42, 0.0], scaleX: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4 + pseudoRand(i * 3) * 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      {[42, 28, 16, 8].map((r, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY} r={r} fill="none"
          stroke={i === 0 ? B.red : i === 1 ? B.indigo : B.amber}
          strokeWidth={0.8 - i * 0.15}
          animate={{ opacity: [0.08, 0.35, 0.08], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      <motion.circle
        cx={CX} cy={CY} r={5} fill="#FFFFFF"
        animate={{ opacity: [0.7, 1.0, 0.7] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

function SceneRareComet() {
  return (
    <g>
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i}
          cx={pseudoRand(i * 7.3) * W} cy={pseudoRand(i * 4.1) * H}
          r={0.5 + pseudoRand(i * 2.2) * 0.8} fill={B.white}
          opacity={0.25 + pseudoRand(i * 6.1) * 0.45} />
      ))}
      <motion.g
        initial={{ x: -80, y: -60 }}
        animate={{ x: 220, y: 160 }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeIn", repeatDelay: 4 }}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={40 + i * -6} cy={36 + i * -5}
            r={1.0 + i * 0.5} fill={B.blue} opacity={Math.max(0, 0.6 - i * 0.08)} />
        ))}
        <circle cx={48} cy={44} r={6} fill="#FFFFFF" opacity={0.15} />
        <circle cx={48} cy={44} r={3.5} fill="#FFFFFF" opacity={0.95} />
        <circle cx={48} cy={44} r={1.5} fill={B.amber} opacity={0.88} />
      </motion.g>
      <motion.line
        x1={0} y1={0} x2={240} y2={150}
        stroke={B.blue} strokeWidth="0.4"
        animate={{ opacity: [0, 0.12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
      />
    </g>
  );
}

function SceneBinaryStar() {
  return (
    <g>
      {Array.from({ length: 20 }, (_, i) => (
        <circle key={i}
          cx={pseudoRand(i * 8.1) * W} cy={pseudoRand(i * 3.3) * H}
          r={0.5 + pseudoRand(i * 2.7) * 0.8} fill={B.white}
          opacity={0.22 + pseudoRand(i * 5.5) * 0.35} />
      ))}
      <ellipse cx={CX} cy={CY} rx={46} ry={22}
        fill="none" stroke="rgba(99,102,241,0.18)" strokeWidth="0.8" strokeDasharray="4 6" />
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <circle cx={CX + 46} cy={CY} r={14} fill={B.orange} opacity={0.12} />
        <circle cx={CX + 46} cy={CY} r={7}  fill={B.orange} opacity={0.18} />
        <circle cx={CX + 46} cy={CY} r={5}  fill={B.amber}  opacity={0.9} />
      </motion.g>
      <motion.g
        animate={{ rotate: [180, 540] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <circle cx={CX + 46} cy={CY} r={12} fill={B.blue}  opacity={0.10} />
        <circle cx={CX + 46} cy={CY} r={6}  fill={B.blue}  opacity={0.16} />
        <circle cx={CX + 46} cy={CY} r={4}  fill={B.white} opacity={0.85} />
      </motion.g>
      <circle cx={CX} cy={CY} r={1.5} fill="rgba(255,255,255,0.25)" />
    </g>
  );
}

function SceneSupernova() {
  return (
    <g>
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i}
          cx={pseudoRand(i * 9.3) * W} cy={pseudoRand(i * 4.7) * H}
          r={0.5 + pseudoRand(i * 3.1) * 0.8} fill={B.white}
          opacity={0.20 + pseudoRand(i * 7.3) * 0.35} />
      ))}
      {[0, 0.4, 0.75].map((delay, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY} r={12} fill="none"
          stroke={i === 0 ? B.amber : i === 1 ? B.orange : B.red}
          strokeWidth={2.4 - i * 0.5}
          animate={{ r: [12, 70], opacity: [0.7, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay }}
        />
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <motion.circle
            key={i}
            cx={CX} cy={CY}
            r={1.0 + pseudoRand(i * 2) * 0.8}
            fill={i % 3 === 0 ? B.amber : i % 2 === 0 ? B.orange : B.red}
            animate={{
              cx: [CX, CX + 52 * Math.cos(angle)],
              cy: [CY, CY + 52 * Math.sin(angle)],
              opacity: [0.9, 0],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay: (i * 0.06) % 0.8 }}
          />
        );
      })}
      <motion.circle
        cx={CX} cy={CY} r={6} fill="#FFFFFF"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

function SceneNebula() {
  const clouds = [
    { cx: CX - 28, cy: CY - 12, rx: 55, ry: 30, color: B.purple, opacity: 0.13 },
    { cx: CX + 24, cy: CY + 14, rx: 44, ry: 28, color: B.red,    opacity: 0.10 },
    { cx: CX - 10, cy: CY + 8,  rx: 38, ry: 22, color: B.green,  opacity: 0.08 },
    { cx: CX + 10, cy: CY - 20, rx: 30, ry: 18, color: B.blue,   opacity: 0.09 },
  ];
  return (
    <g>
      {clouds.map((c, i) => (
        <motion.ellipse
          key={i}
          cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry}
          fill={c.color} fillOpacity={c.opacity}
          animate={{ opacity: [c.opacity * 0.6, c.opacity * 1.0, c.opacity * 0.6] }}
          transition={{ duration: 5 + i * 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.9 }}
        />
      ))}
      {Array.from({ length: 28 }, (_, i) => ({
        cx: CX + (pseudoRand(i * 5.1) - 0.5) * 90,
        cy: CY + (pseudoRand(i * 3.7) - 0.5) * 60,
        r:  0.6 + pseudoRand(i * 2.3) * 1.2,
        color: i % 5 === 0 ? B.amber : i % 3 === 0 ? B.orange : B.white,
        opacity: 0.45 + pseudoRand(i * 7.9) * 0.55,
      })).map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r} fill={s.color}
          animate={{ opacity: [s.opacity * 0.5, s.opacity, s.opacity * 0.5] }}
          transition={{ duration: 2 + pseudoRand(i * 4) * 3, repeat: Infinity, delay: pseudoRand(i * 11) * 4 }}
        />
      ))}
    </g>
  );
}

function SceneCosmicCalm() {
  const stars = Array.from({ length: 14 }, (_, i) => ({
    cx: pseudoRand(i * 11.3) * W,
    cy: pseudoRand(i * 6.7) * H,
    r: 0.5 + pseudoRand(i * 4.1) * 1.0,
    opacity: 0.18 + pseudoRand(i * 3.1) * 0.38,
    color: i % 4 === 0 ? B.blue : B.white,
  }));
  return (
    <g>
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r} fill={s.color}
          animate={{ opacity: [s.opacity * 0.4, s.opacity, s.opacity * 0.4] }}
          transition={{ duration: 6 + pseudoRand(i * 9) * 8, repeat: Infinity, delay: pseudoRand(i * 7) * 6 }}
        />
      ))}
      <ellipse cx={CX + 52} cy={CY - 24} rx={18} ry={6}
        fill="rgba(99,102,241,0.08)" transform="rotate(-22, 172, 51)" />
      <ellipse cx={CX - 58} cy={CY + 28} rx={12} ry={4}
        fill="rgba(87,166,255,0.06)" transform="rotate(14, 62, 103)" />
    </g>
  );
}

function SceneRenderer({ id }: { id: SceneId }) {
  switch (id) {
    case "starfield":     return <SceneStarfield />;
    case "constellation": return <SceneConstellation />;
    case "spiral_galaxy": return <SceneSpiralGalaxy />;
    case "black_hole":    return <SceneBlackHole />;
    case "singularity":   return <SceneSingularity />;
    case "rare_comet":    return <SceneRareComet />;
    case "binary_star":   return <SceneBinaryStar />;
    case "supernova":     return <SceneSupernova />;
    case "nebula":        return <SceneNebula />;
    case "cosmic_calm":   return <SceneCosmicCalm />;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TelescopePanel({ radarStats }: { radarStats?: RadarStats }) {
  const derivedSceneId = deriveSceneId(radarStats);
  const [manualIdx, setManualIdx] = useState<number | null>(null);

  // When the derived scene changes (data update), reset manual override
  useEffect(() => {
    setManualIdx(null);
  }, [derivedSceneId]);

  const sceneIdx = manualIdx !== null
    ? manualIdx
    : SCENES.findIndex((s) => s.id === derivedSceneId);

  const effectiveIdx = sceneIdx >= 0 ? sceneIdx : 0;
  const scene = SCENES[effectiveIdx];
  const caption = deriveCaption(radarStats, scene);
  const statusColor = STATUS_COLORS[scene.status];

  const advance = useCallback(() => {
    setManualIdx((i) => ((i !== null ? i : effectiveIdx) + 1) % SCENES.length);
  }, [effectiveIdx]);

  const jumpTo = useCallback((idx: number) => {
    setManualIdx(idx);
  }, []);

  // ── No data yet — minimal "awaiting field data" state ──────────────────────
  if (!radarStats || radarStats.total === 0) {
    return (
      <div
        className="flex h-full flex-col select-none"
        style={{
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          background: B.skyC,
          cursor: "pointer",
          minHeight: 140,
        }}
        onClick={advance}
      >
        <div style={{ position: "relative", lineHeight: 0, flex: 1 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block", position: "absolute", inset: 0 }} aria-hidden>
            <defs>
              <radialGradient id="tsky-init" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor={B.skyA} stopOpacity="1" />
                <stop offset="100%" stopColor={B.skyC} stopOpacity="1" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#tsky-init)" />
            {Array.from({ length: 22 }, (_, i) => (
              <circle key={i}
                cx={pseudoRand(i * 7.3) * W} cy={pseudoRand(i * 4.1) * H}
                r={0.5 + pseudoRand(i * 2.2) * 0.9} fill={B.white}
                opacity={0.08 + pseudoRand(i * 6.1) * 0.15} />
            ))}
            <g stroke="rgba(46,230,166,0.15)" strokeWidth="0.8" fill="none">
              <polyline points="10,22 10,10 22,10" />
              <polyline points={`${W-22},10 ${W-10},10 ${W-10},22`} />
              <polyline points={`10,${H-22} 10,${H-10} 22,${H-10}`} />
              <polyline points={`${W-22},${H-10} ${W-10},${H-10} ${W-10},${H-22}`} />
            </g>
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="8" fontFamily="monospace"
              letterSpacing="2.5" fill="rgba(46,230,166,0.35)">AWAITING FIELD DATA</text>
          </svg>
        </div>
        <div style={{ padding: "5px 10px 6px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 7, fontFamily: "monospace", letterSpacing: "0.18em", color: "rgba(46,230,166,0.20)" }}>
            TELESCOPE · NO COMPETITORS TRACKED
          </span>
        </div>
      </div>
    );
  }

  // ── Active observation view ────────────────────────────────────────────────
  return (
    <div
      className="flex h-full flex-col select-none"
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#050010",
        minHeight: 140,
      }}
    >
      {/* Sky canvas — fills remaining space */}
      <div
        style={{ position: "relative", lineHeight: 0, flex: 1, cursor: "pointer", minHeight: 120 }}
        onClick={advance}
      >
        <AnimatePresence mode="wait">
          <motion.svg
            key={scene.id}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            style={{ display: "block", position: "absolute", inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.40, ease: "easeInOut" }}
            aria-hidden
          >
            <defs>
              <radialGradient id={`tsky-${scene.id}`} cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor={B.skyA} stopOpacity="1" />
                <stop offset="60%" stopColor={B.skyB} stopOpacity="1" />
                <stop offset="100%" stopColor={B.skyC} stopOpacity="1" />
              </radialGradient>
              <filter id={`hud-glow-${scene.id}`} x="-10%" y="-80%" width="120%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id={`tvign-${scene.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
              </radialGradient>
            </defs>

            <rect width={W} height={H} fill={`url(#tsky-${scene.id})`} />
            <SceneRenderer id={scene.id} />
            <rect width={W} height={H} fill={`url(#tvign-${scene.id})`} />

            {/* HUD corner brackets */}
            <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none">
              <polyline points="8,20 8,8 20,8" />
              <polyline points={`${W-20},8 ${W-8},8 ${W-8},20`} />
              <polyline points={`8,${H-20} 8,${H-8} 20,${H-8}`} />
              <polyline points={`${W-20},${H-8} ${W-8},${H-8} ${W-8},${H-20}`} />
            </g>

            {/* In-scene HUD — bottom-left: scene label + live data caption */}
            <g filter={`url(#hud-glow-${scene.id})`}>
              <text x={10} y={H - 18} fontSize="7.5" fontWeight="bold" fontFamily="monospace"
                letterSpacing="2" fill="rgba(255,255,255,0.88)">
                {scene.label}
              </text>
              <text x={10} y={H - 8} fontSize="5.8" fontFamily="monospace"
                letterSpacing="1.2" fill={`${statusColor}CC`}>
                {caption}
              </text>
            </g>

            {/* Top-right: competitor count */}
            <text x={W - 10} y={16} textAnchor="end" fontSize="6" fontFamily="monospace"
              letterSpacing="1.5" fill="rgba(255,255,255,0.30)">
              {radarStats.total} RIVALS
            </text>
          </motion.svg>
        </AnimatePresence>

        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)", pointerEvents: "none",
        }} />
      </div>

      {/* Data readout — fills the space that was previously empty */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`data-${scene.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.30 }}
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Metrics row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 0,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            {[
              { label: "ACCEL", value: radarStats.accelerating, color: radarStats.accelerating > 0 ? "#EF4444" : "rgba(255,255,255,0.25)" },
              { label: "RISING", value: radarStats.rising, color: radarStats.rising > 0 ? "#F59E0B" : "rgba(255,255,255,0.25)" },
              { label: "SIG/7D", value: radarStats.signals7d, color: radarStats.signals7d > 0 ? "#57a6ff" : "rgba(255,255,255,0.25)" },
            ].map(({ label, value, color }, i) => (
              <div
                key={i}
                style={{
                  padding: "5px 0 5px",
                  textAlign: "center",
                  borderRight: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color, lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 6, fontFamily: "monospace", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", marginTop: 2 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 9px 5px" }}>
            <span style={{
              fontSize: 6.5, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.16em",
              color: statusColor, padding: "1px 5px", borderRadius: 3,
              background: `${statusColor}14`, border: `1px solid ${statusColor}30`,
            }}>
              {scene.status}
            </span>

            {/* Top movement (if any) */}
            {radarStats.topMovement && (
              <span style={{ fontSize: 6, fontFamily: "monospace", letterSpacing: "0.12em", color: "rgba(255,255,255,0.28)" }}>
                {formatMovement(radarStats.topMovement).slice(0, 18)}
              </span>
            )}

            {/* Progress dots */}
            <div style={{ display: "flex", alignItems: "center", gap: 2.5 }}>
              {SCENES.map((s, i) => (
                <div
                  key={s.id}
                  onClick={(e) => { e.stopPropagation(); jumpTo(i); }}
                  style={{
                    width: i === effectiveIdx ? 9 : 2.5,
                    height: 2.5,
                    borderRadius: 2,
                    background: i === effectiveIdx ? statusColor : "rgba(255,255,255,0.14)",
                    transition: "all 0.35s ease",
                    cursor: "pointer",
                    flexShrink: 0,
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
