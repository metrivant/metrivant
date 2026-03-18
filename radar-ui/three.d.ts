// Minimal module declarations for three.js (v0.183.x ships without bundled .d.ts).
// GravityMap.tsx uses these via dynamic import + `any`-typed local helpers.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "three" {
  export const WebGLRenderer:      any;
  export const PerspectiveCamera:  any;
  export const Scene:              any;
  export const AmbientLight:       any;
  export const DirectionalLight:   any;
  export const Vector3:            any;
  export const Mesh:               any;
  export const LineSegments:       any;
  export const WireframeGeometry:  any;
  export const BufferAttribute:    any;
  export const PlaneGeometry:      any;
  export const MeshLambertMaterial: any;
  export const LineBasicMaterial:  any;
  export const DoubleSide:         number;
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(camera: any, domElement: any);
    enableDamping:   boolean;
    dampingFactor:   number;
    enablePan:       boolean;
    minDistance:     number;
    maxDistance:     number;
    maxPolarAngle:   number;
    target:          { set(x: number, y: number, z: number): void };
    update():  void;
    dispose(): void;
  }
}
