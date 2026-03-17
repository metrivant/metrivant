// ── /api/watchdog ─────────────────────────────────────────────────────────────
// Vercel cron: every 15 minutes
//
// Checks freshness of critical pipeline stages by querying pipeline_events.
// If a stage has not executed within its threshold, sends a Sentry warning.
//
// IMPORTANT: Read-only. Does NOT modify data, trigger jobs, or repair state.
//
// Stage freshness sources:
//   snapshot  → pipeline_events (stage='snapshot')       threshold: 60 min
//   extract   → pipeline_events (stage='extract')        threshold: 30 min
//   diff      → pipeline_events (stage='diff')           threshold: 30 min
//   signal    → pipeline_events (stage='signal')         threshold: 30 min
//   interpret → pipeline_events (stage='interpret')      threshold: 60 min
//   baseline  → section_baselines table (fallback —      threshold: 30 min
//               build-baselines does not write pipeline_events)

import "../lib/sentry";
import { Sentry } from "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

const MONITOR_SLUG = "watchdog";

// Stages that write to pipeline_events (preferred freshness source)
const PIPELINE_STAGES: Array<{ stage: string; thresholdMinutes: number }> = [
  { stage: "snapshot",  thresholdMinutes: 60 },
  { stage: "extract",   thresholdMinutes: 30 },
  { stage: "diff",      thresholdMinutes: 30 },
  { stage: "signal",    thresholdMinutes: 30 },
  { stage: "interpret", thresholdMinutes: 60 },
];

async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  if (!verifyCronSecret(req, res)) return;

  const checkInId = Sentry.captureCheckIn({ monitorSlug: MONITOR_SLUG, status: "in_progress" });

  try {
    const now       = Date.now();
    const staleStages: string[] = [];

    // ── Check pipeline_events stages ──────────────────────────────────────────
    for (const { stage, thresholdMinutes } of PIPELINE_STAGES) {
      const cutoff = new Date(now - thresholdMinutes * 60 * 1000).toISOString();

      // Any row for this stage within the threshold window → healthy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: recentRows, error: recentErr } = await (supabase as any)
        .from("pipeline_events")
        .select("created_at")
        .eq("stage", stage)
        .gte("created_at", cutoff)
        .limit(1);

      if (recentErr) {
        // Query failure — do not fire a false stale alert; log the error
        Sentry.captureException(recentErr);
        continue;
      }

      if (!recentRows || recentRows.length === 0) {
        // No recent execution found — find actual last run time
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lastRows } = await (supabase as any)
          .from("pipeline_events")
          .select("created_at")
          .eq("stage", stage)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastAt        = (lastRows as Array<{ created_at: string }> | null)?.[0]?.created_at
          ? new Date((lastRows as Array<{ created_at: string }>)[0].created_at).getTime()
          : null;
        const delayMinutes  = lastAt !== null
          ? Math.round((now - lastAt) / 60_000)
          : null;

        Sentry.withScope((scope) => {
          scope.setLevel("warning");
          scope.setContext("watchdog_stale_stage", {
            stage,
            threshold_minutes:     thresholdMinutes,
            actual_delay_minutes:  delayMinutes ?? "unknown — no rows in pipeline_events",
            source:                "pipeline_events",
          });
          Sentry.captureMessage(`watchdog_stale_stage: ${stage}`);
        });

        staleStages.push(stage);
      }
    }

    // ── Check baselines (fallback: section_baselines table) ───────────────────
    // build-baselines does not write pipeline_events rows.
    const baselineThresholdMinutes = 30;
    const baselineCutoff = new Date(now - baselineThresholdMinutes * 60 * 1000).toISOString();

    const { data: recentBaseline, error: baselineErr } = await supabase
      .from("section_baselines")
      .select("created_at")
      .gte("created_at", baselineCutoff)
      .limit(1);

    if (baselineErr) {
      Sentry.captureException(baselineErr);
    } else if (!recentBaseline || recentBaseline.length === 0) {
      const { data: lastBaseline } = await supabase
        .from("section_baselines")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      const lastAt       = (lastBaseline as Array<{ created_at: string }> | null)?.[0]?.created_at
        ? new Date((lastBaseline as Array<{ created_at: string }>)[0].created_at).getTime()
        : null;
      const delayMinutes = lastAt !== null
        ? Math.round((now - lastAt) / 60_000)
        : null;

      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setContext("watchdog_stale_stage", {
          stage:                "baseline",
          threshold_minutes:    baselineThresholdMinutes,
          actual_delay_minutes: delayMinutes ?? "unknown — no rows in section_baselines",
          source:               "section_baselines (fallback — build-baselines does not write pipeline_events)",
        });
        Sentry.captureMessage("watchdog_stale_stage: baseline");
      });

      staleStages.push("baseline");
    }

    // ── Watchdog healthy ──────────────────────────────────────────────────────
    Sentry.captureCheckIn({ monitorSlug: MONITOR_SLUG, status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok:          true,
      job:         "watchdog",
      staleStages,
      stagesOk:    (PIPELINE_STAGES.length + 1) - staleStages.length,
      stagesTotal: PIPELINE_STAGES.length + 1, // +1 for baseline
      checkedAt:   new Date().toISOString(),
    });

  } catch (err) {
    // Watchdog failure = monitoring is down = critical
    Sentry.captureException(err);
    Sentry.captureCheckIn({ monitorSlug: MONITOR_SLUG, status: "error", checkInId });
    await Sentry.flush(2000);
    throw err;
  }
}

export default withSentry("watchdog", handler);
