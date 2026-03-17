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

// Time-weighted velocity: signals in the last 3 days carry full weight,
// 3–7d carry 0.7, 7–14d carry 0.4. This makes velocity reflect acceleration
// (a recent burst) rather than a flat average over the full detection window.
function computeVelocity(signals: SignalRow[]): number {
  const now = Date.now();
  let weightedSum = 0;
  let timeWeightSum = 0;

  for (const s of signals) {
    const ageDays = (now - new Date(s.detected_at).getTime()) / (24 * 60 * 60 * 1000);
    const timeWeight = ageDays <= 3 ? 1.0 : ageDays <= 7 ? 0.7 : 0.4;
    weightedSum  += severityWeight(s.severity) * timeWeight;
    timeWeightSum += timeWeight;
  }

  return timeWeightSum > 0 ? parseFloat((weightedSum / timeWeightSum).toFixed(3)) : 0;
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

  // content_change is the fallback for unclassified section types. A cluster
  // of *only* content_change signals carries no real strategic intelligence —
  // skip movement declaration entirely. The competitor still appears on the
  // radar via momentum_score from their signals_7d count.
  // (Previously mapped to ecosystem_expansion, which polluted the movement layer
  // with low-signal noise.)

  return movements;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "detect-movements", status: "in_progress" });

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
      .order("detected_at", { ascending: true })
      .limit(1000);

    if (signalsError) throw signalsError;

    const signalRows = (signals ?? []) as SignalRow[];

    if (signalRows.length >= 1000) {
      Sentry.addBreadcrumb({
        message: "detect-movements: signal query hit limit(1000) — some signals may be excluded",
        level: "warning",
        data: { count: signalRows.length },
      });
    }

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
      const arr = grouped.get(page.competitor_id) ?? [];
      arr.push(signal);
      grouped.set(page.competitor_id, arr);
    }

    // ── Batch-load interpretation strategic implications ──────────────────────
    // Used to populate the deterministic movement summary with the most recent
    // signal's strategic implication rather than a raw movement_type label.
    // One bulk query for all signal IDs — no per-competitor round-trip.
    const allSignalIds      = signalRows.map((s) => s.id);
    const interpretationMap = new Map<string, string>(); // signal_id → strategic_implication

    if (allSignalIds.length > 0) {
      const { data: interpretations } = await supabase
        .from("interpretations")
        .select("signal_id, strategic_implication")
        .in("signal_id", allSignalIds);

      for (const row of (interpretations ?? []) as { signal_id: string; strategic_implication: string }[]) {
        if (row.strategic_implication) interpretationMap.set(row.signal_id, row.strategic_implication);
      }
    }

    const rowsClaimed = grouped.size;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let movementsCreated = 0;
    let movementsSkippedNoType = 0;

    for (const [competitorId, competitorSignals] of grouped.entries()) {
      rowsProcessed += 1;

      try {
        const signalCount = competitorSignals.length;

        if (signalCount < 2) {
          rowsSucceeded += 1;
          continue;
        }

        const signalTypes = competitorSignals.map((s) => s.signal_type);
        const movementTypes = inferMovementTypes(signalTypes);

        // No declarable movement type — all signals are content_change fallback.
        // Skip movement creation; competitor is still visible on radar via momentum_score.
        if (movementTypes.length === 0) {
          movementsSkippedNoType += 1;
          rowsSucceeded += 1;
          continue;
        }

        const velocity = computeVelocity(competitorSignals);

        const firstSeenAt = competitorSignals[0].detected_at;
        const lastSeenAt  = competitorSignals[competitorSignals.length - 1].detected_at;

        const confidenceScores = competitorSignals.map((s) => s.confidence_score ?? 0.5);
        const avgConf = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
        const movementConfidence = Math.min(0.95, avgConf * 0.65 + Math.min(signalCount, 6) * 0.06);

        // ── Deterministic summary ─────────────────────────────────────────────
        // Uses the most recent signal's strategic implication when available,
        // otherwise falls back to the movement_type label.
        // AI narrative synthesis runs separately in synthesize-movement-narratives.
        const mostRecentSignal = competitorSignals[competitorSignals.length - 1];
        const deterministicSummary =
          interpretationMap.get(mostRecentSignal.id) ??
          movementTypes[0].replace(/_/g, " ");

        for (const movementType of movementTypes) {
          // ── Preserve first_seen_at on update ─────────────────────────────────
          // Step 1: upsert with ignoreDuplicates=true — inserts new rows (setting
          // first_seen_at) and does nothing on conflict (preserving it).
          // Step 2: update mutable fields unconditionally — never touches first_seen_at.
          // This replaces a plain upsert which overwrote first_seen_at every cycle.
          const { error: upsertError } = await supabase
            .from("strategic_movements")
            .upsert(
              {
                competitor_id: competitorId,
                movement_type: movementType,
                confidence:    movementConfidence,
                signal_count:  signalCount,
                velocity,
                first_seen_at: firstSeenAt,
                last_seen_at:  lastSeenAt,
                summary:       deterministicSummary,
              },
              { onConflict: "competitor_id,movement_type", ignoreDuplicates: true }
            );

          if (upsertError) throw upsertError;

          const { error: updateError } = await supabase
            .from("strategic_movements")
            .update({
              confidence:   movementConfidence,
              signal_count: signalCount,
              velocity,
              last_seen_at: lastSeenAt,
              summary:      deterministicSummary,
            })
            .eq("competitor_id", competitorId)
            .eq("movement_type", movementType);

          if (updateError) throw updateError;

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
      stage_name: "detect-movements",
      batch_size: rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      movementsCreated,
      movementsSkippedNoType,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "detect-movements", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-movements",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      movementsCreated,
      movementsSkippedNoType,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "detect-movements", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-movements", handler);
