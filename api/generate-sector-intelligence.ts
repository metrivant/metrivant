// Sector Intelligence Layer — weekly cross-competitor analysis via GPT-4o.
//
// Runs once per week per org. Analyzes signals across all tracked competitors
// to identify sector trends, messaging convergence, and strategic divergence.
//
// Deterministic pipeline is unchanged — AI only synthesizes from detected signals.
// Evidence signal IDs are attached deterministically after the LLM call.

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import {
  selectSignalsForCompetitor,
  buildSectionPivot,
  generateSectorIntelligence,
} from "../lib/sector-intelligence";
import type { SignalForSector, SectorNarrativeContext } from "../lib/sector-intelligence";

const DEFAULT_WINDOW_DAYS = 30;
const MIN_COMPETITORS     = 2;  // pattern detection requires at least 2

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  // analysis_window_days configurable via query param (default 30)
  const windowParam = Number(req.query?.window ?? DEFAULT_WINDOW_DAYS);
  const windowDays  = Number.isFinite(windowParam) && windowParam > 0
    ? Math.min(windowParam, 90)
    : DEFAULT_WINDOW_DAYS;

  Sentry.captureCheckIn({ monitorSlug: "generate-sector-intelligence", status: "in_progress" });

  let orgsProcessed   = 0;
  let analysesCreated = 0;
  let orgsSkipped     = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // ── Load all organisations ─────────────────────────────────────────────────
    const { data: orgs, error: orgsError } = await sb
      .from("organizations")
      .select("id, sector");

    if (orgsError) throw orgsError;
    if (!orgs || orgs.length === 0) {
      await done("ok");
      return respond(res, startedAt, 0, 0, 0);
    }

    for (const org of orgs as { id: string; sector: string }[]) {
      orgsProcessed++;

      try {
        // ── Tracked competitor IDs for this org ──────────────────────────────
        const { data: trackedRows } = await sb
          .from("tracked_competitors")
          .select("competitor_id")
          .eq("org_id", org.id)
          .not("competitor_id", "is", null);

        const competitorIds = [...new Set(
          ((trackedRows ?? []) as { competitor_id: string }[]).map((r) => r.competitor_id)
        )];

        if (competitorIds.length < MIN_COMPETITORS) {
          orgsSkipped++;
          continue; // pattern detection needs ≥2 competitors
        }

        // ── Competitor metadata (name) ───────────────────────────────────────
        const { data: compRows } = await supabase
          .from("competitors")
          .select("id, name")
          .in("id", competitorIds);

        const nameById = new Map<string, string>(
          ((compRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
        );
        const competitorNames = competitorIds
          .map((id) => nameById.get(id))
          .filter((n): n is string => !!n);

        // ── Signals in analysis window ───────────────────────────────────────
        // Join to monitored_pages for page_class and page_type (section_type).
        const signalQueryLimit = competitorIds.length * 15;
        const { data: signalRows } = await sb
          .from("signals")
          .select("id, competitor_id, detected_at, monitored_pages(page_class, page_type)")
          .in("competitor_id", competitorIds)
          .gte("detected_at", since)
          .eq("interpreted", true)
          .or("confidence_score.is.null,confidence_score.gte.0.40")
          .order("detected_at", { ascending: false })
          .limit(signalQueryLimit);

        if (signalRows && signalRows.length >= signalQueryLimit) {
          Sentry.addBreadcrumb({
            message: "sector_intelligence_signal_query_capped",
            level:   "warning",
            data:    { org_id: org.id, limit: signalQueryLimit, actual: signalRows.length },
          });
        }

        if (!signalRows || signalRows.length === 0) {
          orgsSkipped++;
          continue;
        }

        type RawSignal = {
          id: string;
          competitor_id: string;
          detected_at: string;
          monitored_pages: { page_class: string; page_type: string } | null;
        };

        // ── Interpretations (summary → changed_content_snippet) ──────────────
        const allSignalIds = (signalRows as RawSignal[]).map((s) => s.id);
        const { data: interpRows } = await supabase
          .from("interpretations")
          .select("signal_id, summary")
          .in("signal_id", allSignalIds);

        const summaryBySid = new Map<string, string>(
          ((interpRows ?? []) as { signal_id: string; summary: string }[])
            .filter((i) => i.summary)
            .map((i) => [i.signal_id, i.summary])
        );

        // ── Build flat signal list ────────────────────────────────────────────
        const allSignals: SignalForSector[] = (signalRows as RawSignal[])
          .filter((s) => s.monitored_pages)
          .map((s) => {
            const summary = summaryBySid.get(s.id) ?? null;
            return {
              signal_id:               s.id,
              competitor_id:           s.competitor_id,
              competitor_name:         nameById.get(s.competitor_id) ?? s.competitor_id,
              section_type:            s.monitored_pages!.page_type  ?? "unknown",
              page_class:              s.monitored_pages!.page_class ?? "standard",
              summary,
              changed_content_snippet: summary ? summary.slice(0, 300) : null,
              detected_at:             s.detected_at,
            };
          });

        if (allSignals.length === 0) {
          orgsSkipped++;
          continue;
        }

        // ── Apply selection strategy per competitor ───────────────────────────
        const signalsByCompetitor = new Map<string, SignalForSector[]>();
        for (const s of allSignals) {
          const arr = signalsByCompetitor.get(s.competitor_id) ?? [];
          arr.push(s);
          signalsByCompetitor.set(s.competitor_id, arr);
        }

        const selectedSignals: SignalForSector[] = [];
        for (const signals of signalsByCompetitor.values()) {
          selectedSignals.push(...selectSignalsForCompetitor(signals));
        }

        if (selectedSignals.length === 0) {
          orgsSkipped++;
          continue;
        }

        // ── Pivot signals by section_type ─────────────────────────────────────
        const sections = buildSectionPivot(selectedSignals, competitorNames);

        // ── Load sector narratives (last 14 days, max 5, confidence DESC) ─────
        const sector = org.sector ?? "custom";
        const narrativeCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: narrativeRows } = await sb
          .from("sector_narratives")
          .select("theme_label, keywords, source_count, article_count, confidence_score, last_detected_at")
          .eq("sector", sector)
          .gte("last_detected_at", narrativeCutoff)
          .order("confidence_score", { ascending: false })
          .limit(5);

        const narratives = (narrativeRows ?? []) as SectorNarrativeContext[];

        // ── GPT-4o sector analysis ────────────────────────────────────────────
        const result = await generateSectorIntelligence(
          sector,
          windowDays,
          sections,
          selectedSignals,
          narratives.length > 0 ? narratives : undefined
        ).catch(() => null);

        if (!result) {
          // Non-fatal: skip this org; pipeline and radar are unaffected
          Sentry.addBreadcrumb({
            message: "sector_intelligence_llm_failed",
            level:   "warning",
            data:    { org_id: org.id, sector },
          });
          continue;
        }

        // ── Store result ──────────────────────────────────────────────────────
        const { error: insertError } = await sb
          .from("sector_intelligence")
          .insert({
            org_id:               org.id,
            sector,
            analysis_window_days: windowDays,
            competitor_count:     competitorIds.length,
            signal_count:         selectedSignals.length,
            sector_trends:        result.sector_trends,
            divergences:          result.divergences,
            summary:              result.summary,
          });

        if (insertError) {
          Sentry.captureException(insertError);
        } else {
          analysesCreated++;
        }
      } catch (orgErr) {
        Sentry.captureException(
          orgErr instanceof Error ? orgErr : new Error(String(orgErr))
        );
        // Non-fatal — continue to next org
      }
    }

    await done("ok");
    return respond(res, startedAt, orgsProcessed, analysesCreated, orgsSkipped);
  } catch (error) {
    Sentry.captureException(error);
    await done("error");
    throw error;
  }

  async function done(status: "ok" | "error") {
    Sentry.setContext("run_metrics", {
      stage_name:       "generate-sector-intelligence",
      orgs_processed:   orgsProcessed,
      analyses_created: analysesCreated,
      orgs_skipped:     orgsSkipped,
      window_days:      windowDays,
      runtimeDurationMs: Date.now() - startedAt,
    });
    Sentry.captureCheckIn({ monitorSlug: "generate-sector-intelligence", status });
    await Sentry.flush(2000);
  }

  function respond(
    res: ApiRes, startedAt: number,
    processed: number, created: number, skipped: number
  ) {
    res.status(200).json({
      ok:               true,
      job:              "generate-sector-intelligence",
      orgs_processed:   processed,
      analyses_created: created,
      orgs_skipped:     skipped,
      window_days:      windowDays,
      runtimeDurationMs: Date.now() - startedAt,
    });
  }
}

export default withSentry("generate-sector-intelligence", handler);
