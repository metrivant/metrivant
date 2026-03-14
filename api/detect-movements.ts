import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

interface SignalRow {
  id: string;
  monitored_page_id: string;
  signal_type: string;
  severity: "low" | "medium" | "high";
  detected_at: string;
  confidence_score: number | null;
}

interface PageRow {
  id: string;
  competitor_id: string;
  page_type: string;
}

function severityWeight(severity: "low" | "medium" | "high"): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function inferMovementTypes(signalTypes: string[]): string[] {
  const set = new Set(signalTypes);
  const movements: string[] = [];

  if (set.has("price_point_change") || set.has("tier_change")) {
    movements.push("pricing_strategy_shift");
  }

  if (set.has("feature_launch") || set.has("hiring_surge")) {
    movements.push("product_expansion");
  }

  if (set.has("positioning_shift")) {
    movements.push("market_reposition");
  }

  // content_change is the fallback for unclassified section types.
  // Map to ecosystem_expansion only when no specific movement was inferred —
  // avoids inflating product_expansion with low-signal generic changes.
  if (set.has("content_change") && movements.length === 0) {
    movements.push("ecosystem_expansion");
  }

  return movements;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "detect-movements",
    status: "in_progress",
  });

  try {
    // 14-day window: tighter than 30d to surface active movements rather than
    // stale clusters. Noise floor: exclude signals with confidence < 0.40.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: signals, error: signalsError } = await supabase
      .from("signals")
      .select("id, monitored_page_id, signal_type, severity, detected_at, confidence_score")
      .gte("detected_at", since)
      .eq("interpreted", true)
      .or("confidence_score.is.null,confidence_score.gte.0.40")
      .order("detected_at", { ascending: true });

    if (signalsError) throw signalsError;

    const signalRows = (signals ?? []) as SignalRow[];
    const monitoredPageIds = [...new Set(signalRows.map((s) => s.monitored_page_id))];

    const { data: pages, error: pagesError } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("id", monitoredPageIds);

    if (pagesError) throw pagesError;

    const pageMap = new Map<string, PageRow>();
    for (const page of (pages ?? []) as PageRow[]) {
      pageMap.set(page.id, page);
    }

    const grouped = new Map<string, SignalRow[]>();

    for (const signal of signalRows) {
      const page = pageMap.get(signal.monitored_page_id);
      if (!page) continue;

      const key = page.competitor_id;
      const arr = grouped.get(key) ?? [];
      arr.push(signal);
      grouped.set(key, arr);
    }

    let rowsClaimed = grouped.size;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let movementsCreated = 0;

    for (const [competitorId, competitorSignals] of grouped.entries()) {
      rowsProcessed += 1;

      try {
        const signalCount = competitorSignals.length;

        // Require at least 2 signals to form a movement — a single signal is
        // not enough evidence to declare a strategic direction.
        if (signalCount < 2) {
          rowsSucceeded += 1;
          continue;
        }

        const signalTypes = competitorSignals.map((s) => s.signal_type);
        const movementTypes = inferMovementTypes(signalTypes);

        const velocity =
          competitorSignals.reduce(
            (sum, s) => sum + severityWeight(s.severity),
            0
          ) / Math.max(signalCount, 1);

        const firstSeenAt = competitorSignals[0].detected_at;
        const lastSeenAt = competitorSignals[competitorSignals.length - 1].detected_at;

        // Confidence-weighted formula: rewards both signal quality (avgConf) and
        // signal volume (count), with diminishing returns above 6 signals.
        const confidenceScores = competitorSignals
          .map((s) => s.confidence_score ?? 0.5);
        const avgConf =
          confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
        const movementConfidence = Math.min(0.95, avgConf * 0.65 + Math.min(signalCount, 6) * 0.06);

        for (const movementType of movementTypes) {
          const confidence = movementConfidence;

          // Upsert on (competitor_id, movement_type) to prevent unbounded duplicate rows
          // across cron cycles. first_seen_at is included on insert; on conflict it is
          // overwritten with the oldest signal in the current 30-day detection window,
          // which correctly reflects the active signal cluster.
          const { error: upsertError } = await supabase
            .from("strategic_movements")
            .upsert(
              {
                competitor_id: competitorId,
                movement_type: movementType,
                confidence,
                signal_count: signalCount,
                velocity,
                first_seen_at: firstSeenAt,
                last_seen_at: lastSeenAt,
                summary: movementType.replace(/_/g, " "),
              },
              { onConflict: "competitor_id,movement_type" }
            );

          if (upsertError) throw upsertError;
          movementsCreated += 1;
        }

        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      movementsCreated,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "detect-movements",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-movements",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      movementsCreated,
      runtimeDurationMs,
    });
  } catch (error) {
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