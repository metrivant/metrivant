import type { RadarCompetitor } from "./api";

export type ActivityEcho = {
  competitorId: string;
  competitorName: string;
  label: string;
  timestamp: string;
  ageHours: number;
};

const MAX_TOTAL_ECHOES = 12;
const ECHO_WINDOW_HOURS = 24;

const HIRING_KEYWORDS = [
  "hiring", "recruit", "headcount", "engineering team",
  "talent", "careers", "workforce", "open roles",
];

/**
 * Returns true when a competitor's recent movement summary contains
 * hiring-related language and the signal is within the last 48 hours.
 * Used to surface "Hiring surge detected" in the node hover tooltip.
 */
export function detectHiringSurge(competitor: RadarCompetitor): boolean {
  if (!competitor.last_signal_at) return false;
  const ageHours = (Date.now() - new Date(competitor.last_signal_at).getTime()) / 3_600_000;
  if (ageHours > 48) return false;
  const summary = (competitor.latest_movement_summary ?? "").toLowerCase();
  return HIRING_KEYWORDS.some((kw) => summary.includes(kw));
}

function deriveEchoLabel(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "Pricing activity";
    case "product_expansion":      return "Product update";
    case "market_reposition":      return "Positioning change";
    case "enterprise_push":        return "Enterprise activity";
    case "ecosystem_expansion":    return "Partnership activity";
    default:                       return "Activity detected";
  }
}

/**
 * True when a competitor shows signal activity that hasn't risen to a
 * confirmed strategic movement — low momentum or low-confidence classification.
 * These nodes receive a dashed orbit ring on the radar.
 */
export function isWeakSignal(competitor: RadarCompetitor): boolean {
  const momentum = Number(competitor.momentum_score ?? 0);
  const signals  = competitor.signals_7d ?? 0;
  // Has recent activity but hasn't reached stable momentum
  if (signals >= 1 && momentum < 1.5) return true;
  // Movement detected but confidence below threshold
  if (
    competitor.latest_movement_confidence != null &&
    competitor.latest_movement_confidence < 0.45 &&
    signals >= 1
  ) return true;
  return false;
}

/**
 * Derives activity echoes from existing RadarCompetitor data.
 * Returns a map from competitorId → ActivityEcho.
 * Only competitors with last_signal_at within 24 hours are included.
 * Total echoes capped at 12 (freshest first).
 */
export function deriveActivityEchoes(
  competitors: RadarCompetitor[]
): Map<string, ActivityEcho> {
  const now = Date.now();
  const candidates: ActivityEcho[] = [];

  for (const c of competitors) {
    if (!c.last_signal_at) continue;
    const ageHours = (now - new Date(c.last_signal_at).getTime()) / 3_600_000;
    if (ageHours > ECHO_WINDOW_HOURS) continue;
    candidates.push({
      competitorId:   c.competitor_id,
      competitorName: c.competitor_name,
      label:          deriveEchoLabel(c.latest_movement_type),
      timestamp:      c.last_signal_at,
      ageHours,
    });
  }

  // Freshest first; apply total cap
  candidates.sort((a, b) => a.ageHours - b.ageHours);

  const result = new Map<string, ActivityEcho>();
  for (const echo of candidates.slice(0, MAX_TOTAL_ECHOES)) {
    result.set(echo.competitorId, echo);
  }
  return result;
}
