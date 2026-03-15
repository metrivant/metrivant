import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";

// ── Momentum scoring ──────────────────────────────────────────────────────────
// Computes a momentum score for each competitor from their signal and movement data.
// Formula: weighted sum of recent signals + movement contribution.
//   signals_7d:   count of interpreted signals in last 7 days
//   velocity:     average severity weight across those signals (high=3, medium=2, low=1)
//   movement:     latest movement confidence bonus when movement is recent (≤14d)
//
// Score bands: cooling <1.5 | stable 1.5–3 | rising 3–5 | accelerating ≥5
//
// NULL/ZERO safety:
//   signals7d          — always a non-negative integer; defaults to 0 when no signals join
//   weightedVelocity7d — always ≥ 0 (normalised average); defaults to 0 when no signals join
//   movementConfidence — may be null (competitor has no recent movement)
//   movementLastSeenAt — may be null (no movement or movement > 14 days old)
//   movementBonus      — explicitly initialised to 0; only set when BOTH confidence and
//                        lastSeenAt are non-null AND movement is ≤ 14 days old — safe against
//                        a null movement collapsing the entire formula
//
// Minimum non-zero score for a competitor with exactly 1 low-severity signal:
//   signalComponent   = 1 * 0.4 = 0.4
//   velocityComponent = 1.0 (low=1) * 0.6 = 0.6   (velocity normalised to 1.0)
//   movementBonus     = 0 (no movement)
//   minimum score     = 1.0
//
// SCOPE: radar-feed queries ALL active competitors regardless of which org is tracking
// them. The runtime has no org context. The UI (page.tsx) receives this full set; it does
// not currently filter to the authenticated org's tracked_competitors. This is intentional
// for v1 — all active pipeline competitors are shown. When multi-tenancy requires per-org
// isolation, filtering must be added in the UI (page.tsx → getRadarFeed) or a query
// parameter must be forwarded from the UI to the runtime.

interface SignalAggRow {
  competitor_id: string;
  signals_7d: number;
  weighted_velocity_7d: number;
  last_signal_at: string | null;
}

interface CompetitorRow {
  id: string;
  name: string;
  website_url: string | null;
  last_signal_at: string | null;
}

interface MovementRow {
  competitor_id: string;
  movement_type: string;
  confidence: number | null;
  signal_count: number | null;
  velocity: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  summary: string | null;
}

