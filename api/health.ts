import "../lib/sentry";
import { ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

const STUCK_SIGNAL_MINUTES  = 240; // 4h — aligns with interpret-signals STALE_MINUTES (1440m); Vercel functions can't run >4h so anything stuck this long is genuinely broken
const RECENT_SIGNAL_DAYS    = 7;
const FETCH_STALE_HOURS     = 12;

// Fetch backlog SLA per page_class: warn when pending snapshots exceed these counts.
// high_value runs every hour, standard every 3h, ambient every 30min — so a large
// queue for any class indicates the fetcher is falling behind its crawl cadence.
const FETCH_BACKLOG_WARN_HIGH_VALUE = 20;
const FETCH_BACKLOG_WARN_STANDARD   = 50;
const FETCH_BACKLOG_WARN_AMBIENT    = 100;

// Backlog SLA thresholds — warns when a pipeline stage has unprocessed rows
// older than these values (in minutes). Set at 2× the typical cron cadence.
const BACKLOG_SNAPSHOT_WARN_MINUTES = 240; // 4h — extract-sections should clear
const BACKLOG_DIFF_WARN_MINUTES     = 480; // 8h — detect-signals runs every ~1h
const BACKLOG_SIGNAL_WARN_MINUTES   = 240; // 4h — interpret-signals runs every ~1h

// Suppression ratio threshold: if >90% of confirmed diffs in the last 24h are
// noise, something in the extraction / normalization chain may have drifted.
const SUPPRESSION_RATIO_WARN = 0.90;
const WINDOW_24H = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export default async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  try {
    const stuckBefore = new Date(
      Date.now() - STUCK_SIGNAL_MINUTES * 60 * 1000
    ).toISOString();

    const recentSince = new Date(
      Date.now() - RECENT_SIGNAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      // Existing checks
      latestFetchResult,
      snapshotBacklogResult,
      diffBacklogResult,
      signalBacklogResult,
      stuckSignalsResult,
      recentSignalsResult,
      failedSignalsResult,
      // Backlog age checks — oldest unprocessed row per stage
      oldestSnapshotResult,
      oldestDiffResult,
      oldestSignalResult,
      // 24h suppression ratio
      noiseDiffs24hResult,
      totalConfirmedDiffs24hResult,
      // Fetch backlog by page_class (sections_extracted=false, full quality only)
      fetchBacklogHighValueResult,
      fetchBacklogStandardResult,
      fetchBacklogAmbientResult,
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
        .eq("sections_extracted", false)
        .eq("fetch_quality", "full"),

      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("signal_detected", false)
        .eq("is_noise", false),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress")
        .lt("updated_at", stuckBefore),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .gt("detected_at", recentSince),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),

      // Oldest snapshot waiting extraction
      supabase
        .from("snapshots")
        .select("fetched_at")
        .eq("sections_extracted", false)
        .order("fetched_at", { ascending: true })
        .limit(1)
        .maybeSingle(),

      // Oldest confirmed diff waiting signal detection
      supabase
        .from("section_diffs")
        .select("last_seen_at")
        .eq("confirmed", true)
        .eq("signal_detected", false)
        .eq("is_noise", false)
        .order("last_seen_at", { ascending: true })
        .limit(1)
        .maybeSingle(),

      // Oldest pending signal waiting interpretation
      supabase
        .from("signals")
        .select("detected_at")
        .eq("status", "pending")
        .order("detected_at", { ascending: true })
        .limit(1)
        .maybeSingle(),

      // Noise diffs confirmed in last 24h
      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("confirmed", true)
        .eq("is_noise", true)
        .gte("last_seen_at", WINDOW_24H),

      // All confirmed diffs in last 24h (denominator for suppression ratio)
      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("confirmed", true)
        .gte("last_seen_at", WINDOW_24H),

      // Pending fetch backlog per page_class (full quality, not yet extracted)
      supabase
        .from("snapshots")
        .select("monitored_pages!inner(page_class)", { count: "exact", head: true })
        .eq("sections_extracted", false)
        .eq("fetch_quality", "full")
        .eq("monitored_pages.page_class", "high_value"),

      supabase
        .from("snapshots")
        .select("monitored_pages!inner(page_class)", { count: "exact", head: true })
        .eq("sections_extracted", false)
        .eq("fetch_quality", "full")
        .eq("monitored_pages.page_class", "standard"),

      supabase
        .from("snapshots")
        .select("monitored_pages!inner(page_class)", { count: "exact", head: true })
        .eq("sections_extracted", false)
        .eq("fetch_quality", "full")
        .eq("monitored_pages.page_class", "ambient"),
    ]);

    const coreResults = [
      latestFetchResult,
      snapshotBacklogResult,
      diffBacklogResult,
      signalBacklogResult,
      stuckSignalsResult,
      recentSignalsResult,
      failedSignalsResult,
    ];

    for (const result of coreResults) {
      if (result.error) throw result.error;
    }

    const latestFetchAt    = latestFetchResult.data?.fetched_at ?? null;
    const snapshotBacklog  = snapshotBacklogResult.count ?? 0;
    const diffBacklog      = diffBacklogResult.count ?? 0;
    const signalBacklog    = signalBacklogResult.count ?? 0;
    const stuckSignals     = stuckSignalsResult.count ?? 0;
    const recentSignals    = recentSignalsResult.count ?? 0;
    const failedSignals    = failedSignalsResult.count ?? 0;

    // ── Backlog age computation ────────────────────────────────────────────────
    const now = Date.now();

    const oldestSnapshotAt = oldestSnapshotResult.data?.fetched_at ?? null;
    const oldestDiffAt     = oldestDiffResult.data?.last_seen_at ?? null;
    const oldestSignalAt   = oldestSignalResult.data?.detected_at ?? null;

    const oldestSnapshotWaitingExtractionMinutes = oldestSnapshotAt
      ? Math.round((now - new Date(oldestSnapshotAt).getTime()) / 60_000) : 0;
    const oldestDiffWaitingSignalMinutes = oldestDiffAt
      ? Math.round((now - new Date(oldestDiffAt).getTime()) / 60_000) : 0;
    const oldestSignalWaitingInterpretationMinutes = oldestSignalAt
      ? Math.round((now - new Date(oldestSignalAt).getTime()) / 60_000) : 0;

    // ── Fetch backlog by page_class ───────────────────────────────────────────
    const fetchBacklogHighValue = fetchBacklogHighValueResult.count ?? 0;
    const fetchBacklogStandard  = fetchBacklogStandardResult.count ?? 0;
    const fetchBacklogAmbient   = fetchBacklogAmbientResult.count ?? 0;

    // ── Suppression ratio last 24h ─────────────────────────────────────────────
    const noiseDiffs24h   = noiseDiffs24hResult.count ?? 0;
    const totalDiffs24h   = totalConfirmedDiffs24hResult.count ?? 0;
    // Named "noiseDiffRatio" (not "suppressionRatio") to make clear this is a
    // diff-level noise rate, not the signal-stage suppression rate from detect-signals.
    const noiseDiffRatioLast24h = totalDiffs24h > 0
      ? parseFloat((noiseDiffs24h / totalDiffs24h).toFixed(3)) : 0;

    // ── Backlog SLA checks → Sentry warnings ──────────────────────────────────
    const pipelineBacklogWarnings: string[] = [];

    if (oldestSnapshotWaitingExtractionMinutes > BACKLOG_SNAPSHOT_WARN_MINUTES) {
      pipelineBacklogWarnings.push("snapshot_extraction_backlog");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:             "snapshot_extraction",
          oldest_age_minutes: oldestSnapshotWaitingExtractionMinutes,
          sla_minutes:        BACKLOG_SNAPSHOT_WARN_MINUTES,
        },
      });
    }

    if (oldestDiffWaitingSignalMinutes > BACKLOG_DIFF_WARN_MINUTES) {
      pipelineBacklogWarnings.push("diff_signal_backlog");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:             "diff_signal_detection",
          oldest_age_minutes: oldestDiffWaitingSignalMinutes,
          sla_minutes:        BACKLOG_DIFF_WARN_MINUTES,
        },
      });
    }

    if (oldestSignalWaitingInterpretationMinutes > BACKLOG_SIGNAL_WARN_MINUTES) {
      pipelineBacklogWarnings.push("signal_interpretation_backlog");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:             "signal_interpretation",
          oldest_age_minutes: oldestSignalWaitingInterpretationMinutes,
          sla_minutes:        BACKLOG_SIGNAL_WARN_MINUTES,
        },
      });
    }

    if (fetchBacklogHighValue > FETCH_BACKLOG_WARN_HIGH_VALUE) {
      pipelineBacklogWarnings.push("fetch_backlog_high_value");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:         "fetch_backlog",
          page_class:    "high_value",
          pending_count: fetchBacklogHighValue,
          threshold:     FETCH_BACKLOG_WARN_HIGH_VALUE,
        },
      });
    }

    if (fetchBacklogStandard > FETCH_BACKLOG_WARN_STANDARD) {
      pipelineBacklogWarnings.push("fetch_backlog_standard");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:         "fetch_backlog",
          page_class:    "standard",
          pending_count: fetchBacklogStandard,
          threshold:     FETCH_BACKLOG_WARN_STANDARD,
        },
      });
    }

    if (fetchBacklogAmbient > FETCH_BACKLOG_WARN_AMBIENT) {
      pipelineBacklogWarnings.push("fetch_backlog_ambient");
      Sentry.captureMessage("pipeline_backlog_warning", {
        level: "warning",
        extra: {
          stage:         "fetch_backlog",
          page_class:    "ambient",
          pending_count: fetchBacklogAmbient,
          threshold:     FETCH_BACKLOG_WARN_AMBIENT,
        },
      });
    }

    if (totalDiffs24h >= 10 && noiseDiffRatioLast24h >= SUPPRESSION_RATIO_WARN) {
      pipelineBacklogWarnings.push("high_suppression_ratio");
      Sentry.captureMessage("suppression_ratio_warning", {
        level: "warning",
        extra: {
          suppression_ratio_24h: noiseDiffRatioLast24h,
          noise_diffs_24h:       noiseDiffs24h,
          total_diffs_24h:       totalDiffs24h,
        },
      });
    }

    const fetchIsFresh = latestFetchAt
      ? now - new Date(latestFetchAt).getTime() < FETCH_STALE_HOURS * 60 * 60 * 1000
      : false;

    const healthy = fetchIsFresh && stuckSignals === 0 && pipelineBacklogWarnings.length === 0;

    res.status(200).json({
      ok: true,      // endpoint responded and executed without throwing
      healthy,       // system is operating within SLA thresholds (fetch fresh, no stuck signals, no backlog warnings)
      // Existing fields
      latestFetchAt,
      snapshotBacklog,
      diffBacklog,
      signalBacklog,
      stuckSignals,
      failedSignals,
      recentSignals,
      // Backlog age (Phase 4)
      oldestSnapshotWaitingExtractionMinutes,
      oldestDiffWaitingSignalMinutes,
      oldestSignalWaitingInterpretationMinutes,
      // Suppression ratio (Phase 6/8)
      noiseDiffRatioLast24h,
      noiseDiffs24h,
      totalDiffs24h,
      // Fetch backlog by page_class
      fetchBacklogByPageClass: {
        high_value: fetchBacklogHighValue,
        standard:   fetchBacklogStandard,
        ambient:    fetchBacklogAmbient,
      },
      // SLA warnings
      pipelineBacklogWarnings,
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    res.status(500).json({
      ok: false,
      healthy: false,
      error: "health_check_failed",
    });
  }
}
