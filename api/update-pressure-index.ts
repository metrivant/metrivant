import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, generateRunId } from "../lib/pipeline-metrics";

/**
 * update-pressure-index
 *
 * Computes a per-competitor pressure_index that aggregates recent signal and
 * ambient activity into a single urgency scalar. This enables early-warning
 * interpretation: competitors with high ambient activity and moderate signals
 * can trigger AI interpretation even before any individual signal crosses the
 * 0.65 confidence threshold.
 *
 * Formula:
 *   pressure_index = Σ (signal_weight × confidence × time_decay)
 *                  + ambient_events_48h × 0.15
 *   capped at 10.0
 *
 * Where:
 *   signal_weight = { high: 1.0, medium: 0.6, low: 0.3 }
 *   time_decay    = exp(-age_days × 0.2)   [halves every ~3.5 days]
 *
 * Side effect:
 *   Competitors with pressure_index >= PRESSURE_PROMOTE_THRESHOLD (5.0) have
 *   their pending_review signals promoted to pending so the interpret-signals
 *   cron will pick them up on the next run.
 */

const PRESSURE_PROMOTE_THRESHOLD  = 5.0;
const SIGNAL_WINDOW_DAYS          = 7;
const ACTIVITY_WINDOW_HOURS       = 48;
// Minimum confidence for bootstrap promotion — midpoint of the pending_review band (0.35–0.64).
// Prevents weak signals from self-promoting on fresh competitors.
const BOOTSTRAP_CONFIDENCE_FLOOR  = 0.50;

