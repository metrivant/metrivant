// ── Critical Acceleration Alert ────────────────────────────────────────────────
//
// Deterministic threshold model. A critical alert fires only when a competitor
// crosses a strong, multi-signal acceleration threshold. Designed to be a rare,
// high-value event. False positives are worse than missed alerts.
//
// Trigger criteria (ALL must be satisfied):
//   A. momentum_score >= 7           — significantly above the "accelerating" floor of 5
//   B. signals_7d >= 3               — recent signal density confirms sustained activity
//   C. latest_movement_confidence >= 0.70 — system is confident in the movement
//   D. latest_movement_type present  — a specific strategic movement is identified
//   E. latest_movement_last_seen_at within 48h — event is recent, not stale data
//
// At most ONE alert fires per radar load (the highest-momentum qualifier).
// Prevents multi-alert storms. One focal point, one response.

import type { RadarCompetitor } from "./api";

// ── Thresholds ─────────────────────────────────────────────────────────────────

const MOMENTUM_THRESHOLD  = 7;
const SIGNAL_DENSITY_MIN  = 3;
const CONFIDENCE_MIN      = 0.70;
const RECENCY_WINDOW_MS   = 48 * 60 * 60 * 1000; // 48 hours

// ── Types ──────────────────────────────────────────────────────────────────────

export type CriticalAlert = {
  competitor_id:    string;
  competitor_name:  string;
  website_url:      string | null;
  movement_type:    string;
  confidence:       number;
  signals_7d:       number;
  momentum_score:   number;
  last_seen_at:     string;
  movement_summary: string | null;
  // Stable dedup key — changes only when the underlying movement event changes.
  alertKey:         string;
};

// ── Trigger ────────────────────────────────────────────────────────────────────

export function detectCriticalAlert(
  competitors: RadarCompetitor[],
  orgId?: string
): CriticalAlert | null {
  const now = Date.now();

  const qualifying = competitors.filter((c) => {
    const momentum   = Number(c.momentum_score   ?? 0);
    const signals7d  = Number(c.signals_7d        ?? 0);
    const confidence = Number(c.latest_movement_confidence ?? 0);
    const lastSeen   = c.latest_movement_last_seen_at;

    if (momentum   < MOMENTUM_THRESHOLD) return false;
    if (signals7d  < SIGNAL_DENSITY_MIN) return false;
    if (confidence < CONFIDENCE_MIN)     return false;
    if (!c.latest_movement_type)         return false;
    if (!lastSeen)                       return false;
    if (now - new Date(lastSeen).getTime() > RECENCY_WINDOW_MS) return false;

    return true;
  });

  if (qualifying.length === 0) return null;

  // Single highest-momentum qualifier — one focal point per load.
  const top = qualifying.reduce((best, c) =>
    Number(c.momentum_score ?? 0) > Number(best.momentum_score ?? 0) ? c : best
  );

  return {
    competitor_id:    top.competitor_id,
    competitor_name:  top.competitor_name,
    website_url:      top.website_url,
    movement_type:    top.latest_movement_type!,
    confidence:       Number(top.latest_movement_confidence!),
    signals_7d:       Number(top.signals_7d),
    momentum_score:   Number(top.momentum_score),
    last_seen_at:     top.latest_movement_last_seen_at!,
    movement_summary: top.latest_movement_summary,
    alertKey:         `${orgId ? orgId + "__" : ""}${top.competitor_id}__${top.latest_movement_last_seen_at}`,
  };
}

// ── Content helpers ────────────────────────────────────────────────────────────

export function getAlertTitle(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "Pricing strategy shift";
    case "product_expansion":      return "Product expansion accelerating";
    case "market_reposition":      return "Market repositioning confirmed";
    case "enterprise_push":        return "Enterprise push detected";
    case "ecosystem_expansion":    return "Ecosystem expansion detected";
    default:
      return movementType
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
  }
}

export function getAlertExplanation(alert: CriticalAlert): string {
  if (alert.movement_summary) return alert.movement_summary;

  const s      = alert.signals_7d;
  const sigStr = `${s} signal${s !== 1 ? "s" : ""} this week`;

  switch (alert.movement_type) {
    case "pricing_strategy_shift":
      return `${alert.competitor_name} is shifting pricing strategy — ${sigStr} detected across monitored pages.`;
    case "product_expansion":
      return `${alert.competitor_name} is expanding its product surface — ${sigStr} detected across features and changelog.`;
    case "market_reposition":
      return `${alert.competitor_name} is repositioning market messaging — ${sigStr} detected.`;
    case "enterprise_push":
      return `${alert.competitor_name} is intensifying enterprise targeting — ${sigStr} confirmed.`;
    case "ecosystem_expansion":
      return `${alert.competitor_name} is expanding its partner ecosystem — ${sigStr} detected.`;
    default:
      return `${alert.competitor_name} is showing accelerated activity — ${sigStr} detected.`;
  }
}
