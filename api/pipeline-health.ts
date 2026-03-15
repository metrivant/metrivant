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

interface SnapshotAggRow {
  monitored_page_id: string;
  max_fetched_at: string;
}

interface SectionAggRow {
  monitored_page_id: string;
  max_created_at: string;
}

interface BaselineCountRow {
  monitored_page_id: string;
  baseline_count: number;
}

interface DiffCountRow {
  monitored_page_id: string;
  unconfirmed: number;
  confirmed_unsignaled: number;
}

interface SignalCountRow {
  monitored_page_id: string;
  signals_7d: number;
  pending_review: number;
  interpreted_7d: number;
}

// Severity order for stuck_stage sorting — lower index = more severe.
const STUCK_STAGE_ORDER: Record<string, number> = {
  no_snapshot:             0,
  extraction_failing:      1,
  baseline_pending:        2,
  diffs_not_signaled:      3,
  signals_not_interpreted: 4,
  pending_review_only:     5,
  no_diffs:                6,
  healthy:                 7,
};

function deriveStuckStage(opts: {
  lastSnapshotAt: string | null;
  lastSectionAt: string | null;
  baselineCount: number;
  unconfirmedDiffCount: number;
  confirmedUnsignaledDiffCount: number;
  signals7d: number;
  pendingReviewSignals: number;
  interpretedSignals7d: number;
}): string {
  const now = Date.now();

  // No snapshot at all, or last snapshot is older than 6 hours
  if (
    !opts.lastSnapshotAt ||
    now - new Date(opts.lastSnapshotAt).getTime() > 6 * 60 * 60 * 1000
  ) {
    return "no_snapshot";
  }

  // Snapshot exists but no sections extracted, OR baseline_count=0 and snapshot is >2h old
  if (
    !opts.lastSectionAt ||
    (opts.baselineCount === 0 &&
      now - new Date(opts.lastSnapshotAt).getTime() > 2 * 60 * 60 * 1000)
  ) {
    return "extraction_failing";
  }

  // Sections exist but no baselines built yet
  if (opts.baselineCount === 0) {
    return "baseline_pending";
  }

  // Confirmed diffs sitting unsignaled
  if (opts.confirmedUnsignaledDiffCount > 0) {
    return "diffs_not_signaled";
  }

  // Signals exist but none interpreted
  if (opts.signals7d > 0 && opts.interpretedSignals7d === 0) {
    return "signals_not_interpreted";
  }

  // Only pending_review signals — waiting on pressure_index promotion
  if (opts.pendingReviewSignals > 0 && opts.signals7d === 0) {
    return "pending_review_only";
  }

  // Baselines and sections present but no signal activity — may be genuinely quiet
  if (
    opts.baselineCount > 0 &&
    opts.unconfirmedDiffCount === 0 &&
    opts.confirmedUnsignaledDiffCount === 0 &&
    opts.signals7d === 0
  ) {
    return "no_diffs";
  }

  // Active signals with at least some interpreted
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
        },
        pages: [],
      });
    }

    // ── Step 2: Latest snapshot per page ─────────────────────────────────────
    // Supabase does not support GROUP BY directly — fetch recent snapshots and
    // reduce to max per page in JS. Bounded to 2000 rows to stay fast.
    const { data: snapshotRows, error: snapshotError } = await supabase
      .from("snapshots")
      .select("monitored_page_id, fetched_at")
      .in("monitored_page_id", pageIds)
      .order("fetched_at", { ascending: false })
      .limit(2000);

    if (snapshotError) throw snapshotError;

    const lastSnapshotMap = new Map<string, string>();
    for (const row of (snapshotRows ?? []) as { monitored_page_id: string; fetched_at: string }[]) {
      if (!lastSnapshotMap.has(row.monitored_page_id)) {
        lastSnapshotMap.set(row.monitored_page_id, row.fetched_at);
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
    // section_baselines links via source_section_id → page_sections.monitored_page_id.
    // We join through page_sections. Fetch baselines joined to sections, group in JS.
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

    // ── Step 6: Signal counts per page (7d window) ───────────────────────────
    const { data: signalRows, error: signalError } = await supabase
      .from("signals")
      .select("monitored_page_id, status, interpreted, detected_at")
      .in("monitored_page_id", pageIds)
      .gte("detected_at", since7d);

    // Also fetch pending_review signals regardless of age
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

    // ── Step 7: Assemble page diagnostics ────────────────────────────────────
    const pageResults = pages.map((page) => {
      const lastSnapshotAt = lastSnapshotMap.get(page.id) ?? null;
      const lastSectionAt = lastSectionMap.get(page.id) ?? null;
      const baselineCount = baselineCountMap.get(page.id) ?? 0;
      const unconfirmedDiffCount = unconfirmedDiffMap.get(page.id) ?? 0;
      const confirmedUnsignaledDiffCount = confirmedUnsignaledMap.get(page.id) ?? 0;
      const signals7d = signals7dMap.get(page.id) ?? 0;
      const pendingReviewSignals = pendingReviewMap.get(page.id) ?? 0;
      const interpretedSignals7d = interpreted7dMap.get(page.id) ?? 0;

      const stuckStage = deriveStuckStage({
        lastSnapshotAt,
        lastSectionAt,
        baselineCount,
        unconfirmedDiffCount,
        confirmedUnsignaledDiffCount,
        signals7d,
        pendingReviewSignals,
        interpretedSignals7d,
      });

      return {
        competitor_name:                page.competitors?.name ?? "unknown",
        competitor_id:                  page.competitor_id,
        page_url:                       page.url,
        page_class:                     page.page_class,
        stuck_stage:                    stuckStage,
        last_snapshot_at:               lastSnapshotAt,
        baseline_count:                 baselineCount,
        confirmed_unsignaled_diff_count: confirmedUnsignaledDiffCount,
        signals_7d:                     signals7d,
        pending_review_signals:         pendingReviewSignals,
        interpreted_signals_7d:         interpretedSignals7d,
      };
    });

    // Sort: stuck pages first (by severity), then healthy
    pageResults.sort((a, b) => {
      const aOrder = STUCK_STAGE_ORDER[a.stuck_stage] ?? 99;
      const bOrder = STUCK_STAGE_ORDER[b.stuck_stage] ?? 99;
      return aOrder - bOrder;
    });

    // ── Step 8: Build summary ─────────────────────────────────────────────────
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
      },
      pages: pageResults,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("pipeline-health", handler);
