"use client";

/**
 * TelescopePanel — Astronomical Visual Slides
 *
 * Cycles through 10 stylized cosmic scenes representing competitive environments.
 * Pure decorative frontend rendering. No signal data. No API calls.
 * Scene changes every 10–20 seconds with smooth opacity crossfade.
 *
 * Color palette: vivid, surreal — Simpsons-sky purples + Courage-cartoon cosmic tones.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

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

type Scene = {
  id: SceneId;
  label: string;
  caption: string;
};

const SCENES: Scene[] = [
  { id: "starfield",     label: "Starfield",          caption: "baseline observation state"   },
  { id: "constellation", label: "Constellation",       caption: "signals forming patterns"     },
  { id: "spiral_galaxy", label: "Spiral Galaxy",       caption: "dense signal environment"     },
  { id: "black_hole",    label: "Black Hole",          caption: "dominant competitive gravity"  },
  { id: "singularity",   label: "Singularity",         caption: "rare intense activity"         },
  { id: "rare_comet",    label: "Rare Comet",          caption: "rapid burst of activity"       },
  { id: "binary_star",   label: "Binary System",       caption: "competitive tension"           },
  { id: "supernova",     label: "Supernova",           caption: "dramatic market event"         },
  { id: "nebula",        label: "Nebula",              caption: "slow emerging trend"           },
  { id: "cosmic_calm",   label: "Cosmic Calm",         caption: "quiet competitive environment" },
];

// Rotation: 10–20 seconds per scene (randomised per interval)
function nextDelay(): number {
  return 10_000 + Math.random() * 10_000;
}

// ── SVG scene components ───────────────────────────────────────────────────────
// All scenes use viewBox="0 0 240 150". Colors from vivid cosmic palette.
// Animations use CSS @keyframes via inline styles where possible, else Framer Motion.

const W = 240;
const H = 150;
const CX = W / 2;
const CY = H / 2;

// Deterministic pseudo-random float from seed
function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453;
  return x - Math.floor(x);
}

// ── 1. Starfield ──────────────────────────────────────────────────────────────
function SceneStarfield() {
  const stars = Array.from({ length: 48 }, (_, i) => ({
    cx: pseudoRand(i * 7.1) * W,
    cy: pseudoRand(i * 3.7) * H,
    r: 0.6 + pseudoRand(i * 5.3) * 1.4,
    opacity: 0.35 + pseudoRand(i * 2.9) * 0.65,
    color: i % 7 === 0 ? "#FFD700" : i % 5 === 0 ? "#FF9F2E" : i % 4 === 0 ? "#7DF9FF" : "#FFF5E0",
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
      {/* Milky Way dusting */}
      <ellipse cx={CX} cy={CY} rx={90} ry={12} fill="rgba(180,160,255,0.05)" />
    </g>
  );
}

// ── 2. Constellation ──────────────────────────────────────────────────────────
const CONST_STARS = [
  { cx: 48,  cy: 38  }, { cx: 88,  cy: 28  }, { cx: 132, cy: 42  },
  { cx: 170, cy: 34  }, { cx: 108, cy: 72  }, { cx: 72,  cy: 98  },
  { cx: 148, cy: 95  }, { cx: 192, cy: 78  }, { cx: 60,  cy: 128 },
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
          stroke="#C084FC" strokeWidth="0.7" strokeOpacity="0"
          animate={{ strokeOpacity: [0, 0.35, 0.28] }}
          transition={{ duration: 1.2, delay: i * 0.18 }}
        />
      ))}
      {CONST_STARS.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={i === 4 ? 2.8 : 1.8}
          fill={i === 4 ? "#FFD700" : "#FFF5E0"}
          animate={{ opacity: [0.55, 1.0, 0.55] }}
          transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </g>
  );
}

// ── 3. Spiral Galaxy ──────────────────────────────────────────────────────────
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
      color: i % 6 === 0 ? "#FF9F2E" : i % 4 === 0 ? "#7DF9FF" : "#C084FC",
      opacity: 0.4 + pseudoRand(i * 1.7) * 0.6,
    };
  });
  return (
    <g>
      <radialGradient id="tgal" cx="50%" cy="50%" r="40%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.35" />
        <stop offset="60%" stopColor="#9B45FF" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#9B45FF" stopOpacity="0" />
      </radialGradient>
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
      <circle cx={CX} cy={CY} r={4} fill="#FFD700" opacity={0.9} />
    </g>
  );
}

