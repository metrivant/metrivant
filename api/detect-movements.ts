import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

interface SignalRow {
  id: string;
  monitored_page_id: string;
  signal_type: string;
  severity: "low" | "medium" | "high";
  detected_at: string;
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

  if (set.has("feature_launch")) {
    movements.push("product_expansion");
  }

  if (set.has("positioning_shift")) {
    movements.push("market_reposition");
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
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: signals, error: signalsError } = await supabase
      .from("signals")
      .select("id, monitored_page_id, signal_type, severity, detected_at")
      .gte("detected_at", since)
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
    }let rowsClaimed = grouped.size;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let movementsCreated = 0;

    for (const [competitorId, competitorSignals] of grouped.entries()) {
      rowsProcessed += 1;

      try {
        const signalTypes = competitorSignals.map((s) => s.signal_type);
        const movementTypes = inferMovementTypes(signalTypes);

        const signalCount = competitorSignals.length;
        const velocity =
          competitorSignals.reduce(
            (sum, s) => sum + severityWeight(s.severity),
            0
          ) / Math.max(signalCount, 1);

        const firstSeenAt = competitorSignals[0].detected_at;
        const lastSeenAt = competitorSignals[competitorSignals.length - 1].detected_at;

        for (const movementType of movementTypes) {
          const confidence = Math.min(0.95, 0.5 + signalCount * 0.1);

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