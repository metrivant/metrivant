"use client";

import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── Constants ────────────────────────────────────────────────────────────────

const GREEN = "#2EE6A6";
const GREEN_VEC = new THREE.Color(GREEN);
const WHITE_DIM = "rgba(255,255,255,0.12)";
const STAGE_COUNT = 7;
const TRANSITION_DURATION = 1.2;
const PARTICLE_COUNT = 48;

const STAGE_LABELS = [
  "INPUT",
  "INGESTION",
  "PROCESSING",
  "INTERPRETATION",
  "OUTPUT",
  "CONVERGENCE",
  "ENTER METRIVANT",
] as const;

// Camera positions per stage (x, y, z)
const STAGE_CAMERAS: [number, number, number][] = [
  [0, 2, 8],
  [0, 2, 8],
  [0, 3, 9],
  [0, 2, 8],
  [0, 3, 8],
  [0, 2, 8],
  [0, 0, 6],
];

// ── Types ────────────────────────────────────────────────────────────────────

interface StageProps {
  opacity: number;
}

// ── Utility: smooth lerp for camera ──────────────────────────────────────────

function useSmoothCamera(
  targetPos: [number, number, number],
  duration: number,
  onTransitionEnd: () => void
) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...targetPos));
  const transitioning = useRef(false);
  const elapsed = useRef(0);
  const startPos = useRef(new THREE.Vector3());

  useEffect(() => {
    target.current.set(...targetPos);
    startPos.current.copy(camera.position);
    transitioning.current = true;
    elapsed.current = 0;
  }, [targetPos, camera]);

  useFrame((_, delta) => {
    if (!transitioning.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / duration, 1);
    // ease-in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(startPos.current, target.current, ease);
    camera.lookAt(0, 0, 0);

    if (t >= 1) {
      transitioning.current = false;
      onTransitionEnd();
    }
  });

  return transitioning;
}

// ── Stage 1: INPUT — Scattered particles ─────────────────────────────────────

const InputStage = memo(function InputStage({ opacity }: StageProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const positions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push([
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
      ]);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [x, y, z] = positions[i];
      dummy.position.set(
        x + Math.sin(t * 0.3 + i) * 0.15,
        y + Math.cos(t * 0.25 + i * 0.7) * 0.15,
        z + Math.sin(t * 0.2 + i * 1.3) * 0.1
      );
      dummy.scale.setScalar(0.06 + Math.sin(t + i) * 0.02);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.8}
        />
      </instancedMesh>
    </group>
  );
});

// ── Stage 2: INGESTION — Wireframe icosahedron collecting particles ──────────

const IngestionStage = memo(function IngestionStage({ opacity }: StageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 30;

  const particles = useMemo(() => {
    const arr: { start: THREE.Vector3; end: THREE.Vector3; speed: number }[] =
      [];
    for (let i = 0; i < count; i++) {
      const outside = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      );
      const inside = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2
      );
      arr.push({ start: outside, end: inside, speed: 0.15 + Math.random() * 0.25 });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !meshRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
    groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.1;

    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const progress = (Math.sin(t * p.speed + i * 2) + 1) / 2;
      dummy.position.lerpVectors(p.start, p.end, progress);
      dummy.scale.setScalar(0.05);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.8, 1]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          wireframe
          transparent
          opacity={opacity * 0.4}
        />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.9}
        />
      </instancedMesh>
    </group>
  );
});

// ── Stage 3: PROCESSING — Grid of connected nodes ───────────────────────────

const ProcessingStage = memo(function ProcessingStage({ opacity }: StageProps) {
  const groupRef = useRef<THREE.Group>(null);

  const grid = useMemo(() => {
    const nodes: [number, number, number][] = [];
    const size = 3;
    for (let x = -size; x <= size; x += 1.5) {
      for (let z = -size; z <= size; z += 1.5) {
        nodes.push([x, 0, z]);
      }
    }
    return nodes;
  }, []);

  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < grid.length; i++) {
      for (let j = i + 1; j < grid.length; j++) {
        const dx = Math.abs(grid[i][0] - grid[j][0]);
        const dz = Math.abs(grid[i][2] - grid[j][2]);
        if ((dx <= 1.5 && dz === 0) || (dz <= 1.5 && dx === 0)) {
          points.push(
            new THREE.Vector3(...grid[i]),
            new THREE.Vector3(...grid[j])
          );
        }
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [grid]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.04;
  });

  return (
    <group ref={groupRef}>
      {grid.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial
            color={GREEN_VEC}
            wireframe
            transparent
            opacity={opacity * 0.6}
          />
        </mesh>
      ))}
      <lineSegments geometry={lines}>
        <lineBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.2}
        />
      </lineSegments>
    </group>
  );
});

// ── Stage 4: INTERPRETATION — Atom model ─────────────────────────────────────

