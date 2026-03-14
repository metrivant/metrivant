import type { RadarCompetitor } from "./api";

/**
 * Generates deterministic one-line intelligence observations from radar data.
 * No API call — purely derived from RadarCompetitor[]. Returns up to 5 insights.
 * Displayed as a rotating overlay on the radar instrument.
 */
export function generateMicroInsights(competitors: RadarCompetitor[]): string[] {
  if (competitors.length === 0) return [];

  const insights: string[] = [];

  const accelerating = competitors.filter((c) => Number(c.momentum_score ?? 0) >= 5);
  const rising       = competitors.filter((c) => {
    const m = Number(c.momentum_score ?? 0);
    return m >= 3 && m < 5;
  });
  const new24h = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  });

  // Accelerating competitors
  if (accelerating.length >= 3) {
    insights.push(`${accelerating.length} rivals accelerating simultaneously`);
  } else if (accelerating.length === 2) {
    insights.push(`${accelerating[0].competitor_name} and ${accelerating[1].competitor_name} both accelerating`);
  } else if (accelerating.length === 1) {
    insights.push(`${accelerating[0].competitor_name} momentum accelerating`);
  }

  // Dominant movement type across competitors
  const typeCounts = new Map<string, number>();
  for (const c of competitors) {
    if (c.latest_movement_type) {
      typeCounts.set(c.latest_movement_type, (typeCounts.get(c.latest_movement_type) ?? 0) + 1);
    }
  }
  const topEntry = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEntry && topEntry[1] >= 2) {
    insights.push(`${topEntry[1]} rivals showing ${movementToInsightLabel(topEntry[0])}`);
  }

  // Recent activity
  if (new24h.length >= 3) {
    insights.push(`${new24h.length} companies active in the last 24 hours`);
  } else if (new24h.length > 0 && new24h.length < 3) {
    insights.push(`${new24h[0].competitor_name} active in the last 24 hours`);
  }

  // Rising competitors
  if (rising.length >= 3) {
    insights.push(`${rising.length} rivals building momentum`);
  }

  // Signal volume
  const totalSignals = competitors.reduce((s, c) => s + (c.signals_7d ?? 0), 0);
  if (totalSignals >= 8) {
    insights.push(`${totalSignals} strategic signals captured this week`);
  }

  return insights;
}

function movementToInsightLabel(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "pricing movement";
    case "product_expansion":      return "product expansion";
    case "market_reposition":      return "market repositioning";
    case "enterprise_push":        return "enterprise push";
    case "ecosystem_expansion":    return "ecosystem expansion";
    default:                       return "strategic activity";
  }
}
