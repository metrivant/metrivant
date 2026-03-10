import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

type Signal = {
  id: string;
  monitored_page_id: string;
  signal_type: string;
  severity: string;
  detected_at: string;
  competitor_id: string;
};

function classifyMovements(signals: Signal[]) {
  const movements: any[] = [];

  const byCompetitor: Record<string, Signal[]> = {};

  for (const s of signals) {
    if (!byCompetitor[s.competitor_id]) {
      byCompetitor[s.competitor_id] = [];
    }
    byCompetitor[s.competitor_id].push(s);
  }

  for (const competitor_id of Object.keys(byCompetitor)) {
    const competitorSignals = byCompetitor[competitor_id];

    const featureSignals = competitorSignals.filter(
      (s) => s.signal_type === "feature_launch"
    );

    const pricingSignals = competitorSignals.filter(
      (s) => s.signal_type === "price_point_change"
    );

    const positioningSignals = competitorSignals.filter(
      (s) => s.signal_type === "positioning_shift"
    );

    if (featureSignals.length >= 2) {
      movements.push({
        competitor_id,
        movement_type: "product_expansion",
        signal_count: featureSignals.length,
        confidence: 0.7,
      });
    }

    if (pricingSignals.length >= 1) {
      movements.push({
        competitor_id,
        movement_type: "pricing_strategy_shift",
        signal_count: pricingSignals.length,
        confidence: 0.6,
      });
    }

    if (positioningSignals.length >= 1) {
      movements.push({
        competitor_id,
        movement_type: "market_reposition",
        signal_count: positioningSignals.length,
        confidence: 0.7,
      });
    }
  }

  return movements;
}

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "detect-movements",
    status: "in_progress",
  });

  try {
    const windowStart = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: signals, error } = await supabase
      .from("signals")
      .select(
        `
        id,
        monitored_page_id,
        signal_type,
        severity,
        detected_at,
        monitored_pages!inner (
          competitor_id
        )
      `
      )
      .eq("status", "interpreted")
      .gte("detected_at", windowStart);

    if (error) throw error;

    const normalizedSignals: Signal[] =
      signals?.map((s: any) => ({
        id: s.id,
        monitored_page_id: s.monitored_page_id,
        signal_type: s.signal_type,
        severity: s.severity,
        detected_at: s.detected_at,
        competitor_id: s.monitored_pages.competitor_id,
      })) || [];

    const movements = classifyMovements(normalizedSignals);

    let movementsCreated = 0;

    for (const m of movements) {
      const today = new Date().toISOString().slice(0, 10);

      const movementKey =
        m.competitor_id + "::" + m.movement_type + "::" + today;

      const velocity = m.signal_count;

      const firstSeen = new Date().toISOString();
      const lastSeen = new Date().toISOString();

      const { error: upsertError } = await supabase
        .from("strategic_movements")
        .upsert(
          {
            movement_key: movementKey,
            competitor_id: m.competitor_id,
            movement_type: m.movement_type,
            confidence: m.confidence,
            signal_count: m.signal_count,
            velocity,
            first_seen_at: firstSeen,
            last_seen_at: lastSeen,
          },
          { onConflict: "movement_key" }
        );

      if (upsertError) throw upsertError;

      movementsCreated++;
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.captureCheckIn({
      monitorSlug: "detect-movements",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-movements",
      signalsEvaluated: normalizedSignals.length,
      movementsCreated,
      runtimeDurationMs,
    });} catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "detect-movements",
      status: "error",
    });

    await Sentry.flush(2000);

    throw error;
  }
}

export default withSentry("detect-movements", handler);