import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonitoredPageRow {
  id: string;
  url: string;
  page_type: string;
  page_class: string;
  competitor_id: string;
  competitors: { name: string } | null;
}

interface SnapshotRow {
  monitored_page_id: string;
  fetched_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch_quality: string | null;
}

// Severity order for stuck_stage sorting — lower index = more severe.
// crawler_blocked sits between no_snapshot and extraction_failing: the page
// is reachable and snapshotted, but the crawler sees only a bot wall.
const STUCK_STAGE_ORDER: Record<string, number> = {
  no_snapshot:             0,
  crawler_blocked:         1,
  extraction_failing:      2,
  baseline_pending:        3,
  diffs_not_signaled:      4,
  signals_not_interpreted: 5,
  pending_review_only:     6,
  no_diffs:                7,
  healthy:                 8,
};

// Diagnosis strings — plain-language one-liners for each stuck_stage.
const STUCK_STAGE_DIAGNOSIS: Record<string, string> = {
  no_snapshot:             "No snapshot fetched yet — check if URL is reachable and cron is running",
  crawler_blocked:         "Site returning bot wall or JS shell — crawler cannot see content",
  extraction_failing:      "Snapshot exists but no usable sections extracted — selector mismatch likely",
  baseline_pending:        "Sections extracted but no baseline established yet — wait for next build-baselines run",
  no_diffs:                "Baseline exists, no changes detected — page may be genuinely stable",
  diffs_not_signaled:      "Changes confirmed but not converted to signals — check confidence weights for this section type",
  signals_not_interpreted: "Signals created but not interpreted — check interpret-signals cron and retry count",
  pending_review_only:     "Signals held in pending_review — pressure_index has not reached 5.0 to promote them",
  healthy:                 "Signals flowing through to interpretation",
};