function computeMomentumScore(
  signals7d: number,
  weightedVelocity7d: number,
  movementConfidence: number | null,
  movementLastSeenAt: string | null
): number {
  // Base score from signal density and velocity
  const signalComponent = signals7d * 0.4;
  const velocityComponent = weightedVelocity7d * 0.6;

  // Movement bonus: recent confirmed movement adds up to 2.5 points
  let movementBonus = 0;
  if (movementConfidence !== null && movementLastSeenAt !== null) {
    const ageMs = Date.now() - new Date(movementLastSeenAt).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays <= 14) {
      // Decay the movement bonus as it ages: full bonus at 0d, half at 7d, zero at 14d
      const decayFactor = Math.max(0, 1 - ageDays / 14);
      movementBonus = movementConfidence * 2.5 * decayFactor;
    }
  }

  return Math.min(10, signalComponent + velocityComponent + movementBonus);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();

  try {
    const limitParam = Number(req.query?.limit ?? 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // ── Step 1: Load all tracked competitors ──────────────────────────────────
    // Source of truth is now the tracking relation: a competitor is included in
    // the radar feed if and only if at least one org is tracking it via
    // tracked_competitors.competitor_id. This replaces the `active=true` boolean
    // which required explicit sync on every add/remove/clean-slate and was
    // prone to drift. `active` is kept on the table during the transition but
    // is no longer the gate for pipeline reads.

    // First resolve the set of tracked competitor IDs across all orgs.
    // `tracked_competitors` is a UI-DB table not present in the runtime's generated
    // types — cast through `any` since the same Supabase instance serves both.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trackedRows, error: trackedError } = await (supabase as any)
      .from("tracked_competitors")
      .select("competitor_id")
      .not("competitor_id", "is", null);

    if (trackedError) throw trackedError;

    const trackedIds = [...new Set(
      ((trackedRows ?? []) as { competitor_id: string }[])
        .map((r) => r.competitor_id)
        .filter(Boolean)
    )];

    if (trackedIds.length === 0) {
      return res.status(200).json({
        ok: true,
        job: "radar-feed",
        rowsReturned: 0,
        runtimeDurationMs: Date.now() - startedAt,
        data: [],
      });
    }

    const { data: competitorRows, error: compError } = await supabase
      .from("competitors")
      .select("id, name, website_url, last_signal_at")
      .in("id", trackedIds);

    if (compError) throw compError;

    const competitors = (competitorRows ?? []) as CompetitorRow[];

    const competitorIds = competitors.map((c) => c.id);

    // ── Step 2: Load all monitored pages for these competitors ────────────────
    // Needed to map signals (keyed by monitored_page_id) to competitors.
    const { data: pageRows, error: pagesError } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id")
      .in("competitor_id", competitorIds)
      .eq("active", true);

    if (pagesError) throw pagesError;

    const pageToCompetitor = new Map<string, string>();
    const competitorPageIds = new Map<string, string[]>();
    for (const p of (pageRows ?? []) as { id: string; competitor_id: string }[]) {
      pageToCompetitor.set(p.id, p.competitor_id);
      const arr = competitorPageIds.get(p.competitor_id) ?? [];
      arr.push(p.id);
      competitorPageIds.set(p.competitor_id, arr);
    }

    const allPageIds = [...pageToCompetitor.keys()];

    // ── Step 3: Aggregate signals in the last 7 days per competitor ───────────
    const signalAggMap = new Map<string, SignalAggRow>();

    if (allPageIds.length > 0) {
      // NOTE: interpreted=true is intentional — only signals that have been processed by
      // the OpenAI interpretation layer contribute to momentum_score. Uninterpreted (pending
      // or pending_review) signals exist in the DB but are not yet strategic intelligence.
      // A competitor with pending signals will show momentum_score=0 until interpretation
      // completes. This is correct behaviour: the radar reflects confirmed intelligence only.
      const { data: signalRows, error: signalsError } = await supabase
        .from("signals")
        .select("monitored_page_id, severity, detected_at")
        .in("monitored_page_id", allPageIds)
        .eq("interpreted", true)
        .gte("detected_at", since7d)
        .order("detected_at", { ascending: false });

      if (signalsError) throw signalsError;

      // Group by competitor
      for (const sig of (signalRows ?? []) as { monitored_page_id: string; severity: string; detected_at: string }[]) {
        const cid = pageToCompetitor.get(sig.monitored_page_id);
        if (!cid) continue;

        const existing = signalAggMap.get(cid) ?? {
          competitor_id: cid,
          signals_7d: 0,
          weighted_velocity_7d: 0,
          last_signal_at: null,
        };

        const severityWeight = sig.severity === "high" ? 3 : sig.severity === "medium" ? 2 : 1;
        existing.signals_7d += 1;
        existing.weighted_velocity_7d += severityWeight;

        if (!existing.last_signal_at || sig.detected_at > existing.last_signal_at) {
          existing.last_signal_at = sig.detected_at;
        }

        signalAggMap.set(cid, existing);
      }

      // Normalise weighted_velocity_7d to a per-signal average
      for (const [cid, agg] of signalAggMap) {
        if (agg.signals_7d > 0) {
          agg.weighted_velocity_7d = parseFloat(
            (agg.weighted_velocity_7d / agg.signals_7d).toFixed(3)
          );
        }
        signalAggMap.set(cid, agg);
      }
    }

    // ── Step 4: Load latest strategic movement per competitor ─────────────────
    const latestMovementMap = new Map<string, MovementRow>();

    const { data: movementRows, error: movementsError } = await supabase
      .from("strategic_movements")
      .select(
        "competitor_id, movement_type, confidence, signal_count, velocity, first_seen_at, last_seen_at, summary"
      )
      .in("competitor_id", competitorIds)
      .gte("last_seen_at", since14d)
      .order("last_seen_at", { ascending: false });

    if (movementsError) throw movementsError;

    // Keep only the most recent movement per competitor
    for (const m of (movementRows ?? []) as MovementRow[]) {
      if (!latestMovementMap.has(m.competitor_id)) {
        latestMovementMap.set(m.competitor_id, m);
      }
    }

    // ── Step 5: Assemble the radar feed rows ──────────────────────────────────
    const feedRows = competitors.map((c) => {
      const agg = signalAggMap.get(c.id);
      const movement = latestMovementMap.get(c.id) ?? null;

      const signals7d = agg?.signals_7d ?? 0;
      const weightedVelocity7d = agg?.weighted_velocity_7d ?? 0;

      // last_signal_at: prefer the denormalized column (kept up to date by DB trigger),
      // fall back to the 7d aggregation result for freshness.
      const lastSignalAt = c.last_signal_at ?? agg?.last_signal_at ?? null;

      const momentumScore = parseFloat(
        computeMomentumScore(
          signals7d,
          weightedVelocity7d,
          movement?.confidence ?? null,
          movement?.last_seen_at ?? null
        ).toFixed(3)
      );

      return {
        competitor_id:                 c.id,
        competitor_name:               c.name,
        website_url:                   c.website_url ?? null,
        signals_7d:                    signals7d,
        weighted_velocity_7d:          weightedVelocity7d,
        last_signal_at:                lastSignalAt,
        latest_movement_type:          movement?.movement_type ?? null,
        latest_movement_confidence:    movement?.confidence ?? null,
        latest_movement_signal_count:  movement?.signal_count ?? null,
        latest_movement_velocity:      movement?.velocity ?? null,
        latest_movement_first_seen_at: movement?.first_seen_at ?? null,
        latest_movement_last_seen_at:  movement?.last_seen_at ?? null,
        latest_movement_summary:       movement?.summary ?? null,
        momentum_score:                momentumScore,
      };
    });

    // Sort by momentum_score DESC, then weighted_velocity_7d DESC
    feedRows.sort((a, b) => {
      if (b.momentum_score !== a.momentum_score) {
        return b.momentum_score - a.momentum_score;
      }
      return b.weighted_velocity_7d - a.weighted_velocity_7d;
    });

    const paginatedRows = feedRows.slice(0, limit);

    // ── Observability ─────────────────────────────────────────────────────────
    // Case 1: all competitors have zero momentum — likely pipeline has not run yet
    if (paginatedRows.length > 0 && paginatedRows.every((r) => r.momentum_score === 0)) {
      Sentry.captureMessage("radar_feed_all_zero", {
        level: "warning",
        extra: {
          competitor_count: paginatedRows.length,
          note: "All competitors have momentum_score=0. Pipeline may not have produced interpreted signals yet.",
        },
      });
    }

    // Case 2: individual competitors with interpreted signals_7d > 0 but momentum_score = 0.
    // This should be mathematically impossible with the current formula (1 low signal → score ≥ 1.0)
    // but guards against future formula changes or data corruption.
    const signalsWithZeroMomentum = paginatedRows.filter(
      (r) => r.signals_7d > 0 && r.momentum_score === 0
    );
    if (signalsWithZeroMomentum.length > 0) {
      Sentry.captureMessage("radar_feed_signals_but_zero_momentum", {
        level: "warning",
        extra: {
          affected_count: signalsWithZeroMomentum.length,
          competitor_ids: signalsWithZeroMomentum.map((r) => r.competitor_id),
          note: "signals_7d > 0 but momentum_score = 0 — formula invariant violated.",
        },
      });
    }

    const runtimeDurationMs = Date.now() - startedAt;

    res.status(200).json({
      ok: true,
      job: "radar-feed",
      rowsReturned: paginatedRows.length,
      runtimeDurationMs,
      data: paginatedRows,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("radar-feed", handler);