const InterpretationStage = memo(function InterpretationStage({
  opacity,
}: StageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitals = useMemo(() => {
    return [
      { radius: 2.2, speed: 0.6, tilt: 0 },
      { radius: 2.5, speed: 0.45, tilt: Math.PI / 3 },
      { radius: 2.0, speed: 0.55, tilt: -Math.PI / 4 },
    ];
  }, []);

  const ringLines = useMemo(() => {
    return orbitals.map((o) => {
      const curve = new THREE.EllipseCurve(0, 0, o.radius, o.radius, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );
      const mat = new THREE.LineBasicMaterial({
        color: GREEN_VEC,
        transparent: true,
        opacity: 0.25,
      });
      return new THREE.Line(geo, mat);
    });
  }, [orbitals]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    ringLines.forEach((l) => {
      (l.material as THREE.LineBasicMaterial).opacity = opacity * 0.25;
    });
  });

  return (
    <group ref={groupRef}>
      {/* Central glowing sphere */}
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.7}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.65, 24, 24]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          wireframe
          transparent
          opacity={opacity * 0.2}
        />
      </mesh>

      {/* Orbital rings + electrons */}
      {orbitals.map((o, i) => (
        <group key={i} rotation={[o.tilt, 0, 0]}>
          <primitive object={ringLines[i]} />
          <OrbitalElectron
            radius={o.radius}
            speed={o.speed}
            opacity={opacity}
          />
        </group>
      ))}

    </group>
  );
});

function OrbitalElectron({
  radius,
  speed,
  opacity,
}: {
  radius: number;
  speed: number;
  opacity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() * speed;
    meshRef.current.position.set(
      Math.cos(t) * radius,
      0,
      Math.sin(t) * radius
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial
        color={GREEN_VEC}
        transparent
        opacity={opacity * 0.9}
      />
    </mesh>
  );
}

// ── Stage 5: OUTPUT — Upward arrows from a plane ─────────────────────────────

const OutputStage = memo(function OutputStage({ opacity }: StageProps) {
  const groupRef = useRef<THREE.Group>(null);

  const arrows = useMemo(() => {
    const arr: { x: number; z: number; speed: number; offset: number }[] = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 4,
        speed: 0.4 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.03;
  });

  return (
    <group ref={groupRef}>
      {/* Base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <planeGeometry args={[6, 6, 8, 8]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          wireframe
          transparent
          opacity={opacity * 0.15}
        />
      </mesh>

      {/* Rising cones */}
      {arrows.map((a, i) => (
        <RisingCone key={i} {...a} opacity={opacity} />
      ))}

    </group>
  );
});

function RisingCone({
  x,
  z,
  speed,
  offset,
  opacity,
}: {
  x: number;
  z: number;
  speed: number;
  offset: number;
  opacity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const y = -1.5 + ((t * speed + offset) % 4);
    meshRef.current.position.set(x, y, z);
    meshRef.current.material;
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, 0]}>
      <coneGeometry args={[0.12, 0.4, 4]} />
      <meshBasicMaterial
        color={GREEN_VEC}
        wireframe
        transparent
        opacity={opacity * 0.7}
      />
    </mesh>
  );
}

// ── Stage 6: CONVERGENCE — Radar-like concentric rings ───────────────────────

const ConvergenceStage = memo(function ConvergenceStage({
  opacity,
}: StageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sweepRef = useRef<THREE.Group>(null);

  const ringLines = useMemo(() => {
    return [1.0, 1.8, 2.6, 3.4].map((r, i) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );
      const mat = new THREE.LineBasicMaterial({
        color: GREEN_VEC,
        transparent: true,
        opacity: 0.15 + i * 0.08,
      });
      return new THREE.Line(geo, mat);
    });
  }, []);

  const sweepLine = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3.4, 0, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: GREEN_VEC,
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.Line(geo, mat);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !sweepRef.current) return;
    groupRef.current.rotation.x = -Math.PI / 6;
    sweepRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    // Update opacities for fade
    ringLines.forEach((l, i) => {
      (l.material as THREE.LineBasicMaterial).opacity = opacity * (0.15 + i * 0.08);
    });
    (sweepLine.material as THREE.LineBasicMaterial).opacity = opacity * 0.6;
  });

  return (
    <group ref={groupRef}>
      {ringLines.map((lineObj, i) => (
        <primitive key={i} object={lineObj} />
      ))}

      {/* Rotating sweep line */}
      <group ref={sweepRef}>
        <primitive object={sweepLine} />
      </group>

      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.9}
        />
      </mesh>

    </group>
  );
});

// ── Stage 7: ENTER METRIVANT — Glowing dot in void ──────────────────────────

const EnterStage = memo(function EnterStage({ opacity }: StageProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current) return;
    const t = clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 0.8) * 0.15;
    meshRef.current.scale.setScalar(scale);
    glowRef.current.scale.setScalar(scale * 2.5);
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color={GREEN_VEC}
          transparent
          opacity={opacity * 0.15}
        />
      </mesh>
    </group>
  );
});

// ── Stage container with fade ────────────────────────────────────────────────

const STAGES = [
  InputStage,
  IngestionStage,
  ProcessingStage,
  InterpretationStage,
  OutputStage,
  ConvergenceStage,
  EnterStage,
] as const;