// ── 4. Black Hole ─────────────────────────────────────────────────────────────
function SceneBlackHole() {
  const orbiting = Array.from({ length: 18 }, (_, i) => ({
    angle: (i / 18) * Math.PI * 2,
    r: 35 + pseudoRand(i * 6.2) * 22,
    size: 0.7 + pseudoRand(i * 2.9) * 1.1,
    color: i % 3 === 0 ? "#FF9F2E" : i % 2 === 0 ? "#7DF9FF" : "#FFF5E0",
  }));
  return (
    <g>
      <defs>
        <radialGradient id="tbh" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#000000" stopOpacity="1.0" />
          <stop offset="38%"  stopColor="#1a0020" stopOpacity="0.95" />
          <stop offset="65%"  stopColor="#3D0066" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Gravitational rings */}
      {[62, 52, 44, 36].map((r, i) => (
        <motion.ellipse
          key={i}
          cx={CX} cy={CY} rx={r} ry={r * 0.30}
          fill="none"
          stroke="#9B45FF"
          strokeWidth={0.6 - i * 0.1}
          strokeOpacity={0.22 - i * 0.04}
          animate={{ rotate: [0, i % 2 === 0 ? 360 : -360] }}
          transition={{ duration: 18 + i * 6, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      {/* Accretion disk stars */}
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
      {/* Event horizon */}
      <circle cx={CX} cy={CY} r={22} fill="url(#tbh)" />
    </g>
  );
}

// ── 5. Singularity ────────────────────────────────────────────────────────────
function SceneSingularity() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return {
      x2: CX + 58 * Math.cos(angle),
      y2: CY + 58 * Math.sin(angle),
    };
  });
  return (
    <g>
      {/* Energy rays */}
      {rays.map((r, i) => (
        <motion.line
          key={i}
          x1={CX} y1={CY}
          x2={r.x2} y2={r.y2}
          stroke={i % 3 === 0 ? "#FFD700" : i % 2 === 0 ? "#FF45CE" : "#7DF9FF"}
          strokeWidth="0.8"
          animate={{ opacity: [0.0, 0.42, 0.0], scaleX: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.4 + pseudoRand(i * 3) * 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      {/* Compression rings */}
      {[42, 28, 16, 8].map((r, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY} r={r}
          fill="none"
          stroke={i === 0 ? "#FF45CE" : i === 1 ? "#9B45FF" : "#FFD700"}
          strokeWidth={0.8 - i * 0.15}
          animate={{ opacity: [0.08, 0.35, 0.08], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      ))}
      {/* Core */}
      <motion.circle
        cx={CX} cy={CY} r={5}
        fill="#FFFFFF"
        animate={{ opacity: [0.7, 1.0, 0.7] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

// ── 6. Rare Comet ─────────────────────────────────────────────────────────────
function SceneRareComet() {
  // Comet path: enters top-left, exits bottom-right
  const tailStops = Array.from({ length: 8 }, (_, i) => ({
    x: 40 + i * -6,
    y: 36 + i * -5,
    r: 1.0 + i * 0.5,
    opacity: Math.max(0, 0.6 - i * 0.08),
  }));
  return (
    <g>
      {/* Background sparse stars */}
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          key={i}
          cx={pseudoRand(i * 7.3) * W}
          cy={pseudoRand(i * 4.1) * H}
          r={0.5 + pseudoRand(i * 2.2) * 0.8}
          fill="#FFF5E0"
          opacity={0.25 + pseudoRand(i * 6.1) * 0.45}
        />
      ))}
      {/* Comet body + tail */}
      <motion.g
        initial={{ x: -80, y: -60 }}
        animate={{ x: 220, y: 160 }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeIn", repeatDelay: 4 }}
      >
        {/* Tail segments */}
        {tailStops.map((t, i) => (
          <circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#7DF9FF" opacity={t.opacity} />
        ))}
        {/* Coma (diffuse halo) */}
        <circle cx={48} cy={44} r={6} fill="#FFFFFF" opacity={0.15} />
        {/* Nucleus */}
        <circle cx={48} cy={44} r={3.5} fill="#FFFFFF" opacity={0.95} />
        <circle cx={48} cy={44} r={1.5} fill="#FFD700" opacity={0.88} />
      </motion.g>
      {/* Faint streak */}
      <motion.line
        x1={0} y1={0} x2={240} y2={150}
        stroke="#7DF9FF" strokeWidth="0.4"
        animate={{ opacity: [0, 0.12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
      />
    </g>
  );
}

// ── 7. Binary Star System ─────────────────────────────────────────────────────
function SceneBinaryStar() {
  return (
    <g>
      {/* Background sparse stars */}
      {Array.from({ length: 20 }, (_, i) => (
        <circle
          key={i}
          cx={pseudoRand(i * 8.1) * W}
          cy={pseudoRand(i * 3.3) * H}
          r={0.5 + pseudoRand(i * 2.7) * 0.8}
          fill="#FFF5E0"
          opacity={0.22 + pseudoRand(i * 5.5) * 0.35}
        />
      ))}
      {/* Orbital ellipse */}
      <ellipse cx={CX} cy={CY} rx={46} ry={22}
        fill="none" stroke="rgba(129,140,248,0.18)" strokeWidth="0.8" strokeDasharray="4 6" />
      {/* Star A — orbital motion */}
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        {/* Glow */}
        <circle cx={CX + 46} cy={CY} r={14} fill="#FFB347" opacity={0.12} />
        <circle cx={CX + 46} cy={CY} r={7}  fill="#FFB347" opacity={0.18} />
        <circle cx={CX + 46} cy={CY} r={5}  fill="#FFD700" opacity={0.9}  />
      </motion.g>
      {/* Star B — opposite phase */}
      <motion.g
        animate={{ rotate: [180, 540] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <circle cx={CX + 46} cy={CY} r={12} fill="#7DF9FF" opacity={0.10} />
        <circle cx={CX + 46} cy={CY} r={6}  fill="#7DF9FF" opacity={0.16} />
        <circle cx={CX + 46} cy={CY} r={4}  fill="#DDEEFF" opacity={0.85} />
      </motion.g>
      {/* Center of mass */}
      <circle cx={CX} cy={CY} r={1.5} fill="rgba(255,255,255,0.25)" />
    </g>
  );
}

// ── 8. Supernova ──────────────────────────────────────────────────────────────
function SceneSupernova() {
  return (
    <g>
      {/* Background stars */}
      {Array.from({ length: 18 }, (_, i) => (
        <circle
          key={i}
          cx={pseudoRand(i * 9.3) * W}
          cy={pseudoRand(i * 4.7) * H}
          r={0.5 + pseudoRand(i * 3.1) * 0.8}
          fill="#FFF5E0"
          opacity={0.20 + pseudoRand(i * 7.3) * 0.35}
        />
      ))}
      {/* Expanding shockwave rings */}
      {[0, 0.4, 0.75].map((delay, i) => (
        <motion.circle
          key={i}
          cx={CX} cy={CY} r={12}
          fill="none"
          stroke={i === 0 ? "#FFB347" : i === 1 ? "#FF6B35" : "#FF45CE"}
          strokeWidth={2.4 - i * 0.5}
          animate={{ r: [12, 70], opacity: [0.7, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay }}
        />
      ))}
      {/* Ejecta fragments */}
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <motion.circle
            key={i}
            cx={CX} cy={CY}
            r={1.0 + pseudoRand(i * 2) * 0.8}
            fill={i % 3 === 0 ? "#FFD700" : i % 2 === 0 ? "#FF9F2E" : "#FF45CE"}
            animate={{
              cx: [CX, CX + 52 * Math.cos(angle)],
              cy: [CY, CY + 52 * Math.sin(angle)],
              opacity: [0.9, 0],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay: (i * 0.06) % 0.8 }}
          />
        );
      })}
      {/* Core remnant */}
      <motion.circle
        cx={CX} cy={CY} r={6}
        fill="#FFFFFF"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

// ── 9. Nebula ─────────────────────────────────────────────────────────────────
function SceneNebula() {
  const clouds = [
    { cx: CX - 28, cy: CY - 12, rx: 55, ry: 30, color: "#9B45FF", opacity: 0.13 },
    { cx: CX + 24, cy: CY + 14, rx: 44, ry: 28, color: "#FF45CE", opacity: 0.10 },
    { cx: CX - 10, cy: CY + 8,  rx: 38, ry: 22, color: "#45FFCE", opacity: 0.08 },
    { cx: CX + 10, cy: CY - 20, rx: 30, ry: 18, color: "#7DF9FF", opacity: 0.09 },
  ];
  const embeddedStars = Array.from({ length: 28 }, (_, i) => ({
    cx: CX + (pseudoRand(i * 5.1) - 0.5) * 90,
    cy: CY + (pseudoRand(i * 3.7) - 0.5) * 60,
    r:  0.6 + pseudoRand(i * 2.3) * 1.2,
    color: i % 5 === 0 ? "#FFD700" : i % 3 === 0 ? "#FF9F2E" : "#FFF5E0",
    opacity: 0.45 + pseudoRand(i * 7.9) * 0.55,
  }));
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
      {embeddedStars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill={s.color}
          animate={{ opacity: [s.opacity * 0.5, s.opacity, s.opacity * 0.5] }}
          transition={{ duration: 2 + pseudoRand(i * 4) * 3, repeat: Infinity, delay: pseudoRand(i * 11) * 4 }}
        />
      ))}
    </g>
  );
}

// ── 10. Cosmic Calm ───────────────────────────────────────────────────────────
function SceneCosmicCalm() {
  const stars = Array.from({ length: 14 }, (_, i) => ({
    cx: pseudoRand(i * 11.3) * W,
    cy: pseudoRand(i * 6.7) * H,
    r: 0.5 + pseudoRand(i * 4.1) * 1.0,
    opacity: 0.18 + pseudoRand(i * 3.1) * 0.38,
    color: i % 4 === 0 ? "#7DF9FF" : "#FFF5E0",
  }));
  return (
    <g>
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill={s.color}
          animate={{ opacity: [s.opacity * 0.4, s.opacity, s.opacity * 0.4] }}
          transition={{ duration: 6 + pseudoRand(i * 9) * 8, repeat: Infinity, delay: pseudoRand(i * 7) * 6 }}
        />
      ))}
      {/* Faint distant galaxy */}
      <ellipse cx={CX + 52} cy={CY - 24} rx={18} ry={6}
        fill="rgba(192,132,252,0.08)" transform="rotate(-22, 172, 51)" />
      <ellipse cx={CX - 58} cy={CY + 28} rx={12} ry={4}
        fill="rgba(125,249,255,0.06)" transform="rotate(14, 62, 103)" />
    </g>
  );
}

// ── Scene renderer ─────────────────────────────────────────────────────────────

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

export default function TelescopePanel() {
  const [idx, setIdx]       = useState(0);
  const [visible, setVisible] = useState(true);

  const advance = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setIdx((i) => (i + 1) % SCENES.length);
      setVisible(true);
    }, 400);
  }, []);

  // Auto-rotation: 10–20 seconds per scene
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      timer = setTimeout(() => {
        advance();
        schedule();
      }, nextDelay());
    }
    schedule();
    return () => clearTimeout(timer);
  }, [advance]);

  const scene = SCENES[idx];

  return (
    <div
      className="select-none"
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#050010",
        cursor: "pointer",
      }}
      onClick={advance}
      title="Click to advance scene"
    >
      {/* Sky canvas */}
      <div style={{ position: "relative", lineHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.svg
            key={scene.id}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: "block" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.40, ease: "easeInOut" }}
            aria-hidden
          >
            {/* Sky background */}
            <defs>
              <radialGradient id={`tsky-${scene.id}`} cx="50%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#1a0533" stopOpacity="1" />
                <stop offset="60%"  stopColor="#0d0020" stopOpacity="1" />
                <stop offset="100%" stopColor="#050010" stopOpacity="1" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill={`url(#tsky-${scene.id})`} />
            <SceneRenderer id={scene.id} />
            {/* Vignette edge */}
            <radialGradient id={`tvign-${scene.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
            </radialGradient>
            <rect width={W} height={H} fill={`url(#tvign-${scene.id})`} />
          </motion.svg>
        </AnimatePresence>

        {/* Eyepiece circle overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 10,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Scene label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`label-${scene.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.30 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px 6px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(192,132,252,0.70)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {scene.label}
          </span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.24)", fontFamily: "monospace" }}>
            {scene.caption}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
