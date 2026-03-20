"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";

// ── Pipeline stages — 1-to-1 with the real Metrivant detection pipeline ────────

const STAGES = [
  { label: "COMPETITORS", desc: "Active rivals registered for continuous surveillance"   },
  { label: "PAGES",       desc: "High-value URLs scheduled for periodic crawls"           },
  { label: "SNAPSHOTS",   desc: "Full page content captured and sectioned each run"       },
  { label: "DIFFS",       desc: "Sections compared against stable baselines"              },
  { label: "SIGNALS",     desc: "Changes confidence-gated and classified by type"         },
  { label: "MOVEMENTS",   desc: "Signal clusters synthesised into strategic moves"        },
  { label: "RADAR",       desc: "Intelligence converges into the live radar field"        },
] as const;

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN     = "#2EE6A6";
const GREEN_VEC = new THREE.Color(GREEN);
const N         = STAGES.length;       // 7
const SPACING   = 1.3;
const NODE_X    = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * SPACING);

const PARTICLE_COUNT = 22;
const DT_PER_SEC     = (N - 1) / 10;  // traverse full pipeline in 10 s

// ── 2D Pipeline Schematic (SVG) ───────────────────────────────────────────────
// Looks like a real pipe diagram: rectangular pipe segments + circular junctions.

const SCHEMATIC_VB_W  = 800;
const SCHEMATIC_VB_H  = 72;
const NODE_CY         = 28;
const NODE_R_NORMAL   = 7;
const NODE_R_ACTIVE   = 10;
const PIPE_H          = 5;
const PIPE_GAP        = 3;   // gap between pipe end and node edge
const PAD             = 40;  // left/right padding in viewBox units
const NODE_CX         = Array.from(
  { length: N },
  (_, i) => PAD + (i / (N - 1)) * (SCHEMATIC_VB_W - PAD * 2)
);

