import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({ monitorSlug: "build-baselines", status: "in_progress" });

  try {
    const { data, error } = await supabase.rpc("build_section_baselines");
    if (error) throw error;

    // ── Baseline churn monitoring ──────────────────────────────────────────────
    // More than 5 new baselines for the same page in 7 days indicates unstable
    // extraction or a continuously restructuring page.
    let baselineChurnWarnings = 0;
    try {
      const churnWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentBaselines } = await supabase
        .from("section_baselines")
        .select("monitored_page_id")
        .gte("established_at", churnWindow);

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
              extra: { monitored_page_id: pageId, new_baselines_last_7d: count },
            });
            baselineChurnWarnings += 1;
          }
        }
      }
    } catch (churnError) {
      Sentry.captureException(churnError);
    }

    // ── Coverage gap detection ─────────────────────────────────────────────────
    // Active pages that have at least one valid section but no baseline entry are
    // dark — they will never produce diffs or signals. This can happen when:
    //   - a new competitor was onboarded but build_section_baselines RPC skipped it
    //   - extraction produced sections but the baseline RPC has a selection gap
    //   - the page was reactivated after being deactivated
    // Emit one warning per offending page so the operator can investigate.
    let coverageGapWarnings = 0;
    let pagesWithBaselines = 0;
    try {
      // Pages that have at least one valid section (extraction is working).
      const { data: pagesWithSections } = await supabase
        .from("page_sections")
        .select("monitored_page_id")
        .eq("validation_status", "valid")
        .limit(500);

      const pagesWithSectionIds = [
        ...new Set(
          ((pagesWithSections ?? []) as { monitored_page_id: string }[]).map(
            (r) => r.monitored_page_id
          )
        ),
      ];

      if (pagesWithSectionIds.length > 0) {
        // Pages that already have at least one baseline.
        const { data: baselinedPages } = await supabase
          .from("section_baselines")
          .select("monitored_page_id")
          .in("monitored_page_id", pagesWithSectionIds);

        const baselinedSet = new Set(
          ((baselinedPages ?? []) as { monitored_page_id: string }[]).map(
            (r) => r.monitored_page_id
          )
        );

        pagesWithBaselines = baselinedSet.size;

        // ── baseline_maturing → healthy promotion ──────────────────────────────
        // Pages that previously had no baseline are now in baselinedSet.
        // Promote them from baseline_maturing → healthy.
        const baselinedIds = [...baselinedSet];
        if (baselinedIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: promoteError } = await supabase
            .from("monitored_pages")
            .update({ health_state: "healthy" } as any)
            .in("id", baselinedIds)
            .eq("health_state", "baseline_maturing");
          if (promoteError) Sentry.captureException(promoteError);
        }

        // Active pages with valid sections but no baseline = coverage gap.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: activePages } = await (supabase as any)
          .from("monitored_pages")
          .select("id, health_state")
          .in("id", pagesWithSectionIds)
          .eq("active", true);

        const activePageRows = (activePages ?? []) as { id: string; health_state: string }[];
        const activeWithSections = activePageRows.map((r) => r.id);
        const gapPageIds = activeWithSections.filter((id) => !baselinedSet.has(id));

        if (gapPageIds.length > 0) {
          Sentry.captureMessage("baseline_coverage_gap", {
            level: "warning",
            extra: {
              gap_count:    gapPageIds.length,
              gap_page_ids: gapPageIds,
              note:         "Active pages with valid sections but no section_baselines entry — diffs and signals will never fire for these pages",
            },
          });
          coverageGapWarnings = gapPageIds.length;

          // Set baseline_maturing for gap pages that are not already in a terminal
          // state (blocked/challenge/degraded/baseline_maturing already set).
          const maturingCandidates = activePageRows
            .filter((r) => gapPageIds.includes(r.id) && !["blocked", "challenge", "degraded", "baseline_maturing"].includes(r.health_state))
            .map((r) => r.id);

          if (maturingCandidates.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: maturingError } = await supabase
              .from("monitored_pages")
              .update({ health_state: "baseline_maturing" } as any)
              .in("id", maturingCandidates);
            if (maturingError) Sentry.captureException(maturingError);
          }
        }
      }
    } catch (coverageError) {
      // Non-fatal — coverage check must never block pipeline output.
      Sentry.captureException(coverageError);
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:            "build-baselines",
      baselinesCreated:      data,
      pagesWithBaselines,
      baselineChurnWarnings,
      coverageGapWarnings,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "build-baselines", status: "ok" });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "build-baselines",
      baselinesCreated:      data,
      pagesWithBaselines,
      baselineChurnWarnings,
      coverageGapWarnings,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "build-baselines", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("build-baselines", handler);
