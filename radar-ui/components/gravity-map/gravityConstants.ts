// ── Gravity Map constants ──────────────────────────────────────────────────────
// All tunable parameters live here. Adjust sigma and exponent when testing
// with real sparse data before touching component code.

// Grid geometry
export const GRID_SIZE     = 80;  // world units — width and depth of the surface
export const GRID_SEGMENTS = 80;  // vertex resolution per axis (fallback: 60)

// Depth deformation
export const MAX_DEPTH     = 18;  // maximum Y deformation depth (world units)

// Visual mass scaling
// mass_score_visual = mass_score_raw ^ MASS_EXPONENT
// Lower exponent → stronger perceptual separation between high and low mass.
// Increase toward 0.5 if wells feel too compressed.
// Decrease toward 0.3 if wells feel too uniform.
export const MASS_EXPONENT = 0.4;

// Sigma: controls well width (breadth of Gaussian deformation)
// sigma = GRID_SIZE / (nodeCount * SIGMA_DIVISOR)
// Increase SIGMA_DIVISOR → narrower wells (more distinct when dense)
// Decrease SIGMA_DIVISOR → wider wells (better for sparse data)
export const SIGMA_DIVISOR = 0.9;
export const SIGMA_FLOOR   = 10;  // minimum sigma, prevents point-like wells for single nodes

// Depth-based color stops: [normalizedDepth 0–1, [r, g, b] as 0–1 floats]
// 0.0 = flat surface, 1.0 = maximum well depth
export const DEPTH_COLOR_STOPS: [number, [number, number, number]][] = [
  [0.0, [40  / 255, 80  / 255, 140 / 255]],  // deep blue   — flat surface
  [0.3, [60  / 255, 120 / 255, 160 / 255]],  // mid-blue    — shallow slope
  [0.6, [180 / 255, 120 / 255,  60 / 255]],  // amber-ochre — active zone
  [1.0, [200 / 255,  60 / 255,  40 / 255]],  // red-orange  — deepest well
];

// Camera — ~17° elevation angle: profile-biased for cross-section reading.
// Nodes form a horizontal line; wells read as downward displacement beneath them.
export const CAMERA_FOV      = 45;
export const CAMERA_NEAR     = 0.1;
export const CAMERA_FAR      = 500;
export const CAMERA_POSITION = { x: 0, y: 28, z: 92 } as const;
export const CAMERA_LOOK_AT  = { x: 0, y: -6, z: 0 } as const;

// Node sizing (pixel units for the HTML overlay circles)
export const NODE_RADIUS_ZERO   = 3;   // px — zero-mass reference node
export const NODE_RADIUS_MIN    = 5;   // px — minimum active node
export const NODE_RADIUS_MAX    = 10;  // px — maximum active node

// Node selection — highlight pulse
export const SELECTED_RING_OFFSET = 6;  // px beyond node radius

// Normalization caps for mass formula inputs
export const MASS_CAPS = {
  signal_count_7d: 10,
  avg_confidence:  1.0,
  movement_count:  5,
  pressure_index:  10.0,
  avg_urgency:     5.0,
} as const;