const SEVERITY_WEIGHTS: Record<string, number> = {
  high:   1.0,
  medium: 0.6,
  low:    0.3,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitorRow {
  id: string;
}

interface PageRow {
  id: string;
  competitor_id: string;
  page_class: string;
}

interface SignalRow {
  monitored_page_id: string;
  severity: string;
  confidence_score: number | null;
  detected_at: string;
}

// Ambient event type weights for pressure contribution.
// Strategic signals (press, announcements, hiring) carry more pressure weight
// than generic content churn (blog posts, page edits).
const AMBIENT_EVENT_WEIGHTS: Record<string, number> = {
  press_mention:    0.30,
  announcement:     0.25,
  hiring_activity:  0.20,
  messaging_update: 0.12,
  product_update:   0.15,
  content_update:   0.10,
  blog_post:        0.08,
  page_change:      0.08,
};
const DEFAULT_AMBIENT_WEIGHT = 0.10;

interface ActivityEventRow {
  competitor_id: string;
  event_type: string;
}

interface BootstrapCandidateRow {
  id: string;
  competitor_id: string;
  confidence_score: number;
  monitored_page_id: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "update-pressure-index",
    status: "in_progress",
  });

  try {
    // ── 1. Load all tracked competitors ───────────────────────────────────────
    // Use tracked_competitors as the population gate — not competitors.active.
    // This is the same source of truth used by radar-feed.ts and ensures that
    // pressure index updates only run for competitors users are actually watching.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trackedRows, error: compError } = await (supabase as any)
      .from("tracked_competitors")
      .select("competitor_id")
      .not("competitor_id", "is", null);

    if (compError) throw compError;

    const allCompetitors: CompetitorRow[] = [
      ...new Set(
        ((trackedRows ?? []) as { competitor_id: string }[]).map((r) => r.competitor_id)
      ),
    ].map((id) => ({ id }));

    if (allCompetitors.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "update-pressure-index", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "update-pressure-index", competitorsUpdated: 0 });
    }

    const competitorIds = allCompetitors.map((c) => c.id);

    // ── 2. Load all active monitored pages for these competitors (bulk) ────────
    const { data: pages, error: pagesError } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_class")
      .in("competitor_id", competitorIds)
      .eq("active", true);

    if (pagesError) throw pagesError;

    const pageRows = (pages ?? []) as PageRow[];
    const pageIds  = pageRows.map((p) => p.id);

    // Map: page_id → competitor_id for fast lookup.
    const pageToCompetitor = new Map<string, string>();
    for (const p of pageRows) {
      pageToCompetitor.set(p.id, p.competitor_id);
    }

    // Map: page_id → page_class for bootstrap candidate preference.
    const pageClassById = new Map<string, string>();
    for (const p of pageRows) {
      pageClassById.set(p.id, p.page_class);
    }

    // Map: competitor_id → page_ids[].
    const competitorPages = new Map<string, string[]>();
    for (const p of pageRows) {
      const arr = competitorPages.get(p.competitor_id) ?? [];
      arr.push(p.id);
      competitorPages.set(p.competitor_id, arr);
    }

    // ── 3. Bulk load recent signals ───────────────────────────────────────────
    const signalSince = new Date(
      Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: signals, error: signalsError } = pageIds.length > 0
      ? await supabase
          .from("signals")
          .select("monitored_page_id, severity, confidence_score, detected_at")
          .in("monitored_page_id", pageIds)
          .gte("detected_at", signalSince)
      : { data: [], error: null };

    if (signalsError) throw signalsError;

    // ── 3b. Load pool signals (monitored_page_id IS NULL) ────────────────────
    // Pool signals have competitor_id set directly — no page lookup needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: poolSignals, error: poolSignalsError } = await (supabase as any)
      .from("signals")
      .select("competitor_id, severity, confidence_score, detected_at")
      .is("monitored_page_id", null)
      .in("competitor_id", competitorIds)
      .gte("detected_at", signalSince);

    if (poolSignalsError) throw poolSignalsError;

    // ── 4. Bulk load recent activity events ───────────────────────────────────
    const activitySince = new Date(
      Date.now() - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: events, error: eventsError } = await supabase
      .from("activity_events")
      .select("competitor_id, event_type")
      .in("competitor_id", competitorIds)
      .gte("detected_at", activitySince);

    if (eventsError) throw eventsError;

    // ── 4b. Bootstrap gate — active signal counts per competitor ──────────────
    // "Active" = already in the interpretation pipeline (pending or interpreted).
    // Competitors with zero active signals are bootstrap candidates.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeSignalRows, error: activeSignalsError } = await (supabase as any)
      .from("signals")
      .select("competitor_id")
      .in("competitor_id", competitorIds)
      .in("status", ["pending", "interpreted"]);

    if (activeSignalsError) throw activeSignalsError;

    const activeSignalsByCompetitor = new Map<string, number>();
    for (const row of (activeSignalRows ?? []) as { competitor_id: string }[]) {
      activeSignalsByCompetitor.set(
        row.competitor_id,
        (activeSignalsByCompetitor.get(row.competitor_id) ?? 0) + 1
      );
    }

    // ── 4c. Bootstrap candidates — highest-confidence pending_review per competitor ─
    // Ordered descending so the first occurrence per competitor_id is the best candidate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bootstrapRows, error: bootstrapRowsError } = await (supabase as any)
      .from("signals")
      .select("id, competitor_id, confidence_score, monitored_page_id")
      .in("competitor_id", competitorIds)
      .eq("status", "pending_review")
      .gte("confidence_score", BOOTSTRAP_CONFIDENCE_FLOOR)
      .order("confidence_score", { ascending: false });

    if (bootstrapRowsError) throw bootstrapRowsError;

    // One candidate per competitor — prefer high_value page signals, then highest confidence.
    // A high_value page (pricing, newsroom) pending_review signal at 0.50 is more
    // strategically meaningful than an ambient page signal at 0.62.
    const bootstrapByCompetitor = new Map<string, BootstrapCandidateRow[]>();
    for (const row of (bootstrapRows ?? []) as BootstrapCandidateRow[]) {
      const arr = bootstrapByCompetitor.get(row.competitor_id) ?? [];
      arr.push(row);
      bootstrapByCompetitor.set(row.competitor_id, arr);
    }

    const bootstrapCandidates = new Map<string, BootstrapCandidateRow>();
    for (const [cid, candidates] of bootstrapByCompetitor) {
      const highValue = candidates.filter(
        (c) => pageClassById.get(c.monitored_page_id) === "high_value"
      );
      const pool = highValue.length > 0 ? highValue : candidates;
      const best = pool.reduce((a, b) => b.confidence_score > a.confidence_score ? b : a);
      bootstrapCandidates.set(cid, best);
    }

    // ── 5. Aggregate in-memory per competitor ─────────────────────────────────

    // signal weight per competitor
    const signalWeightByCompetitor = new Map<string, number>();
    for (const signal of (signals ?? []) as SignalRow[]) {
      const cid = pageToCompetitor.get(signal.monitored_page_id);
      if (!cid) continue;

      const severityW  = SEVERITY_WEIGHTS[signal.severity] ?? 0.3;
      const confidence = signal.confidence_score ?? 0.5;
      const ageDays    =
        (Date.now() - new Date(signal.detected_at).getTime()) / (24 * 60 * 60 * 1000);
      const decay      = Math.exp(-ageDays * 0.2);

      const prev = signalWeightByCompetitor.get(cid) ?? 0;
      signalWeightByCompetitor.set(cid, prev + severityW * confidence * decay);
    }

    // Merge pool signals (monitored_page_id=null, competitor_id set directly)
    for (const signal of (poolSignals ?? []) as { competitor_id: string; severity: string; confidence_score: number | null; detected_at: string }[]) {
      const cid = signal.competitor_id;
      const severityW  = SEVERITY_WEIGHTS[signal.severity] ?? 0.3;
      const confidence = signal.confidence_score ?? 0.5;
      const ageDays    = (Date.now() - new Date(signal.detected_at).getTime()) / (24 * 60 * 60 * 1000);
      const decay      = Math.exp(-ageDays * 0.2);
      const prev = signalWeightByCompetitor.get(cid) ?? 0;
      signalWeightByCompetitor.set(cid, prev + severityW * confidence * decay);
    }

    // Weighted ambient pressure per competitor.
    // Strategic events (press, announcements, hiring) carry more pressure than
    // routine content churn (blog posts, generic page edits).
    const activityWeightByCompetitor = new Map<string, number>();
    for (const ev of (events ?? []) as ActivityEventRow[]) {
      const w = AMBIENT_EVENT_WEIGHTS[ev.event_type] ?? DEFAULT_AMBIENT_WEIGHT;
      activityWeightByCompetitor.set(
        ev.competitor_id,
        (activityWeightByCompetitor.get(ev.competitor_id) ?? 0) + w
      );
    }

    // ── 6. Update pressure_index and promote pending_review signals ───────────

    let competitorsUpdated  = 0;
    let signalsPromoted     = 0;
    let bootstrapPromoted   = 0;

    for (const { id: cid } of allCompetitors) {
      const signalW    = signalWeightByCompetitor.get(cid) ?? 0;
      const activityW  = activityWeightByCompetitor.get(cid) ?? 0;
      const pressure   = Math.min(10.0, signalW + activityW);

      const { error: updateError } = await supabase
        .from("competitors")
        .update({ pressure_index: pressure })
        .eq("id", cid);

      if (updateError) {
        Sentry.captureException(updateError);
        continue;
      }

      competitorsUpdated += 1;

      // Promote pending_review signals when pressure is high enough.
      // This allows moderate-confidence signals to be interpreted when
      // the competitor is showing broad activity across multiple sources.
      if (pressure >= PRESSURE_PROMOTE_THRESHOLD) {
        const pageIdsForCompetitor = competitorPages.get(cid) ?? [];
        if (pageIdsForCompetitor.length > 0) {
          const { data: promoted, error: promoteError } = await supabase
            .from("signals")
            .update({ status: "pending" })
            .in("monitored_page_id", pageIdsForCompetitor)
            .eq("status", "pending_review")
            .eq("interpreted", false)
            .select("id");

          if (promoteError) {
            Sentry.captureException(promoteError);
          } else {
            signalsPromoted += promoted?.length ?? 0;
          }
        }
      } else {
        // Bootstrap promotion — fires only when pressure-based promotion did not trigger.
        // A competitor with no active signals and a qualifying pending_review signal
        // receives exactly one promotion per run, unblocking the interpretation pipeline
        // without requiring pressure to build first.
        const hasActiveSignals = (activeSignalsByCompetitor.get(cid) ?? 0) > 0;
        const candidate        = bootstrapCandidates.get(cid);

        if (!hasActiveSignals && candidate) {
          const { error: promotionError } = await supabase
            .from("signals")
            .update({ status: "pending" })
            .eq("id", candidate.id)
            .eq("status", "pending_review"); // safety: only promote if still pending_review

          if (promotionError) {
            Sentry.captureException(promotionError);
          } else {
            signalsPromoted  += 1;
            bootstrapPromoted += 1;
            void recordEvent({
              run_id:   runId,
              stage:    "bootstrap_promotion",
              status:   "success",
              metadata: {
                competitor_id:    cid,
                signal_id:        candidate.id,
                confidence_score: candidate.confidence_score,
                reason:           "bootstrap_exemption",
              },
            });
          }
        }
      }
    }

    // ── 7. Time-decay auto-promotion ──────────────────────────────────────────
    // Catch pending_review signals that have been waiting too long in the dead
    // zone (confidence 0.35–0.64). After 7 days with confidence >= 0.45, the
    // competitive moment has proved durable — promote to get an interpretation
    // rather than letting them expire silently at 30d via retention Tier 6.
    let timeDecayPromoted = 0;
    try {
      const decayCutoff = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: decayRows, error: decayError } = await (supabase as any)
        .from("signals")
        .select("id")
        .eq("status", "pending_review")
        .gte("confidence_score", 0.45)
        .lt("detected_at", decayCutoff)
        .limit(5);

      if (decayError) throw decayError;

      const decayIds = (decayRows ?? []).map((r: { id: string }) => r.id);
      if (decayIds.length > 0) {
        const { error: promoteError } = await supabase
          .from("signals")
          .update({ status: "pending" })
          .in("id", decayIds)
          .eq("status", "pending_review");

        if (promoteError) throw promoteError;
        timeDecayPromoted = decayIds.length;

        for (const id of decayIds) {
          void recordEvent({
            run_id:   runId,
            stage:    "time_decay_promotion",
            status:   "success",
            metadata: { signal_id: id, reason: "age_7d_confidence_045" },
          });
        }
      }
    } catch (decayErr) {
      Sentry.captureException(decayErr);
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "update-pressure-index",
      competitorsUpdated,
      signalsPromoted,
      bootstrapPromoted,
      timeDecayPromoted,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "update-pressure-index",
      status: "ok",
      checkInId,
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "update-pressure-index",
      competitorsUpdated,
      signalsPromoted,
      bootstrapPromoted,
      timeDecayPromoted,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "update-pressure-index",
      status: "error",
      checkInId,
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("update-pressure-index", handler);
