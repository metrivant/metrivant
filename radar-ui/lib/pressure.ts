import type { RadarCompetitor } from "./api";

export type PressureLevel = "low" | "moderate" | "high";

export type PressureState = {
  level: PressureLevel;
  label: string;
  color: string;
  score: number; // 0–100
};

const DORMANT: PressureState = { level: "low", label: "Low", color: "#475569", score: 0 };

/**
 * Derives a market pressure index from existing RadarCompetitor data.
 * Score = weighted blend of average momentum + 24h activity density.
 * No fetch required — fully derived from the radar feed.
 */
export function computePressureIndex(
  competitors: RadarCompetitor[]
): PressureState {
  if (competitors.length === 0) return DORMANT;

  const active = competitors.filter((c) => Number(c.momentum_score ?? 0) > 0);
  if (active.length === 0) return DORMANT;

  const avgMomentum =
    active.reduce((s, c) => s + Number(c.momentum_score ?? 0), 0) / active.length;

  const recent24h = active.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const densityRatio = recent24h / Math.max(competitors.length, 1);

  // Score: momentum contributes 60%, recent density contributes 40%
  // Momentum ceiling at 7 (critical alert threshold = max expected in practice)
  const score = Math.min(100, (avgMomentum / 7) * 60 + densityRatio * 40);

  if (score >= 50) return { level: "high",     label: "High",     color: "#ef4444", score };
  if (score >= 22) return { level: "moderate", label: "Moderate", color: "#f59e0b", score };
  return              { level: "low",      label: "Low",      color: "#475569", score };
}