function deriveStuckStage(opts: {
  lastSnapshotAt: string | null;
  lastFetchQuality: string | null;
  lastSectionAt: string | null;
  baselineCount: number;
  unconfirmedDiffCount: number;
  confirmedUnsignaledDiffCount: number;
  // signals_7d counts only non-pending_review signals (pending + interpreted)
  signals7d: number;
  pendingReviewSignals: number;
  interpretedSignals7d: number;
}): string {
  const now = Date.now();

  // ── Stage 1: No snapshot ──────────────────────────────────────────────────
  // Fire when there has never been a snapshot (lastSnapshotAt IS NULL) OR when
  // the most recent snapshot is older than 9 hours. The 9h threshold accounts
  // for the standard cadence (3h) × 3 = generous jitter buffer, ensuring a
  // standard page that ran 5–6h ago is not spuriously flagged.
  if (
    !opts.lastSnapshotAt ||
    now - new Date(opts.lastSnapshotAt).getTime() > 9 * 60 * 60 * 1000
  ) {
    return "no_snapshot";
  }

  // ── Stage 2: Crawler blocked ──────────────────────────────────────────────
  // Snapshot exists but fetch_quality='shell' — the site is actively blocking
  // the crawler (bot wall, JS-only shell, anti-scrape response). This is
  // distinct from extraction_failing: the fetch itself succeeded but returned
  // unusable content. We can't extract sections from a shell.
  if (opts.lastFetchQuality === "shell") {
    return "crawler_blocked";
  }

  // ── Stage 3: Extraction failing ───────────────────────────────────────────
  // Snapshot exists and fetch_quality is not 'shell', but no sections have
  // ever been extracted. This means the extractor ran but found nothing —
  // likely a selector mismatch or a new page layout.
  if (!opts.lastSectionAt) {
    return "extraction_failing";
  }

  // ── Stage 4: Baseline pending ─────────────────────────────────────────────
  // Sections exist (extraction worked) but no baselines have been built yet.
  // This is a transient state — build-baselines runs on a cron and will
  // resolve it. Not a defect; just waiting for the next build cycle.
  if (opts.baselineCount === 0) {
    return "baseline_pending";
  }

  // ── Stage 5: Diffs not signaled ───────────────────────────────────────────
  // Confirmed diffs are sitting unsignaled. These are real changes that
  // detect-signals hasn't processed yet (or they're being suppressed).
  if (opts.confirmedUnsignaledDiffCount > 0) {
    return "diffs_not_signaled";
  }

  // ── Stage 6: Signals not interpreted ─────────────────────────────────────
  // Active (non-pending_review) signals exist but none have been interpreted.
  // Indicates interpret-signals cron is not running or signals are stuck.
  if (opts.signals7d > 0 && opts.interpretedSignals7d === 0) {
    return "signals_not_interpreted";
  }

  // ── Stage 7: Pending review only ─────────────────────────────────────────
  // No promoted signals in the last 7d, but pending_review signals exist.
  // These are held because pressure_index hasn't reached 5.0 yet.
  if (opts.pendingReviewSignals > 0 && opts.signals7d === 0) {
    return "pending_review_only";
  }

  // ── Stage 8: No diffs ────────────────────────────────────────────────────
  // Pipeline is intact but no changes have been detected. May be genuinely
  // stable content, or a new competitor with not enough snapshots yet.
  if (
    opts.baselineCount > 0 &&
    opts.unconfirmedDiffCount === 0 &&
    opts.confirmedUnsignaledDiffCount === 0 &&
    opts.signals7d === 0 &&
    opts.pendingReviewSignals === 0
  ) {
    return "no_diffs";
  }

  // ── Stage 9: Healthy ─────────────────────────────────────────────────────
  if (opts.signals7d > 0 && opts.interpretedSignals7d > 0) {
    return "healthy";
  }

  return "no_diffs";
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const generatedAt = new Date().toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // ── Step 1: Load all monitored pages with competitor names ────────────────
    const { data: pageRows, error: pageError } = await supabase
      .from("monitored_pages")
      .select("id, url, page_type, page_class, competitor_id, competitors ( name )")
      .eq("active", true);

    if (pageError) throw pageError;

    const pages = (pageRows ?? []) as MonitoredPageRow[];
    const pageIds = pages.map((p) => p.id);

    if (pageIds.length === 0) {
      return res.status(200).json({
        generated_at: generatedAt,
        summary: {
          total_pages: 0,
          healthy: 0,
          stuck: 0,
          breakdown: {},
          pending_review_total: 0,
          pending_review_promoted_7d: 0,
          promotion_rate_7d: null,
        },
        pages: [],
      });
    }

    // ── Step 2: Latest snapshot per page (with fetch_quality) ─────────────
    // Fetch most-recent snapshots ordered descending; keep first per page.
    // fetch_quality is cast via `as any` because the generated types may not
    // include it yet (it's written with a migration guard in fetch-snapshots).
    const { data: snapshotRows, error: snapshotError } = await supabase
      .from("snapshots")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("monitored_page_id, fetched_at, fetch_quality" as any)
      .in("monitored_page_id", pageIds)
      .order("fetched_at", { ascending: false })
      .limit(2000);

    if (snapshotError) throw snapshotError;

    const lastSnapshotMap = new Map<string, string>();
    const lastFetchQualityMap = new Map<string, string | null>();

    for (const row of (snapshotRows ?? []) as unknown as SnapshotRow[]) {
      if (!lastSnapshotMap.has(row.monitored_page_id)) {
        lastSnapshotMap.set(row.monitored_page_id, row.fetched_at);
        lastFetchQualityMap.set(row.monitored_page_id, row.fetch_quality ?? null);
      }
    }

    // ── Step 3: Latest section per page ──────────────────────────────────────
    const { data: sectionRows, error: sectionError } = await supabase
      .from("page_sections")
      .select("monitored_page_id, created_at")
      .in("monitored_page_id", pageIds)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (sectionError) throw sectionError;

    const lastSectionMap = new Map<string, string>();
    for (const row of (sectionRows ?? []) as { monitored_page_id: string; created_at: string }[]) {
      if (!lastSectionMap.has(row.monitored_page_id)) {
        lastSectionMap.set(row.monitored_page_id, row.created_at);
      }
    }

    // ── Step 4: Baseline count per page ──────────────────────────────────────
    const { data: baselineRows, error: baselineError } = await supabase
      .from("section_baselines")
      .select("monitored_page_id")
      .in("monitored_page_id", pageIds);

    if (baselineError) throw baselineError;

    const baselineCountMap = new Map<string, number>();
    for (const row of (baselineRows ?? []) as { monitored_page_id: string }[]) {
      baselineCountMap.set(row.monitored_page_id, (baselineCountMap.get(row.monitored_page_id) ?? 0) + 1);
    }

    // ── Step 5: Diff counts per page ─────────────────────────────────────────
    const { data: diffRows, error: diffError } = await supabase
      .from("section_diffs")
      .select("monitored_page_id, confirmed, signal_detected, is_noise")
      .in("monitored_page_id", pageIds);

    if (diffError) throw diffError;

    const unconfirmedDiffMap = new Map<string, number>();
    const confirmedUnsignaledMap = new Map<string, number>();

    for (const row of (diffRows ?? []) as {
      monitored_page_id: string;
      confirmed: boolean | null;
      signal_detected: boolean | null;
      is_noise: boolean | null;
    }[]) {
      if (!row.confirmed) {
        unconfirmedDiffMap.set(row.monitored_page_id, (unconfirmedDiffMap.get(row.monitored_page_id) ?? 0) + 1);
      }
      if (row.confirmed && !row.signal_detected && !row.is_noise) {
        confirmedUnsignaledMap.set(row.monitored_page_id, (confirmedUnsignaledMap.get(row.monitored_page_id) ?? 0) + 1);
      }
    }

    // ── Step 6: Signal counts per page ───────────────────────────────────────
    // Two separate queries:
    //   a) 7d window — count only PROMOTED signals (status != 'pending_review').
    //      pending_review signals must NOT inflate signals_7d or the pending_review_only
    //      check `signals7d === 0 && pendingReviewSignals > 0` would never fire for
    //      competitors whose pending_review signals are recent (within 7d window).
    //   b) All-time pending_review signals — regardless of age, for promotion state.
    const { data: signalRows, error: signalError } = await supabase
      .from("signals")
      .select("monitored_page_id, status, interpreted, detected_at")
      .in("monitored_page_id", pageIds)
      .neq("status", "pending_review")
      .gte("detected_at", since7d);

    const { data: pendingReviewRows, error: prError } = await supabase
      .from("signals")
      .select("monitored_page_id, status")
      .in("monitored_page_id", pageIds)
      .eq("status", "pending_review");

    if (signalError) throw signalError;
    if (prError) throw prError;

    const signals7dMap = new Map<string, number>();
    const interpreted7dMap = new Map<string, number>();
    const pendingReviewMap = new Map<string, number>();

    for (const row of (signalRows ?? []) as {
      monitored_page_id: string;
      status: string;
      interpreted: boolean | null;
      detected_at: string;
    }[]) {
      signals7dMap.set(row.monitored_page_id, (signals7dMap.get(row.monitored_page_id) ?? 0) + 1);
      if (row.interpreted) {
        interpreted7dMap.set(row.monitored_page_id, (interpreted7dMap.get(row.monitored_page_id) ?? 0) + 1);
      }
    }

    for (const row of (pendingReviewRows ?? []) as {
      monitored_page_id: string;
      status: string;
    }[]) {
      pendingReviewMap.set(row.monitored_page_id, (pendingReviewMap.get(row.monitored_page_id) ?? 0) + 1);
    }

    // ── Step 7: Pending review promotion rate (summary-level only) ────────────
    // pending_review_total: all current signals still held in pending_review.
    // pending_review_promoted_7d: signals that passed through the pending_review
    //   gate and were promoted in the last 7d. Approximated by: signals whose
    //   confidence_score is in the pending_review band (0.35–0.64) but whose
    //   status is no longer 'pending_review' and interpreted=true.
    //   This is the best available proxy without a status-history table.
    const { count: pendingReviewTotal } = await supabase
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review");

    const { count: promotedCount } = await supabase
      .from("signals")
      .select("id", { count: "exact", head: true })
      .neq("status", "pending_review")
      .gte("confidence_score", 0.35)
      .lt("confidence_score", 0.65)
      .eq("interpreted", true)
      .gte("detected_at", since7d);

    const pendingReviewTotalVal = pendingReviewTotal ?? 0;
    const pendingReviewPromoted7d = promotedCount ?? 0;
    const promotionDenominator = pendingReviewPromoted7d + pendingReviewTotalVal;
    const promotionRate7d =
      promotionDenominator > 0
        ? parseFloat((pendingReviewPromoted7d / promotionDenominator).toFixed(4))
        : null;

    // ── Step 8: Assemble page diagnostics ────────────────────────────────────
    const pageResults = pages.map((page) => {
      const lastSnapshotAt = lastSnapshotMap.get(page.id) ?? null;
      const lastFetchQuality = lastFetchQualityMap.get(page.id) ?? null;
      const lastSectionAt = lastSectionMap.get(page.id) ?? null;
      const baselineCount = baselineCountMap.get(page.id) ?? 0;
      const unconfirmedDiffCount = unconfirmedDiffMap.get(page.id) ?? 0;
      const confirmedUnsignaledDiffCount = confirmedUnsignaledMap.get(page.id) ?? 0;
      const signals7d = signals7dMap.get(page.id) ?? 0;
      const pendingReviewSignals = pendingReviewMap.get(page.id) ?? 0;
      const interpretedSignals7d = interpreted7dMap.get(page.id) ?? 0;

      const stuckStage = deriveStuckStage({
        lastSnapshotAt,
        lastFetchQuality,
        lastSectionAt,
        baselineCount,
        unconfirmedDiffCount,
        confirmedUnsignaledDiffCount,
        signals7d,
        pendingReviewSignals,
        interpretedSignals7d,
      });

      return {
        competitor_name:                 page.competitors?.name ?? "unknown",
        competitor_id:                   page.competitor_id,
        page_url:                        page.url,
        page_class:                      page.page_class,
        stuck_stage:                     stuckStage,
        diagnosis:                       STUCK_STAGE_DIAGNOSIS[stuckStage] ?? stuckStage,
        last_snapshot_at:                lastSnapshotAt,
        last_fetch_quality:              lastFetchQuality,
        baseline_count:                  baselineCount,
        confirmed_unsignaled_diff_count: confirmedUnsignaledDiffCount,
        signals_7d:                      signals7d,
        pending_review_signals:          pendingReviewSignals,
        interpreted_signals_7d:          interpretedSignals7d,
      };
    });

    // Sort: most severe stuck stages first, then healthy
    pageResults.sort((a, b) => {
      const aOrder = STUCK_STAGE_ORDER[a.stuck_stage] ?? 99;
      const bOrder = STUCK_STAGE_ORDER[b.stuck_stage] ?? 99;
      return aOrder - bOrder;
    });

    // ── Step 9: Build summary ─────────────────────────────────────────────────
    const breakdown: Record<string, number> = {};
    let healthyCount = 0;

    for (const p of pageResults) {
      if (p.stuck_stage === "healthy") {
        healthyCount += 1;
      }
      breakdown[p.stuck_stage] = (breakdown[p.stuck_stage] ?? 0) + 1;
    }

    const stuckCount = pageResults.length - healthyCount;

    Sentry.addBreadcrumb({
      category: "pipeline",
      message: "pipeline-health diagnostic run",
      level: "info",
      data: {
        total_pages: pageResults.length,
        healthy: healthyCount,
        stuck: stuckCount,
        breakdown,
      },
    });

    res.status(200).json({
      generated_at: generatedAt,
      summary: {
        total_pages: pageResults.length,
        healthy: healthyCount,
        stuck: stuckCount,
        breakdown,
        pending_review_total: pendingReviewTotalVal,
        pending_review_promoted_7d: pendingReviewPromoted7d,
        promotion_rate_7d: promotionRate7d,
      },
      pages: pageResults,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("pipeline-health", handler);
