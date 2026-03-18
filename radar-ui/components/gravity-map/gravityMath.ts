import {
  MASS_EXPONENT,
  SIGMA_FLOOR,
  SIGMA_DIVISOR,
  GRID_SIZE,
  Y_SPREAD_RANGE,
  DEPTH_COLOR_STOPS,
  MASS_CAPS,
} from "./gravityConstants";

// ── Shared data contract ───────────────────────────────────────────────────────
// GravityNode is the canonical type for the gravity map data contract.
// It is shared between the API route, the useGravityData hook, and all components.

export type GravityNode = {
  competitor_id:              string;
  name:                       string;
  website_url:                string | null;

  // Raw pipeline metrics
  signal_count_7d:            number;
  avg_confidence:             number;
  movement_count:             number;
  pressure_index:             number;
  avg_urgency:                number | null;

  // Computed mass
  mass_score_raw:             number;
  mass_score_visual:          number;

  // Relative ranking
  rank:                       number;
  relative_mass_pct:          number;

  // Top intelligence for readout
  top_interpretation_summary: string | null;

  // Grid positions (XZ plane) — set by positionNodes()
  gridX:                      number;
  gridZ:                      number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// Deterministic integer hash (djb2 variant) for stable Y-axis jitter
export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Mass formula ───────────────────────────────────────────────────────────────

export function computeMassRaw(
  signal_count_7d: number,
  avg_confidence:  number,
  movement_count:  number,
  pressure_index:  number,
  avg_urgency:     number | null
): number {
  const hasActivity =
    signal_count_7d > 0 ||
    avg_confidence  > 0 ||
    movement_count  > 0 ||
    pressure_index  > 0 ||
    (avg_urgency ?? 0) > 0;

  if (!hasActivity) return 0;

  const sc = clamp(signal_count_7d / MASS_CAPS.signal_count_7d);
  const ac = clamp(avg_confidence  / MASS_CAPS.avg_confidence);
  const mc = clamp(movement_count  / MASS_CAPS.movement_count);
  const pi = clamp(pressure_index  / MASS_CAPS.pressure_index);
  const au = clamp((avg_urgency ?? 0) / MASS_CAPS.avg_urgency);

  return sc * 0.25 + ac * 0.25 + mc * 0.20 + pi * 0.20 + au * 0.10;
}

export function computeMassVisual(raw: number): number {
  return raw <= 0 ? 0 : Math.pow(raw, MASS_EXPONENT);
}

// ── Sigma ──────────────────────────────────────────────────────────────────────

export function computeSigma(nodeCount: number): number {
  if (nodeCount <= 0) return SIGMA_FLOOR;
  return Math.max(SIGMA_FLOOR, GRID_SIZE / (nodeCount * SIGMA_DIVISOR));
}

// ── Gaussian deformation ───────────────────────────────────────────────────────
// Returns a value in [0, ~1] representing total well depth contribution at (x, z).
// Caller multiplies by MAX_DEPTH and negates for downward Y displacement.

export function computeGaussianDepth(
  x:     number,
  z:     number,
  nodes: Pick<GravityNode, "gridX" | "gridZ" | "mass_score_visual">[],
  sigma: number
): number {
  let sum = 0;
  const twoSigSq = 2 * sigma * sigma;
  for (const node of nodes) {
    if (node.mass_score_visual <= 0) continue;
    const dx = x - node.gridX;
    const dz = z - node.gridZ;
    sum += node.mass_score_visual * Math.exp(-(dx * dx + dz * dz) / twoSigSq);
  }
  return sum;
}

// ── Color interpolation ────────────────────────────────────────────────────────

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// normalizedDepth: 0 = flat surface, 1 = deepest well.
// Returns [r, g, b] as 0–1 floats, ready for THREE vertex color buffers.
export function depthToColor(normalizedDepth: number): [number, number, number] {
  const d = clamp(normalizedDepth);
  const stops = DEPTH_COLOR_STOPS;
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (d <= t1) {
      const t = t1 > t0 ? (d - t0) / (t1 - t0) : 0;
      return lerpColor(c0, c1, clamp(t));
    }
  }
  return stops[stops.length - 1][1];
}

// ── Node positioning ───────────────────────────────────────────────────────────
// Takes raw pipeline metrics and returns fully-positioned GravityNode[].
// Sorted descending by mass; X axis encodes rank; Z axis encodes identity jitter.

export function positionNodes(
  inputs: Omit<GravityNode, "mass_score_raw" | "mass_score_visual" | "rank" | "relative_mass_pct" | "gridX" | "gridZ">[],
  gridSize = GRID_SIZE
): GravityNode[] {
  // Compute raw mass for each
  const withMass = inputs.map((n) => ({
    ...n,
    mass_score_raw: computeMassRaw(
      n.signal_count_7d,
      n.avg_confidence,
      n.movement_count,
      n.pressure_index,
      n.avg_urgency
    ),
  }));

  // Sort descending by mass (highest mass = leftmost / rank 0)
  const sorted = [...withMass].sort((a, b) => b.mass_score_raw - a.mass_score_raw);
  const maxMass = sorted[0]?.mass_score_raw ?? 0;

  const count  = sorted.length;
  const xRange = gridSize * 0.72;
  const xStart = -xRange / 2;
  const xStep  = count > 1 ? xRange / (count - 1) : 0;

  return sorted.map((node, rank) => {
    const mass_score_visual = computeMassVisual(node.mass_score_raw);
    const gridX = count === 1 ? 0 : xStart + rank * xStep;
    // Stable deterministic Z jitter — no semantic meaning
    const gridZ = ((hashCode(node.competitor_id) % 100) / 100 - 0.5) * Y_SPREAD_RANGE;

    return {
      ...node,
      mass_score_raw:    node.mass_score_raw,
      mass_score_visual,
      rank,
      relative_mass_pct: maxMass > 0 ? (node.mass_score_raw / maxMass) * 100 : 0,
      gridX,
      gridZ,
    };
  });
}
