import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// ── /api/retry-failed-stages ──────────────────────────────────────────────────
// Hourly cron (:50): checks pipeline_events for recent failures and retries
// the failed handler via HTTP. Max 1 retry per handler per hour.
//
// Only retries transient failures (last 2 hours). Persistent failures are
// handled by Sentry alerting. This catches network timeouts, cold start
// failures, and temporary Supabase connection issues.

const FAILURE_WINDOW_HOURS = 2;
const MAX_RETRIES_PER_RUN = 3;

// Map pipeline_events stage names to API paths
const STAGE_TO_PATH: Record<string, string> = {
  "fetch-snapshots":    "/api/fetch-snapshots",
  "extract-sections":   "/api/extract-sections",
  "build-baselines":    "/api/build-baselines",
  "detect-diffs":       "/api/detect-diffs",
  "detect-signals":     "/api/detect-signals",
  "interpret-signals":  "/api/interpret-signals",
  signal:               "/api/detect-signals",
  interpret:            "/api/interpret-signals",
  feed_promote:         "/api/promote-feed-signals",
  careers_promote:      "/api/promote-careers-signals",
  investor_promote:     "/api/promote-investor-signals",
  product_promote:      "/api/promote-product-signals",
  procurement_promote:  "/api/promote-procurement-signals",
  regulatory_promote:   "/api/promote-regulatory-signals",
};

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "retry-failed-stages", status: "in_progress" });

  try {
    const windowCutoff = new Date(Date.now() - FAILURE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    // Load recent failures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: failRows, error: failErr } = await (supabase as any)
      .from("pipeline_events")
      .select("stage, created_at")
      .eq("status", "failure")
      .gte("created_at", windowCutoff)
      .order("created_at", { ascending: false })
      .limit(50);

    if (failErr) throw failErr;

    const failures = (failRows ?? []) as { stage: string; created_at: string }[];

    // Deduplicate: only retry each stage once per run
    const stagesToRetry = new Set<string>();
    for (const f of failures) {
      if (STAGE_TO_PATH[f.stage]) {
        stagesToRetry.add(f.stage);
      }
    }

    // Also check for recent successes — don't retry if the stage already recovered
    const stagesToCheck = [...stagesToRetry];
    const alreadyRecovered = new Set<string>();

    for (const stage of stagesToCheck) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: successRows } = await (supabase as any)
        .from("pipeline_events")
        .select("stage")
        .eq("stage", stage)
        .eq("status", "success")
        .gte("created_at", windowCutoff)
        .limit(1);

      if (successRows && successRows.length > 0) {
        alreadyRecovered.add(stage);
      }
    }

    // Remove already-recovered stages
    for (const stage of alreadyRecovered) {
      stagesToRetry.delete(stage);
    }

    // Retry up to MAX_RETRIES_PER_RUN stages
    const toRetry = [...stagesToRetry].slice(0, MAX_RETRIES_PER_RUN);
    let retriesAttempted = 0;
    let retriesSucceeded = 0;

    const runtimeUrl = process.env.RUNTIME_URL ?? `https://${process.env.VERCEL_URL}`;
    const cronSecret = process.env.CRON_SECRET;

    for (const stage of toRetry) {
      const apiPath = STAGE_TO_PATH[stage];
      if (!apiPath || !cronSecret) continue;

      retriesAttempted++;
      try {
        const retryRes = await fetch(`${runtimeUrl}${apiPath}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${cronSecret}` },
        });

        if (retryRes.ok) {
          retriesSucceeded++;
        }

        void recordEvent({
          run_id: runId,
          stage: "cron_retry",
          status: retryRes.ok ? "success" : "failure",
          metadata: { retried_stage: stage, api_path: apiPath, http_status: retryRes.status },
        });
      } catch (err) {
        void recordEvent({
          run_id: runId,
          stage: "cron_retry",
          status: "failure",
          metadata: { retried_stage: stage, error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    void recordEvent({
      run_id: runId,
      stage: "retry_failed_stages",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        failures_detected: failures.length,
        already_recovered: alreadyRecovered.size,
        retries_attempted: retriesAttempted,
        retries_succeeded: retriesSucceeded,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "retry-failed-stages", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "retry-failed-stages",
      failuresDetected: failures.length,
      alreadyRecovered: alreadyRecovered.size,
      retriesAttempted,
      retriesSucceeded,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "retry-failed-stages", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("retry-failed-stages", handler);
