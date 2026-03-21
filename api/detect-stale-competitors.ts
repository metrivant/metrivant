import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// A competitor is "stale" if they have zero signals in this window
// despite having active monitored pages.
const STALE_WINDOW_DAYS = 14;

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "detect-stale-competitors", status: "in_progress" });

  try {
    const windowCutoff = new Date(Date.now() - STALE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // ── Load all competitors with active monitored pages ──────────────────
    const { data: competitorRows, error: compError } = await supabase
      .from("competitors")
      .select("id, name, last_signal_at");

    if (compError) throw compError;

    const competitors = (competitorRows ?? []) as { id: string; name: string; last_signal_at: string | null }[];

    if (competitors.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "detect-stale-competitors", status: "ok", checkInId });
      return res.status(200).json({ ok: true, job: "detect-stale-competitors", competitors: 0, stale: 0, dead: 0 });
    }

    // ── Load active page counts + health states per competitor ────────────
    const competitorIds = competitors.map((c) => c.id);

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("competitor_id, health_state")
      .eq("active", true)
      .in("competitor_id", competitorIds);

    const pages = (pageRows ?? []) as { competitor_id: string; health_state: string | null }[];

    // Build per-competitor page stats
    const pageStats = new Map<string, { total: number; healthy: number }>();
    for (const p of pages) {
      const stats = pageStats.get(p.competitor_id) ?? { total: 0, healthy: 0 };
      stats.total++;
      if (p.health_state === "healthy" || p.health_state === "baseline_maturing" || !p.health_state) {
        stats.healthy++;
      }
      pageStats.set(p.competitor_id, stats);
    }

    // ── Load signal counts per competitor in the window ───────────────────
    const { data: signalRows } = await supabase
      .from("signals")
      .select("competitor_id")
      .gte("detected_at", windowCutoff)
      .in("competitor_id", competitorIds);

    const signalCounts = new Map<string, number>();
    for (const s of (signalRows ?? []) as { competitor_id: string }[]) {
      signalCounts.set(s.competitor_id, (signalCounts.get(s.competitor_id) ?? 0) + 1);
    }

    // ── Classify each competitor ─────────────────────────────────────────
    let staleCount = 0;
    let deadCount = 0;
    const staleCompetitors: string[] = [];
    const deadCompetitors: string[] = [];

    for (const comp of competitors) {
      const stats = pageStats.get(comp.id);
      if (!stats || stats.total === 0) continue; // no active pages — skip

      const signals = signalCounts.get(comp.id) ?? 0;
      if (signals > 0) continue; // producing signals — healthy

      if (stats.healthy > 0) {
        // Has healthy pages but no signals → stale (something wrong in pipeline for this competitor)
        staleCount++;
        staleCompetitors.push(comp.name);
        Sentry.captureMessage("stale_competitor", {
          level: "warning",
          extra: {
            competitor_id: comp.id,
            competitor_name: comp.name,
            active_pages: stats.total,
            healthy_pages: stats.healthy,
            last_signal_at: comp.last_signal_at,
            window_days: STALE_WINDOW_DAYS,
          },
        });
      } else {
        // All pages are non-healthy → coverage dead
        deadCount++;
        deadCompetitors.push(comp.name);
        Sentry.captureMessage("competitor_coverage_dead", {
          level: "warning",
          extra: {
            competitor_id: comp.id,
            competitor_name: comp.name,
            active_pages: stats.total,
            healthy_pages: 0,
            last_signal_at: comp.last_signal_at,
          },
        });
      }
    }

    void recordEvent({
      run_id: runId,
      stage: "stale_competitor_check",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        competitors_checked: competitors.length,
        stale: staleCount,
        dead: deadCount,
        stale_names: staleCompetitors.slice(0, 10),
        dead_names: deadCompetitors.slice(0, 10),
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "detect-stale-competitors", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-stale-competitors",
      competitors: competitors.length,
      stale: staleCount,
      dead: deadCount,
      staleCompetitors: staleCompetitors.slice(0, 20),
      deadCompetitors: deadCompetitors.slice(0, 20),
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "detect-stale-competitors", status: "error", checkInId });
    void recordEvent({
      run_id: runId,
      stage: "stale_competitor_check",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-stale-competitors", handler);
