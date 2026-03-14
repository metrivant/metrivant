import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "build-baselines",
    status: "in_progress",
  });

  try {

    const { data, error } = await supabase.rpc("build_section_baselines");

    if (error) {
      throw error;
    }

    // ── Baseline churn monitoring ──────────────────────────────────────────────
    // Baselines are immutable after creation (migration 006). "Churn" here means
    // new section_types appearing for a page within a 7-day window — an indicator
    // of unstable extraction or a page that is continuously changing structure.
    // More than 5 new baselines for the same page per week is anomalous.
    let baselineChurnWarnings = 0;
    try {
      const churnWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentBaselines } = await supabase
        .from("section_baselines")
        .select("monitored_page_id")
        .gte("created_at", churnWindow);

      if (recentBaselines && recentBaselines.length > 0) {
        const churnByPage = new Map<string, number>();
        for (const row of recentBaselines) {
          const mp = (row as { monitored_page_id: string }).monitored_page_id;
          churnByPage.set(mp, (churnByPage.get(mp) ?? 0) + 1);
        }
        for (const [pageId, count] of churnByPage) {
          if (count > 5) {
            Sentry.captureMessage("baseline_instability_warning", {
              level: "warning",
              extra: {
                monitored_page_id: pageId,
                new_baselines_last_7d: count,
              },
            });
            baselineChurnWarnings += 1;
          }
        }
      }
    } catch (churnError) {
      // Non-fatal — churn check must never block pipeline output.
      Sentry.captureException(churnError);
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "build-baselines",
      baselinesCreated: data,
      baselineChurnWarnings,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "build-baselines",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "build-baselines",
      baselinesCreated: data,
      baselineChurnWarnings,
      runtimeDurationMs
    });

  } catch (error) {

    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "build-baselines",
      status: "error",
    });

    await Sentry.flush(2000);

    throw error;
  }
}

export default withSentry("build-baselines", handler);