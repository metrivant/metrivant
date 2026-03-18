"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  GRID_SIZE,
  GRID_SEGMENTS,
  MAX_DEPTH,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_POSITION,
  CAMERA_LOOK_AT,
} from "./gravityConstants";
import {
  computeGaussianDepth,
  computeSigma,
  depthToColor,
  type GravityNode,
} from "./gravityMath";
import GravityNodeMarker from "./GravityNode";
import GravityReadout from "./GravityReadout";
import { useGravityData } from "./useGravityData";

// ── Minimal internal types for Three.js refs ──────────────────────────────────
// (three v0.183 doesn't ship .d.ts; see three.d.ts at project root)

interface ThreeRenderer {
  domElement: HTMLCanvasElement;
  setPixelRatio(r: number): void;
  setSize(w: number, h: number): void;
  setClearColor(color: number, alpha: number): void;
  render(scene: object, camera: object): void;
  dispose(): void;
}
interface ThreeCamera {
  aspect: number;
  updateProjectionMatrix(): void;
  position: { set(x: number, y: number, z: number): void };
  lookAt(x: number, y: number, z: number): void;
}
interface ThreeControls {
  update(): void;
  dispose(): void;
  enableDamping: boolean;
  dampingFactor: number;
  enablePan: boolean;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
  target: { set(x: number, y: number, z: number): void };
}
interface ThreeVec3 {
  set(x: number, y: number, z: number): ThreeVec3;
  project(camera: object): ThreeVec3;
  x: number; y: number; z: number;
}

// ── Surface builder ────────────────────────────────────────────────────────────

function buildSurface(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  THREE: Record<string, any>,
  nodes: GravityNode[],
  sigma: number
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SEGMENTS, GRID_SEGMENTS);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  geo.rotateX(-Math.PI / 2);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const positions = geo.attributes.position;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const count = positions.count as number;

  const depths: number[] = new Array(count);
  let maxRaw = 0;
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const x = positions.getX(i) as number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const z = positions.getZ(i) as number;
    const d = computeGaussianDepth(x, z, nodes, sigma);
    depths[i] = d;
    if (d > maxRaw) maxRaw = d;
  }

  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const norm = maxRaw > 0 ? depths[i] / maxRaw : 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    positions.setY(i, -depths[i] * MAX_DEPTH);
    const [r, g, b] = depthToColor(norm);
    colors[i * 3]     = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  geo.computeVertexNormals();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1a3a5a, transparent: true, opacity: 0.08 });

  return { geo, mat, wireMat };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GravityMap() {
  const { nodes, loading, error } = useGravityData();
  const [selectedNode, setSelectedNode] = useState<GravityNode | null>(null);
  const [ready, setReady] = useState(false);

  const canvasRef    = useRef<HTMLDivElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<ThreeRenderer | null>(null);
  const cameraRef    = useRef<ThreeCamera | null>(null);
  const controlsRef  = useRef<ThreeControls | null>(null);
  const frameRef     = useRef<number>(0);
  const vec3Ref      = useRef<ThreeVec3 | null>(null);
  const nodeRefsMap  = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const handleSelect = useCallback((node: GravityNode) => {
    setSelectedNode((prev) =>
      prev?.competitor_id === node.competitor_id ? null : node
    );
  }, []);

  const handleClose = useCallback(() => setSelectedNode(null), []);

  // ── Three.js scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0 || !canvasRef.current) return;

    let alive = true;

    void (async () => {
      const THREE         = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

      if (!alive || !canvasRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      vec3Ref.current = new THREE.Vector3() as ThreeVec3;

      // Renderer
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) as ThreeRenderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      canvasRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      const { offsetWidth: w, offsetHeight: h } = canvasRef.current;
      renderer.setSize(w, h);

      // Camera
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, CAMERA_NEAR, CAMERA_FAR) as ThreeCamera;
      camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
      camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);
      cameraRef.current = camera;

      // Scene
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const scene: { add(o: object): void } = new THREE.Scene();

      // Lights
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.60);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (dirLight as unknown as { position: { set(x: number, y: number, z: number): void } }).position.set(0, 40, 30);
      scene.add(dirLight);

      // Surface
      const sigma = computeSigma(nodes.length);
      const { geo, mat, wireMat } = buildSurface(THREE, nodes, sigma);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      scene.add(new THREE.Mesh(geo, mat));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo), wireMat));

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement) as ThreeControls;
      controls.enableDamping   = true;
      controls.dampingFactor   = 0.06;
      controls.enablePan       = false;
      controls.minDistance     = 30;
      controls.maxDistance     = 160;
      controls.maxPolarAngle   = Math.PI * 0.48;
      controls.target.set(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);
      controls.update();
      controlsRef.current = controls;

      setReady(true);

      // Animation loop
      const animate = () => {
        if (!alive) return;
        frameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);

        if (!overlayRef.current || !vec3Ref.current) return;
        const rect = overlayRef.current.getBoundingClientRect();

        for (const node of nodes) {
          const el = nodeRefsMap.current.get(node.competitor_id);
          if (!el) continue;

          vec3Ref.current.set(node.gridX, 0, node.gridZ).project(camera);

          if (vec3Ref.current.z >= 1) {
            el.style.display = "none";
            continue;
          }
          el.style.display = "";
          el.style.left    = `${((vec3Ref.current.x + 1) / 2) * rect.width}px`;
          el.style.top     = `${((-vec3Ref.current.y + 1) / 2) * rect.height}px`;
        }
      };
      animate();

      // Resize
      const onResize = () => {
        if (!canvasRef.current || !alive) return;
        camera.aspect = canvasRef.current.offsetWidth / canvasRef.current.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasRef.current.offsetWidth, canvasRef.current.offsetHeight);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(frameRef.current);
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      cameraRef.current   = null;
      controlsRef.current = null;
      canvasRef.current?.querySelector("canvas")?.remove();
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "rgb(0,1,0)" }}
    >
      <div ref={canvasRef} className="absolute inset-0" />

      {/* Node overlay — positioned by animation loop, not React */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0">
        {ready && nodes.map((node) => (
          <GravityNodeMarker
            key={node.competitor_id}
            node={node}
            selected={selectedNode?.competitor_id === node.competitor_id}
            onSelect={handleSelect}
            divRef={(el) => nodeRefsMap.current.set(node.competitor_id, el)}
          />
        ))}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-[1px] w-24 animate-pulse"
              style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.40), transparent)" }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-700">
              Calibrating field
            </span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Field unavailable</div>
            <div className="font-mono text-[9px] text-slate-800">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-700">No field data</div>
            <div className="font-mono text-[9px] text-slate-800">Add competitors to generate the gravity map.</div>
          </div>
        </div>
      )}

      {!loading && nodes.length > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-5 py-3"
          style={{ zIndex: 10 }}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-slate-700">
              Gravity Field
            </span>
            <span className="h-3 w-px bg-slate-800" />
            <span className="font-mono text-[9px] text-slate-800">
              {nodes.length} node{nodes.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="font-mono text-[9px] text-slate-800">Drag to orbit · Scroll to zoom</span>
        </div>
      )}

      <AnimatePresence>
        {selectedNode && (
          <GravityReadout
            key={selectedNode.competitor_id}
            node={selectedNode}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