function StageRenderer({
  activeStage,
  onTransitionEnd,
}: {
  activeStage: number;
  onTransitionEnd: () => void;
}) {
  const [visibleStage, setVisibleStage] = useState(activeStage);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const fadeRef = useRef({ phase: "idle" as "idle" | "out" | "in", target: activeStage });
  const opacityRef = useRef(1);

  useEffect(() => {
    if (activeStage !== visibleStage) {
      fadeRef.current = { phase: "out", target: activeStage };
    }
  }, [activeStage, visibleStage]);

  useFrame((_, delta) => {
    const f = fadeRef.current;
    if (f.phase === "out") {
      opacityRef.current = Math.max(0, opacityRef.current - delta / (TRANSITION_DURATION * 0.4));
      setFadeOpacity(opacityRef.current);
      if (opacityRef.current <= 0) {
        setVisibleStage(f.target);
        f.phase = "in";
      }
    } else if (f.phase === "in") {
      opacityRef.current = Math.min(1, opacityRef.current + delta / (TRANSITION_DURATION * 0.6));
      setFadeOpacity(opacityRef.current);
      if (opacityRef.current >= 1) {
        f.phase = "idle";
      }
    }
  });

  const StageComponent = STAGES[visibleStage];

  return <StageComponent opacity={fadeOpacity} />;
}

// ── Camera controller ────────────────────────────────────────────────────────

function CameraController({
  activeStage,
  onTransitionEnd,
}: {
  activeStage: number;
  onTransitionEnd: () => void;
}) {
  useSmoothCamera(STAGE_CAMERAS[activeStage], TRANSITION_DURATION, onTransitionEnd);
  return null;
}

// ── Scene ────────────────────────────────────────────────────────────────────

function Scene({
  activeStage,
  transitioning,
  onTransitionEnd,
}: {
  activeStage: number;
  transitioning: boolean;
  onTransitionEnd: () => void;
}) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  return (
    <>
      <CameraController
        activeStage={activeStage}
        onTransitionEnd={onTransitionEnd}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(3 * Math.PI) / 4}
        minDistance={3}
        maxDistance={12}
        enabled={!transitioning}
        enablePan={false}
      />
      <StageRenderer
        activeStage={activeStage}
        onTransitionEnd={onTransitionEnd}
      />
    </>
  );
}

// ── Navigation overlay ───────────────────────────────────────────────────────

function NavigationOverlay({
  activeStage,
  transitioning,
  onNext,
  onPrev,
}: {
  activeStage: number;
  transitioning: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isFinal = activeStage === STAGE_COUNT - 1;
  const label = STAGE_LABELS[activeStage];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "24px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {/* Stage label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 0.6, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            letterSpacing: 3,
            color: "white",
          }}
        >
          {isFinal ? "" : label}
        </motion.span>
      </AnimatePresence>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: STAGE_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: i === activeStage ? GREEN : "rgba(255,255,255,0.2)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          pointerEvents: "auto",
        }}
      >
        {activeStage > 0 && !isFinal && (
          <button
            onClick={onPrev}
            disabled={transitioning}
            style={{
              padding: "8px 20px",
              border: `1px solid rgba(255,255,255,0.2)`,
              borderRadius: 4,
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: 1,
              cursor: transitioning ? "not-allowed" : "pointer",
              opacity: transitioning ? 0.4 : 1,
              transition: "opacity 0.2s",
            }}
          >
            &larr; Back
          </button>
        )}

        {isFinal ? (
          <Link
            href="/signup"
            style={{
              padding: "10px 28px",
              border: "none",
              borderRadius: 4,
              background: GREEN,
              color: "#000200",
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1.5,
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ENTER METRIVANT
          </Link>
        ) : (
          <button
            onClick={onNext}
            disabled={transitioning}
            style={{
              padding: "8px 20px",
              border: `1px solid ${GREEN}`,
              borderRadius: 4,
              background: "transparent",
              color: GREEN,
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: 1,
              cursor: transitioning ? "not-allowed" : "pointer",
              opacity: transitioning ? 0.4 : 1,
              transition: "opacity 0.2s",
            }}
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PipelineExperience() {
  const [activeStage, setActiveStage] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const handleNext = useCallback(() => {
    if (transitioning || activeStage >= STAGE_COUNT - 1) return;
    setTransitioning(true);
    setActiveStage((s) => s + 1);
  }, [transitioning, activeStage]);

  const handlePrev = useCallback(() => {
    if (transitioning || activeStage <= 0) return;
    setTransitioning(true);
    setActiveStage((s) => s - 1);
  }, [transitioning, activeStage]);

  const handleTransitionEnd = useCallback(() => {
    setTransitioning(false);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
        background: "#000200",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 2, 8], fov: 50, near: 0.1, far: 100 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000200"));
        }}
      >
        <Scene
          activeStage={activeStage}
          transitioning={transitioning}
          onTransitionEnd={handleTransitionEnd}
        />
      </Canvas>

      <NavigationOverlay
        activeStage={activeStage}
        transitioning={transitioning}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    </div>
  );
}
