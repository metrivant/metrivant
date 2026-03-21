import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

/**
 * promote-baselines
 *
 * Calls the promote_section_baselines() Postgres function which examines
 * 30-day observation history and promotes stable new hashes to be the
 * active baseline when a competitor's page has clearly, durably changed.
 *
 * Promotion criteria (all must hold for a given page + section_type):
 *   - dominant hash represents >= 80% of observations in the last 30 days
 *   - that hash has been present for at least 14 days (A/B test guard)
 *   - fewer than 2 competing hashes above 20% (active experimentation guard)
 *   - at least 3 valid observations exist in the window
 *   - the dominant hash differs from the current active baseline
 *
 * Runs daily (02:00 UTC) — no urgency. Stale baselines cause perpetual diffs,
 * not data loss. A missed run is harmless.
 */

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "promote-baselines",
    status: "in_progress",
  });

  try {
    const isDryRun = req.query?.dry_run === "1" || req.query?.dry_run === "true";

    const { data, error } = await supabase
      .rpc("promote_section_baselines", { dry_run: isDryRun });

    if (error) throw error;

    const rows = (data ?? []) as Array<{ promoted_count: number; pairs_evaluated: number }>;
    const promoted = rows[0]?.promoted_count ?? 0;
    const evaluated = rows[0]?.pairs_evaluated ?? 0;

    if (promoted > 0 && !isDryRun) {
      Sentry.captureMessage("baselines_promoted", {
        level: "info",
        extra: { promoted, evaluated },
      });

      // H11: Mark pages with recently promoted baselines as baseline_maturing.
      // detect-signals will hold signals from these pages in pending_review
      // to avoid flooding the radar with website-redesign noise.
      try {
        const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: promotedPages } = await supabase
          .from("section_baselines")
          .select("monitored_page_id")
          .gt("version", 1)
          .eq("is_active", true)
          .gte("created_at", recentCutoff);

        const maturingPageIds = [...new Set(
          ((promotedPages ?? []) as { monitored_page_id: string }[]).map((r) => r.monitored_page_id)
        )];

        if (maturingPageIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: maturingError } = await (supabase as any)
            .from("monitored_pages")
            .update({ health_state: "baseline_maturing" })
            .in("id", maturingPageIds)
            .eq("health_state", "healthy"); // only downgrade from healthy
          if (maturingError) Sentry.captureException(maturingError);
        }
      } catch (maturingErr) {
        // Non-fatal — baseline_maturing state is a signal quality improvement, not a pipeline requirement
        Sentry.captureException(maturingErr);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:      "promote-baselines",
      promoted,
      evaluated,
      dry_run:         isDryRun,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "promote-baselines",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-baselines",
      dry_run: isDryRun,
      promoted,
      evaluated,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "promote-baselines",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-baselines", handler);