function PipelineSchematic({ activeStage }: { activeStage: number }) {
  return (
    <svg
      viewBox={`0 0 ${SCHEMATIC_VB_W} ${SCHEMATIC_VB_H}`}
      style={{ width: "100%", height: "84px", display: "block" }}
      aria-hidden="true"
    >
      {/* ── Pipe segments ───────────────────────────────────────────── */}
      {Array.from({ length: N - 1 }, (_, i) => {
        const x1  = NODE_CX[i] + NODE_R_NORMAL + PIPE_GAP;
        const x2  = NODE_CX[i + 1] - NODE_R_NORMAL - PIPE_GAP;
        const lit = i < activeStage;
        return (
          <rect
            key={i}
            x={x1}
            y={NODE_CY - PIPE_H / 2}
            width={x2 - x1}
            height={PIPE_H}
            rx={2.5}
            fill={lit ? GREEN : "#0d2010"}
            style={{ transition: "fill 0.5s ease" }}
          />
        );
      })}

      {/* ── Node junctions ──────────────────────────────────────────── */}
      {NODE_CX.map((cx, i) => {
        const isActive = i === activeStage;
        const isPast   = i < activeStage;
        const r        = isActive ? NODE_R_ACTIVE : NODE_R_NORMAL;
        return (
          <g key={i}>
            {/* Outer glow ring for active node */}
            {isActive && (
              <circle
                cx={cx}
                cy={NODE_CY}
                r={NODE_R_ACTIVE + 8}
                fill="none"
                stroke={GREEN}
                strokeWidth={1}
                opacity={0.2}
              />
            )}
            {/* Node circle */}
            <circle
              cx={cx}
              cy={NODE_CY}
              r={r}
              fill={isActive ? GREEN : isPast ? "rgba(46,230,166,0.25)" : "#060d06"}
              stroke={
                isActive
                  ? GREEN
                  : isPast
                  ? "rgba(46,230,166,0.45)"
                  : "rgba(46,230,166,0.12)"
              }
              strokeWidth={isActive ? 0 : 1.5}
              style={{ transition: "fill 0.5s ease, stroke 0.5s ease" }}
            />
            {/* Stage label */}
            <text
              x={cx}
              y={SCHEMATIC_VB_H - 4}
              textAnchor="middle"
              fontSize={7}
              letterSpacing={1.2}
              fontFamily="monospace"
              fill={
                isActive
                  ? GREEN
                  : isPast
                  ? "rgba(46,230,166,0.35)"
                  : "rgba(100,116,139,0.30)"
              }
              style={{
                textTransform: "uppercase",
                transition: "fill 0.5s ease",
              }}
            >
              {STAGES[i].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 3D Scene — particles flowing through nodes ───────────────────────────────

function PipelineScene({ activeStage }: { activeStage: number }) {
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particleTs = useRef<Float32Array>(
    (() => {
      const arr = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        arr[i] = (i / PARTICLE_COUNT) * (N - 1);
      }
      return arr;
    })()
  );

  useFrame((_, delta) => {
    const pts = particleTs.current;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pts[i] = (pts[i] + delta * DT_PER_SEC) % (N - 1);
    }
    if (!particleMeshRef.current) return;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t    = pts[i];
      const seg  = Math.min(Math.floor(t), N - 2);
      const frac = t - seg;
      const x    = NODE_X[seg] + (NODE_X[seg + 1] - NODE_X[seg]) * frac;
      dummy.position.set(x, 0, 0);
      dummy.scale.setScalar(0.05);
      dummy.updateMatrix();
      particleMeshRef.current.setMatrixAt(i, dummy.matrix);
    }
    particleMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Pipe connections */}
      {Array.from({ length: N - 1 }, (_, i) => (
        <mesh
          key={i}
          position={[(NODE_X[i] + NODE_X[i + 1]) / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.04, 0.04, SPACING * 0.72, 6]} />
          <meshBasicMaterial
            color={GREEN_VEC}
            transparent
            opacity={i < activeStage ? 0.5 : 0.1}
          />
        </mesh>
      ))}

      {/* Pipeline nodes */}
      {NODE_X.map((x, i) => {
        const isActive = i === activeStage;
        const isPast   = i < activeStage;
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh>
              <sphereGeometry args={[isActive ? 0.22 : 0.13, 16, 16]} />
              <meshBasicMaterial
                color={GREEN_VEC}
                transparent
                opacity={isActive ? 1.0 : isPast ? 0.5 : 0.15}
              />
            </mesh>
            {isActive && (
              <>
                <mesh>
                  <sphereGeometry args={[0.32, 12, 12]} />
                  <meshBasicMaterial color={GREEN_VEC} transparent opacity={0.10} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.48, 12, 12]} />
                  <meshBasicMaterial color={GREEN_VEC} transparent opacity={0.04} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Flowing particles */}
      <instancedMesh ref={particleMeshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={GREEN_VEC} transparent opacity={0.85} />
      </instancedMesh>
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelineExperience() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((s) => (s + 1) % N);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const stage = STAGES[activeStage];

  return (
    <div
      style={{
        height: "520px",
        width: "100%",
        background: "#000200",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── 2D pipeline schematic — top ───────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid rgba(13,32,16,0.8)",
          padding: "14px 20px 0",
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.22em",
            color: "rgba(46,230,166,0.38)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Detection Pipeline
        </div>
        <PipelineSchematic activeStage={activeStage} />
      </div>

      {/* ── 3D canvas — pointer-events off so page remains scrollable ─ */}
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          camera={{ position: [0, 1.0, 6], fov: 52, near: 0.1, far: 100 }}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#000200"));
          }}
        >
          <PipelineScene activeStage={activeStage} />
        </Canvas>
      </div>

      {/* ── Stage annotation — bottom ─────────────────────────────── */}
      <div
        style={{
          height: "76px",
          borderTop: "1px solid rgba(13,32,16,0.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "0 24px",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                color: GREEN,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              {stage.label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(100,116,139,0.75)",
                letterSpacing: "0.04em",
              }}
            >
              {stage.desc}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
