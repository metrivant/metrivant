// three.js type declarations — delegates to @types/three.
// GravityMap.tsx uses dynamic import("three") with any-typed local helpers,
// so switching from manual declarations to @types/three is safe.
// PipelineExperience.tsx (R3F) needs proper typed exports.

// Re-export everything from @types/three so both static and dynamic
// import patterns resolve properly.
export * from "@types/three";

declare module "three/examples/jsm/controls/OrbitControls.js" {
  import type { Camera, EventDispatcher, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    minDistance: number;
    maxDistance: number;
    maxPolarAngle: number;
    target: Vector3;
    update(): void;
    dispose(): void;
  }
}
