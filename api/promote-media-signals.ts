import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { enrichClusterNarrative, NarrativeCluster, ObservationForContext } from "../lib/media-clustering";

// Maximum clusters to enrich per run (each = 1 GPT call).
// At gpt-4o-mini speed (~1s/call), 10 clusters = ~10s well within 60s timeout.
const BATCH_SIZE = 10;

// Re-enrich narratives older than 3 days if the cluster has grown (article_count changed).
// Prevents stale summaries when a cluster accumulates more articles.
const STALE_NARRATIVE_HOURS = 72;

// Wall-clock guard: maxDuration is 60s, leave 5s safety margin for final flush + response.
const WALL_CLOCK_GUARD_MS = 55_000;

// ── Main handler ──────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-media-signals", status: "in_progress" });
  const startedAt = Date.now();

  try {
    // ── Load clusters that need narrative enrichment ────────────────────────
    // Criteria: narrative_summary IS NULL (never enriched)
    //        OR narrative_generated_at is stale (>72h old, cluster may have grown)
    const staleCutoff = new Date(Date.now() - STALE_NARRATIVE_HOURS * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingRows, error: pendingError } = await (supabase as any)
      .from("sector_narratives")
      .select("id, sector, theme_label, keywords, source_count, article_count, representative_urls, first_detected_at, last_detected_at, confidence_score, narrative_generated_at")
      .or(`narrative_summary.is.null,narrative_generated_at.lt.${staleCutoff}`)
      .order("confidence_score", { ascending: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const clusters = (pendingRows ?? []) as (NarrativeCluster & { narrative_generated_at: string | null })[];

    if (clusters.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-media-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-media-signals",
        clustersProcessed: 0,
        clustersEnriched: 0,
        clustersFailed: 0,
        skippedByGuard: 0,
        runtimeDurationMs: elapsed(),
      });
    }

    // ── Process each cluster ───────────────────────────────────────────────
    let clustersEnriched = 0;
    let clustersFailed = 0;
    let skippedByGuard = 0;

    for (const cluster of clusters) {
      // Wall-clock guard: stop processing if we're approaching the timeout.
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        skippedByGuard = clusters.length - (clustersEnriched + clustersFailed);
        console.log(`wall_clock_guard: skipping ${skippedByGuard} remaining clusters`);
        break;
      }

      const clusterTimer = startTimer();

      try {
        // Load recent observations matching this cluster's keywords for context.
        // Use the cluster's sector + keyword overlap to find relevant articles.
        const windowCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: obsRows } = await (supabase as any)
          .from("media_observations")
          .select("title, source_name, published_at, url")
          .eq("sector", cluster.sector)
          .gte("published_at", windowCutoff)
          .order("published_at", { ascending: false })
          .limit(50);

        // Filter observations to those sharing at least one keyword with the cluster.
        // We can't use SQL array overlap on all DBs, so filter in TypeScript.
        const clusterKeywords = new Set(cluster.keywords.map((k) => k.toLowerCase()));
        const relevantObs: ObservationForContext[] = [];

        // We need keywords from observations but the select above doesn't include them.
        // Re-query with keywords to do the filter.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: obsWithKw } = await (supabase as any)
          .from("media_observations")
          .select("title, source_name, published_at, url, keywords")
          .eq("sector", cluster.sector)
          .gte("published_at", windowCutoff)
          .order("published_at", { ascending: false })
          .limit(50);

        for (const obs of (obsWithKw ?? []) as (ObservationForContext & { keywords: string[] })[]) {
          const obsKeywords = (obs.keywords ?? []).map((k: string) => k.toLowerCase());
          const hasOverlap = obsKeywords.some((k: string) => clusterKeywords.has(k));
          if (hasOverlap) {
            relevantObs.push({
              title: obs.title,
              source_name: obs.source_name,
              published_at: obs.published_at,
              url: obs.url,
            });
          }
          if (relevantObs.length >= 10) break;
        }

        // ── Call GPT for narrative enrichment ────────────────────────────────
        const result = await enrichClusterNarrative(cluster, relevantObs);

        // ── Update sector_narratives row ─────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("sector_narratives")
          .update({
            narrative_summary: result.narrative_summary,
            narrative_generated_at: new Date().toISOString(),
          })
          .eq("id", cluster.id);

        if (updateError) throw updateError;

        clustersEnriched++;
        void recordEvent({
          run_id: runId,
          stage: "media_promote",
          status: "success",
          duration_ms: clusterTimer(),
          metadata: {
            cluster_id: cluster.id,
            sector: cluster.sector,
            theme_label: cluster.theme_label,
            observations_used: relevantObs.length,
          },
        });
      } catch (err) {
        clustersFailed++;
        Sentry.captureException(err, {
          extra: { cluster_id: cluster.id, sector: cluster.sector, theme_label: cluster.theme_label },
        });
        void recordEvent({
          run_id: runId,
          stage: "media_promote",
          status: "failure",
          duration_ms: clusterTimer(),
          metadata: {
            cluster_id: cluster.id,
            error: err instanceof Error ? err.message : JSON.stringify(err),
          },
        });
      }
    }

    const runtimeDurationMs = elapsed();

    Sentry.captureCheckIn({ monitorSlug: "promote-media-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-media-signals",
      clustersProcessed: clusters.length,
      clustersEnriched,
      clustersFailed,
      skippedByGuard,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-media-signals", status: "error", checkInId });
    void recordEvent({
      run_id: runId,
      stage: "media_promote",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: error instanceof Error ? error.message : JSON.stringify(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-media-signals", handler);
