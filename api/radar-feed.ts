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
  latest_signal_type: string | null;
}

interface CompetitorRow {
  id: string;
  name: string;
  website_url: string | null;
  last_signal_at: string | null;
  pressure_index: number | null;
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
  movementLastSeenAt: string | null,
  pressureIndex: number | null
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
      const decayFactor = Math.max(0, 1 - ageDays / 14);
      movementBonus = movementConfidence * 2.5 * decayFactor;
    }
  }

  // Pressure bonus: ambient activity (blog posts, hiring, press) that hasn't
  // yet produced interpreted signals still contributes up to +1.0 point.
  // Dampened heavily so pressure alone never dominates — it's an early-warning
  // signal, not a primary driver. Keeps nodes with genuine ambient activity
  // from appearing completely dead while the interpretation queue catches up.
  const pressureBonus = Math.min(1.0, (pressureIndex ?? 0) * 0.1);

  return Math.min(10, signalComponent + velocityComponent + movementBonus + pressureBonus);
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

    // org_id scoping — when provided, restrict feed to the org's tracked competitors.
    // This is the multi-tenancy gate: each org sees only the competitors it tracks.
    // At scale (1000s of orgs × 25 competitors each) this prevents the tracked_competitors
    // query from growing into a 25,000-ID IN() clause on the competitors table.
    const orgId = typeof req.query?.org_id === "string" ? req.query.org_id : null;

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // ── Step 1: Load tracked competitors ──────────────────────────────────────
    // When org_id is provided: load only that org's tracked competitors (multi-tenant).
    // When absent (legacy / internal): load all tracked competitors across orgs.
    // `tracked_competitors` is a UI-DB table not present in the runtime's generated
    // types — cast through `any` since the same Supabase instance serves both.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let trackedQuery = (supabase as any)
      .from("tracked_competitors")
      .select("competitor_id")
      .not("competitor_id", "is", null);

    if (orgId) {
      trackedQuery = trackedQuery.eq("org_id", orgId);
    }

    const { data: trackedRows, error: trackedError } = await trackedQuery;

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
      .select("id, name, website_url, last_signal_at, pressure_index")
      .in("id", trackedIds);

    if (compError) throw compError;

    const competitors = (competitorRows ?? []) as CompetitorRow[];

    const competitorIds = competitors.map((c) => c.id);

    // ── Step 2: Load all monitored pages for these competitors ────────────────
    // Needed to map signals (keyed by monitored_page_id) to competitors.
    // health_state is included to compute the coverage summary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pageRows, error: pagesError } = await (supabase as any)
      .from("monitored_pages")
      .select("id, competitor_id, health_state")
      .in("competitor_id", competitorIds)
      .eq("active", true);

    if (pagesError) throw pagesError;

    const pageToCompetitor = new Map<string, string>();
    const competitorPageIds = new Map<string, string[]>();

    // Coverage counts — aggregated from all active monitored pages in scope.
    const coverageCounts: Record<string, number> = {
      healthy: 0, blocked: 0, challenge: 0,
      degraded: 0, baseline_maturing: 0, unresolved: 0,
    };

    for (const p of (pageRows ?? []) as { id: string; competitor_id: string; health_state: string }[]) {
      pageToCompetitor.set(p.id, p.competitor_id);
      const arr = competitorPageIds.get(p.competitor_id) ?? [];
      arr.push(p.id);
      competitorPageIds.set(p.competitor_id, arr);
      const hs = p.health_state ?? "unresolved";
      coverageCounts[hs] = (coverageCounts[hs] ?? 0) + 1;
    }

    const coverageTotal = Object.values(coverageCounts).reduce((a, b) => a + b, 0);

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
        .select("monitored_page_id, severity, detected_at, signal_type")
        .in("monitored_page_id", allPageIds)
        .eq("interpreted", true)
        .gte("detected_at", since7d)
        .order("detected_at", { ascending: false });

      if (signalsError) throw signalsError;

      // Group by competitor
      for (const sig of (signalRows ?? []) as { monitored_page_id: string; severity: string; detected_at: string; signal_type: string }[]) {
        const cid = pageToCompetitor.get(sig.monitored_page_id);
        if (!cid) continue;

        const existing = signalAggMap.get(cid) ?? {
          competitor_id: cid,
          signals_7d: 0,
          weighted_velocity_7d: 0,
          last_signal_at: null,
          latest_signal_type: null,
        };

        const severityWeight = sig.severity === "high" ? 3 : sig.severity === "medium" ? 2 : 1;
        existing.signals_7d += 1;
        existing.weighted_velocity_7d += severityWeight;

        if (!existing.last_signal_at || sig.detected_at > existing.last_signal_at) {
          existing.last_signal_at = sig.detected_at;
          existing.latest_signal_type = sig.signal_type;
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

    // ── Step 4: Count pending + pending_review signals per competitor ─────────
    // Not used in momentum_score (radar reflects confirmed intelligence only)
    // but surfaced in the payload so the UI can show a subtle "processing"
    // indicator on nodes with queued signals that haven't reached the radar yet.
    const pendingCountMap = new Map<string, number>(); // competitor_id → pending count

    if (allPageIds.length > 0) {
      const { data: pendingRows, error: pendingError } = await supabase
        .from("signals")
        .select("monitored_page_id")
        .in("monitored_page_id", allPageIds)
        .in("status", ["pending", "pending_review"])
        .eq("interpreted", false);

      if (pendingError) throw pendingError;

      for (const row of (pendingRows ?? []) as { monitored_page_id: string }[]) {
        const cid = pageToCompetitor.get(row.monitored_page_id);
        if (!cid) continue;
        pendingCountMap.set(cid, (pendingCountMap.get(cid) ?? 0) + 1);
      }
    }

    // ── Step 6: Load latest strategic movement per competitor ─────────────────
    // (Step 7: narratives loaded below, Step 8: assembly)
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

    // ── Step 7: Load latest narrative per competitor ──────────────────────────
    // radar_narratives is append-only. We bulk-fetch ordered by created_at DESC
    // and take the first row per competitor in code.
    const narrativeMap = new Map<string, { narrative: string; signal_count: number; generation_reason: string | null }>();

    if (competitorIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: narrativeRows } = await (supabase as any)
        .from("radar_narratives")
        .select("competitor_id, narrative, signal_count, created_at, generation_reason")
        .in("competitor_id", competitorIds)
        .order("created_at", { ascending: false })
        .limit(competitorIds.length * 2); // 2 most recent per competitor is sufficient

      for (const n of (narrativeRows ?? []) as {
        competitor_id:     string;
        narrative:         string;
        signal_count:      number;
        generation_reason: string | null;
      }[]) {
        if (!narrativeMap.has(n.competitor_id)) {
          narrativeMap.set(n.competitor_id, {
            narrative:         n.narrative,
            signal_count:      n.signal_count,
            generation_reason: n.generation_reason ?? null,
          });
        }
      }
    }

    // ── Step 7.6: Interpretation summaries for signal-only competitors ────────
    // For competitors with interpreted signals but no confirmed movement, surface
    // the latest interpretation summary in the feed so the UI can display
    // something meaningful without requiring a competitor-detail API call.
    const interpretationSummaryMap = new Map<string, string>();

    const noMovementWithSignals = competitorIds.filter(
      (id) => (signalAggMap.get(id)?.signals_7d ?? 0) > 0 && !latestMovementMap.has(id)
    );

    if (noMovementWithSignals.length > 0) {
      // Most recent interpreted signal ID per competitor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: latestSigRows } = await (supabase as any)
        .from("signals")
        .select("id, competitor_id")
        .in("competitor_id", noMovementWithSignals)
        .eq("interpreted", true)
        .gte("detected_at", since7d)
        .order("detected_at", { ascending: false })
        .limit(noMovementWithSignals.length);

      const latestSignalIdByCompetitor = new Map<string, string>();
      for (const s of (latestSigRows ?? []) as { id: string; competitor_id: string }[]) {
        if (!latestSignalIdByCompetitor.has(s.competitor_id)) {
          latestSignalIdByCompetitor.set(s.competitor_id, s.id);
        }
      }

      const signalIds = [...latestSignalIdByCompetitor.values()];
      if (signalIds.length > 0) {
        const { data: interpRows } = await supabase
          .from("interpretations")
          .select("signal_id, summary")
          .in("signal_id", signalIds);

        for (const i of (interpRows ?? []) as { signal_id: string; summary: string | null }[]) {
          if (!i.summary) continue;
          for (const [cid, sid] of latestSignalIdByCompetitor) {
            if (sid === i.signal_id) {
              interpretationSummaryMap.set(cid, i.summary);
              break;
            }
          }
        }
      }
    }

    // ── Step 7.5: Load trail positions per competitor ─────────────────────────
    // Reads up to 7 historical SVG position snapshots per competitor (last 28d).
    // Recorded by radar-ui after each layout computation (max ~4 snapshots/day per org).
    // Only runs when orgId is present — legacy/no-org mode returns empty trails.
    const trailMap = new Map<string, Array<{ x: number; y: number; created_at: string }>>();

    if (orgId && competitorIds.length > 0) {
      const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: trailRows } = await (supabase as any)
        .from("radar_positions")
        .select("competitor_id, x, y, created_at")
        .eq("org_id", orgId)
        .in("competitor_id", competitorIds)
        .gte("created_at", since28d)
        .order("created_at", { ascending: false })
        .limit(competitorIds.length * 8); // ceiling: 8 rows × N competitors

      for (const row of (trailRows ?? []) as {
        competitor_id: string;
        x: number;
        y: number;
        created_at: string;
      }[]) {
        const pts = trailMap.get(row.competitor_id) ?? [];
        if (pts.length < 7) {
          pts.push({ x: Number(row.x), y: Number(row.y), created_at: row.created_at });
          trailMap.set(row.competitor_id, pts);
        }
      }
    }

    // ── Step 8: Assemble the radar feed rows ──────────────────────────────────
    const feedRows = competitors.map((c) => {
      const agg = signalAggMap.get(c.id);
      const movement = latestMovementMap.get(c.id) ?? null;

      const signals7d = agg?.signals_7d ?? 0;
      const weightedVelocity7d = agg?.weighted_velocity_7d ?? 0;

      // last_signal_at: prefer the denormalized column (kept up to date by DB trigger),
      // fall back to the 7d aggregation result for freshness.
      const lastSignalAt = c.last_signal_at ?? agg?.last_signal_at ?? null;

      const pressureIndex = c.pressure_index ?? 0;

      const momentumScore = parseFloat(
        computeMomentumScore(
          signals7d,
          weightedVelocity7d,
          movement?.confidence ?? null,
          movement?.last_seen_at ?? null,
          pressureIndex
        ).toFixed(3)
      );

      return {
        competitor_id:                 c.id,
        competitor_name:               c.name,
        website_url:                   c.website_url ?? null,
        signals_7d:                    signals7d,
        signals_pending:               pendingCountMap.get(c.id) ?? 0,
        weighted_velocity_7d:          weightedVelocity7d,
        last_signal_at:                lastSignalAt,
        pressure_index:                pressureIndex,
        latest_movement_type:          movement?.movement_type ?? null,
        latest_movement_confidence:    movement?.confidence ?? null,
        latest_movement_signal_count:  movement?.signal_count ?? null,
        latest_movement_velocity:      movement?.velocity ?? null,
        latest_movement_first_seen_at: movement?.first_seen_at ?? null,
        latest_movement_last_seen_at:  movement?.last_seen_at ?? null,
        latest_movement_summary:       movement?.summary ?? null,
        latest_signal_type:            agg?.latest_signal_type ?? null,
        momentum_score:                momentumScore,
        radar_narrative:                    narrativeMap.get(c.id)?.narrative           ?? null,
        radar_narrative_signal_count:       narrativeMap.get(c.id)?.signal_count        ?? null,
        radar_narrative_generation_reason:  narrativeMap.get(c.id)?.generation_reason   ?? null,
        latest_interpretation_summary:      interpretationSummaryMap.get(c.id)          ?? null,
        trail: (trailMap.get(c.id) ?? []).map((r) => ({
          x: r.x,
          y: r.y,
          timestamp: r.created_at,
        })),
      };
    });

    // Sort: momentum_score DESC → weighted_velocity_7d DESC → pressure_index DESC
    // pressure_index as tiebreaker surfaces actively-monitored competitors with
    // ambient activity over completely quiet ones with identical signal scores.
    feedRows.sort((a, b) => {
      if (b.momentum_score !== a.momentum_score) return b.momentum_score - a.momentum_score;
      if (b.weighted_velocity_7d !== a.weighted_velocity_7d) return b.weighted_velocity_7d - a.weighted_velocity_7d;
      return (b.pressure_index ?? 0) - (a.pressure_index ?? 0);
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
      coverage: {
        total:            coverageTotal,
        healthy:          coverageCounts.healthy,
        blocked:          coverageCounts.blocked,
        challenge:        coverageCounts.challenge,
        degraded:         coverageCounts.degraded,
        baseline_maturing: coverageCounts.baseline_maturing,
        unresolved:       coverageCounts.unresolved,
      },
      data: paginatedRows,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("radar-feed", handler);