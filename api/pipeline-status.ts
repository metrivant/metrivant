import "../lib/sentry";
import { ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

/**
 * GET /api/pipeline-status
 *
 * Operator-level diagnostic endpoint. Returns per-competitor pipeline state
 * so silent failures can be diagnosed without querying Supabase directly.
 *
 * Response shape:
 * {
 *   ok: true,
 *   pipeline: {
 *     lastSnapshotAt: string | null,
 *     pendingSnapshotBacklog: number,
 *     unconfirmedDiffBacklog: number,
 *     confirmedDiffBacklog: number,
 *     pendingSignalBacklog: number,
 *     failedSignals: number,
 *   },
 *   competitors: Array<{
 *     id: string,
 *     name: string,
 *     monitoredPageCount: number,
 *     lastSnapshotAt: string | null,
 *     sectionCount: number,
 *     diffCount: number,
 *     signalCount: number,
 *     baselineCount: number,
 *     pagesWithNoSections: number,
 *     pagesWithNoRules: number,
 *   }>
 * }
 */

interface CompetitorRow {
  id: string;
  name: string;
}

interface PageRow {
  id: string;
  competitor_id: string;
}

interface SnapshotRow {
  monitored_page_id: string;
  fetched_at: string;
}

interface SectionCountRow {
  monitored_page_id: string;
  count: string;
}

interface DiffCountRow {
  monitored_page_id: string;
  count: string;
}

interface SignalCountRow {
  monitored_page_id: string;
  count: string;
}

interface BaselineCountRow {
  monitored_page_id: string;
  count: string;
}

interface RuleCountRow {
  monitored_page_id: string;
  count: string;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  try {
    // ── Global pipeline summary ──────────────────────────────────────────────

    const [
      latestSnapshotResult,
      pendingSnapshotResult,
      unconfirmedDiffResult,
      confirmedDiffResult,
      pendingSignalResult,
      failedSignalResult,
    ] = await Promise.all([
      supabase
        .from("snapshots")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("snapshots")
        .select("*", { count: "exact", head: true })
        .eq("sections_extracted", false),
      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("confirmed", false),
      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("confirmed", true)
        .eq("signal_detected", false)
        .eq("is_noise", false),
      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);

    // ── Per-competitor breakdown ─────────────────────────────────────────────

    const { data: competitorRows, error: compError } = await supabase
      .from("competitors")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (compError) throw compError;

    const competitors = (competitorRows ?? []) as CompetitorRow[];
    const competitorIds = competitors.map((c) => c.id);

    if (competitorIds.length === 0) {
      return res.status(200).json({
        ok: true,
        pipeline: {
          lastSnapshotAt:         latestSnapshotResult.data?.fetched_at ?? null,
          pendingSnapshotBacklog: pendingSnapshotResult.count ?? 0,
          unconfirmedDiffBacklog: unconfirmedDiffResult.count ?? 0,
          confirmedDiffBacklog:   confirmedDiffResult.count ?? 0,
          pendingSignalBacklog:   pendingSignalResult.count ?? 0,
          failedSignals:          failedSignalResult.count ?? 0,
        },
        competitors: [],
      });
    }

    // Fetch all monitored pages for these competitors
    const { data: pageRows, error: pagesError } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id")
      .in("competitor_id", competitorIds)
      .eq("active", true);

    if (pagesError) throw pagesError;

    const pages = (pageRows ?? []) as PageRow[];
    const pageIds = pages.map((p) => p.id);

    if (pageIds.length === 0) {
      return res.status(200).json({
        ok: true,
        pipeline: {
          lastSnapshotAt:         latestSnapshotResult.data?.fetched_at ?? null,
          pendingSnapshotBacklog: pendingSnapshotResult.count ?? 0,
          unconfirmedDiffBacklog: unconfirmedDiffResult.count ?? 0,
          confirmedDiffBacklog:   confirmedDiffResult.count ?? 0,
          pendingSignalBacklog:   pendingSignalResult.count ?? 0,
          failedSignals:          failedSignalResult.count ?? 0,
        },
        competitors: competitors.map((c) => ({
          id: c.id, name: c.name,
          monitoredPageCount: 0, lastSnapshotAt: null,
          sectionCount: 0, diffCount: 0, signalCount: 0,
          baselineCount: 0, pagesWithNoSections: 0, pagesWithNoRules: 0,
        })),
      });
    }

    // Parallel queries for per-page data
    const [
      latestSnapshotsResult,
      sectionCountsResult,
      diffCountsResult,
      signalCountsResult,
      baselineCountsResult,
      ruleCountsResult,
    ] = await Promise.all([
      // Latest snapshot per monitored_page
      supabase
        .from("snapshots")
        .select("monitored_page_id, fetched_at")
        .in("monitored_page_id", pageIds)
        .order("fetched_at", { ascending: false }),

      // Section counts per monitored_page (RPC not available — use aggregate via select)
      supabase
        .from("page_sections")
        .select("monitored_page_id, id")
        .in("monitored_page_id", pageIds),

      // Diff counts per monitored_page
      supabase
        .from("section_diffs")
        .select("monitored_page_id, id")
        .in("monitored_page_id", pageIds),

      // Signal counts per monitored_page
      supabase
        .from("signals")
        .select("monitored_page_id, id")
        .in("monitored_page_id", pageIds),

      // Baseline counts per monitored_page
      supabase
        .from("section_baselines")
        .select("monitored_page_id, section_type")
        .in("monitored_page_id", pageIds),

      // Rule counts per monitored_page
      supabase
        .from("extraction_rules")
        .select("monitored_page_id, section_type")
        .in("monitored_page_id", pageIds)
        .eq("active", true),
    ]);

    // Build lookup maps
    // Latest snapshot per monitored_page
    const latestSnapshotByPage = new Map<string, string>();
    for (const snap of (latestSnapshotsResult.data ?? []) as SnapshotRow[]) {
      if (!latestSnapshotByPage.has(snap.monitored_page_id)) {
        latestSnapshotByPage.set(snap.monitored_page_id, snap.fetched_at);
      }
    }

    const sectionsByPage = new Map<string, number>();
    for (const r of (sectionCountsResult.data ?? [])) {
      const mp = (r as { monitored_page_id: string }).monitored_page_id;
      sectionsByPage.set(mp, (sectionsByPage.get(mp) ?? 0) + 1);
    }

    const diffsByPage = new Map<string, number>();
    for (const r of (diffCountsResult.data ?? [])) {
      const mp = (r as { monitored_page_id: string }).monitored_page_id;
      diffsByPage.set(mp, (diffsByPage.get(mp) ?? 0) + 1);
    }

    const signalsByPage = new Map<string, number>();
    for (const r of (signalCountsResult.data ?? [])) {
      const mp = (r as { monitored_page_id: string }).monitored_page_id;
      signalsByPage.set(mp, (signalsByPage.get(mp) ?? 0) + 1);
    }

    const baselinesByPage = new Map<string, number>();
    for (const r of (baselineCountsResult.data ?? [])) {
      const mp = (r as { monitored_page_id: string }).monitored_page_id;
      baselinesByPage.set(mp, (baselinesByPage.get(mp) ?? 0) + 1);
    }

    const rulesByPage = new Map<string, number>();
    for (const r of (ruleCountsResult.data ?? [])) {
      const mp = (r as { monitored_page_id: string }).monitored_page_id;
      rulesByPage.set(mp, (rulesByPage.get(mp) ?? 0) + 1);
    }

    // Build per-page lookup: competitor_id → pages[]
    const pagesByCompetitor = new Map<string, PageRow[]>();
    for (const page of pages) {
      const existing = pagesByCompetitor.get(page.competitor_id) ?? [];
      existing.push(page);
      pagesByCompetitor.set(page.competitor_id, existing);
    }

    // Assemble per-competitor summary
    const competitorSummaries = competitors.map((c) => {
      const compPages = pagesByCompetitor.get(c.id) ?? [];

      let lastSnapshotAt: string | null = null;
      let sectionCount = 0;
      let diffCount = 0;
      let signalCount = 0;
      let baselineCount = 0;
      let pagesWithNoSections = 0;
      let pagesWithNoRules = 0;

      for (const page of compPages) {
        const snap = latestSnapshotByPage.get(page.id) ?? null;
        if (snap && (!lastSnapshotAt || snap > lastSnapshotAt)) {
          lastSnapshotAt = snap;
        }

        const sec = sectionsByPage.get(page.id) ?? 0;
        sectionCount  += sec;
        diffCount     += diffsByPage.get(page.id)    ?? 0;
        signalCount   += signalsByPage.get(page.id)  ?? 0;
        baselineCount += baselinesByPage.get(page.id) ?? 0;

        if (sec === 0) pagesWithNoSections += 1;
        if ((rulesByPage.get(page.id) ?? 0) === 0) pagesWithNoRules += 1;
      }

      return {
        id:                 c.id,
        name:               c.name,
        monitoredPageCount: compPages.length,
        lastSnapshotAt,
        sectionCount,
        diffCount,
        signalCount,
        baselineCount,
        pagesWithNoSections,
        pagesWithNoRules,
      };
    });

    return res.status(200).json({
      ok: true,
      pipeline: {
        lastSnapshotAt:         latestSnapshotResult.data?.fetched_at ?? null,
        pendingSnapshotBacklog: pendingSnapshotResult.count ?? 0,
        unconfirmedDiffBacklog: unconfirmedDiffResult.count ?? 0,
        confirmedDiffBacklog:   confirmedDiffResult.count ?? 0,
        pendingSignalBacklog:   pendingSignalResult.count ?? 0,
        failedSignals:          failedSignalResult.count ?? 0,
      },
      competitors: competitorSummaries,
    });

  } catch (error: unknown) {
    Sentry.captureException(error);
    res.status(500).json({
      ok: false,
      error: "pipeline_status_failed",
    });
  }
}

export default handler;
