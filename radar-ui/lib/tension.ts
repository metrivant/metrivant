import type { RadarCompetitor } from "./api";

export type TensionLink = {
  idA: string;
  idB: string;
  /** 0–1: combined signal proximity + momentum proximity (both nodes share movement_type) */
  intensity: number;
  movementType: string;
};

const MIN_INTENSITY  = 0.55;
const MIN_MOMENTUM   = 1.5;
const MAX_LINKS      = 18;

function pairIntensity(
  a: RadarCompetitor,
  b: RadarCompetitor,
  maxSignals: number,
  maxMomentum: number,
): number {
  // Hard gate: both nodes must share a movement type
  if (
    !a.latest_movement_type ||
    a.latest_movement_type !== b.latest_movement_type
  ) return 0;

  const signalSim =
    1 - Math.abs((a.signals_7d ?? 0) - (b.signals_7d ?? 0)) / Math.max(maxSignals, 1);
  const momentumSim =
    1 - Math.abs(Number(a.momentum_score ?? 0) - Number(b.momentum_score ?? 0)) /
      Math.max(maxMomentum, 1);

  // 0.5 base (shared type) + up to 0.25 each for signal + momentum proximity
  return 0.5 + signalSim * 0.25 + momentumSim * 0.25;
}

/**
 * Returns deterministic tension links between competitors that are
 * converging on the same strategic territory.
 * Capped at MAX_LINKS, sorted strongest first.
 */
export function computeTensionLinks(
  competitors: RadarCompetitor[]
): TensionLink[] {
  const active = competitors.filter(
    (c) =>
      Number(c.momentum_score ?? 0) >= MIN_MOMENTUM &&
      (c.signals_7d ?? 0) >= 1
  );

  if (active.length < 2) return [];

  const maxSignals  = Math.max(...active.map((c) => c.signals_7d ?? 0), 1);
  const maxMomentum = Math.max(...active.map((c) => Number(c.momentum_score ?? 0)), 1);

  const links: TensionLink[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const intensity = pairIntensity(a, b, maxSignals, maxMomentum);
      if (intensity >= MIN_INTENSITY && a.latest_movement_type) {
        links.push({
          idA:          a.competitor_id,
          idB:          b.competitor_id,
          intensity,
          movementType: a.latest_movement_type,
        });
      }
    }
  }

  links.sort((a, b) => b.intensity - a.intensity);
  return links.slice(0, MAX_LINKS);
}

/**
 * Returns a one-line tension explanation for a specific competitor.
 * Shown on hover. Returns null when there is no tension to explain.
 */
export function getTensionDescription(
  competitorId: string,
  links: TensionLink[],
  movementType: string | null
): string | null {
  if (!movementType) return null;
  const count = links.filter(
    (l) =>
      (l.idA === competitorId || l.idB === competitorId) &&
      l.movementType === movementType
  ).length;
  if (count === 0) return null;
  return `${count} rival${count > 1 ? "s" : ""} converging — ${tensionLabel(movementType)}`;
}

function tensionLabel(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "pricing pressure rising";
    case "product_expansion":      return "product race forming";
    case "market_reposition":      return "market repositioning";
    case "enterprise_push":        return "enterprise push building";
    case "ecosystem_expansion":    return "ecosystem convergence";
    default:                       return "strategic tension";
  }
}
