import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

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

const PRESSURE_PROMOTE_THRESHOLD = 5.0;
const SIGNAL_WINDOW_DAYS         = 7;
const ACTIVITY_WINDOW_HOURS      = 48;

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

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

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
      .select("id, competitor_id")
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
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "update-pressure-index",
      competitorsUpdated,
      signalsPromoted,
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
