import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId, serializeError } from "../lib/pipeline-metrics";

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
      .select("id, competitor_id, health_state")
      .eq("active", true)
      .in("competitor_id", competitorIds);

    const pages = (pageRows ?? []) as { id: string; competitor_id: string; health_state: string | null }[];

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

    // ── Pre-load pipeline stage data for diagnosis ──────────────────────
    // For stale competitors with healthy pages, diagnose WHERE the pipeline is stuck.
    const pageIds: string[] = [];
    for (const p of pages) pageIds.push(p.id);

    // Recent snapshots per page (last 14d)
    const { data: snapRows } = await supabase
      .from("snapshots")
      .select("monitored_page_id, sections_extracted")
      .gte("fetched_at", windowCutoff)
      .in("monitored_page_id", pageIds.slice(0, 200));

    const snapCounts = new Map<string, { total: number; extracted: number }>();
    for (const s of (snapRows ?? []) as { monitored_page_id: string; sections_extracted: boolean }[]) {
      const stats = snapCounts.get(s.monitored_page_id) ?? { total: 0, extracted: 0 };
      stats.total++;
      if (s.sections_extracted) stats.extracted++;
      snapCounts.set(s.monitored_page_id, stats);
    }

    // Recent diffs per page (last 14d)
    const { data: diffRows } = await supabase
      .from("section_diffs")
      .select("monitored_page_id, signal_detected")
      .gte("last_seen_at", windowCutoff)
      .in("monitored_page_id", pageIds.slice(0, 200));

    const diffCounts = new Map<string, { total: number; signalDetected: number }>();
    for (const d of (diffRows ?? []) as { monitored_page_id: string; signal_detected: boolean }[]) {
      const stats = diffCounts.get(d.monitored_page_id) ?? { total: 0, signalDetected: 0 };
      stats.total++;
      if (d.signal_detected) stats.signalDetected++;
      diffCounts.set(d.monitored_page_id, stats);
    }

    // ── Classify + diagnose + repair each competitor ─────────────────────
    let staleCount = 0;
    let deadCount = 0;
    let autoRepaired = 0;
    const staleCompetitors: string[] = [];
    const deadCompetitors: string[] = [];

    for (const comp of competitors) {
      const stats = pageStats.get(comp.id);
      if (!stats || stats.total === 0) continue;

      const signals = signalCounts.get(comp.id) ?? 0;
      if (signals > 0) continue;

      if (stats.healthy > 0) {
        staleCount++;
        staleCompetitors.push(comp.name);

        // ── Auto-diagnosis: find which pipeline stage is stuck ──────────
        const compPages = pages.filter((p) => p.competitor_id === comp.id);
        let diagnosis = "unknown";
        let repairAttempted = false;

        // Check snapshots: are pages being fetched?
        const hasSnapshots = compPages.some((p) => {
          const sc = snapCounts.get(p.id);
          return sc && sc.total > 0;
        });

        if (!hasSnapshots) {
          diagnosis = "no_snapshots_14d";
          // Repair: reset last_fetched_at to force re-fetch on next cycle
          for (const p of compPages) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("monitored_pages")
              .update({ last_fetched_at: null })
              .eq("id", p.id);
          }
          repairAttempted = true;
          autoRepaired++;
        } else {
          // Check extraction: are sections being extracted?
          const hasExtraction = compPages.some((p) => {
            const sc = snapCounts.get(p.id);
            return sc && sc.extracted > 0;
          });

          if (!hasExtraction) {
            diagnosis = "snapshots_not_extracted";
            // Repair: mark latest snapshots as not extracted to re-queue
            for (const p of compPages) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from("snapshots")
                .update({ sections_extracted: false })
                .eq("monitored_page_id", p.id)
                .gte("fetched_at", windowCutoff)
                .limit(3);
            }
            repairAttempted = true;
            autoRepaired++;
          } else {
            // Check diffs: are any diffs being produced?
            const hasDiffs = compPages.some((p) => {
              const dc = diffCounts.get(p.id);
              return dc && dc.total > 0;
            });

            if (!hasDiffs) {
              diagnosis = "no_diffs_produced";
              // Possible cause: baselines are stale. Reset them to force new baseline cycle.
              for (const p of compPages) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any)
                  .from("section_baselines")
                  .delete()
                  .eq("monitored_page_id", p.id);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any)
                  .from("monitored_pages")
                  .update({ health_state: "baseline_maturing" })
                  .eq("id", p.id);
              }
              repairAttempted = true;
              autoRepaired++;
            } else {
              // Diffs exist but no signals — everything is noise-suppressed or below confidence
              diagnosis = "diffs_exist_all_suppressed";
              // No auto-repair for this — it's working correctly, just no meaningful changes
            }
          }
        }

        Sentry.captureMessage("stale_competitor", {
          level: "warning",
          extra: {
            competitor_id: comp.id,
            competitor_name: comp.name,
            active_pages: stats.total,
            healthy_pages: stats.healthy,
            last_signal_at: comp.last_signal_at,
            window_days: STALE_WINDOW_DAYS,
            diagnosis,
            repair_attempted: repairAttempted,
          },
        });
      } else {
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
        auto_repaired: autoRepaired,
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
      autoRepaired: autoRepaired,
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
      metadata: { error: serializeError(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-stale-competitors", handler);
