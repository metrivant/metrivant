import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { RETENTION_DAYS } from "../lib/retention-config";
import { recordEvent, generateRunId } from "../lib/pipeline-metrics";

/**
 * retention
 *
 * Daily data retention cleanup. Four independent tiers — each runs in its own
 * try/catch so a failure in one tier never blocks the others.
 *
 * Policy (from lib/retention-config.ts):
 *   RAW_HTML            7d  — null, not row-deleted
 *   EXTRACTED_SECTIONS  90d — delete, skip rows still referenced by baselines/diffs
 *   DIFFS              180d — delete, skip rows still referenced by signals
 *   PIPELINE_EVENTS     90d — delete unconditionally (pure telemetry)
 *   MEDIA_OBSERVATIONS  30d — delete unconditionally (ephemeral media staging; no FK references)
 *
 * Never deletes: signals, interpretations, signal_feedback, section_baselines, sector_narratives
 *
 * Runs daily at 03:00 UTC — low urgency. A missed run causes no data loss.
 */

interface TierResult {
  affected: number;
  error:    string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase as any;

async function runTier(
  fn: string,
  args: Record<string, number>
): Promise<TierResult> {
  try {
    const { data, error } = await rpc.rpc(fn, args);
    if (error) throw error;
    return { affected: (data as number) ?? 0, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { retention_tier: fn } });
    return { affected: 0, error: msg };
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = generateRunId();

  Sentry.captureCheckIn({ monitorSlug: "retention", status: "in_progress" });

  // ── Tier 1: NULL raw HTML ─────────────────────────────────────────────────
  const t1 = await runTier("retention_null_raw_html", { cutoff_days: RETENTION_DAYS.RAW_HTML });

  // ── Tier 2: Delete old extracted sections ─────────────────────────────────
  const t2 = await runTier("retention_delete_sections", { cutoff_days: RETENTION_DAYS.EXTRACTED_SECTIONS });

  // ── Tier 3: Delete old diffs ──────────────────────────────────────────────
  const t3 = await runTier("retention_delete_diffs", { cutoff_days: RETENTION_DAYS.DIFFS });

  // ── Tier 4: Delete old pipeline_events ───────────────────────────────────
  const t4 = await runTier("retention_delete_pipeline_events", { cutoff_days: RETENTION_DAYS.PIPELINE_EVENTS });

  // ── Tier 5: Delete old media_observations ────────────────────────────────
  // Inline DELETE — no Postgres RPC needed (no FK references on this table).
  const t5 = await (async (): Promise<TierResult> => {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS.MEDIA_OBSERVATIONS * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, count } = await (supabase as any)
        .from("media_observations")
        .delete({ count: "exact" })
        .lt("created_at", cutoff);
      if (error) throw error;
      return { affected: count ?? 0, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Sentry.captureException(err, { tags: { retention_tier: "media_observations" } });
      return { affected: 0, error: msg };
    }
  })();

  const runtimeDurationMs = Date.now() - startedAt;
  const anyError = t1.error ?? t2.error ?? t3.error ?? t4.error ?? t5.error ?? null;
  const overallStatus = anyError ? "partial" : "ok";

  // ── Record retention event to pipeline_events ─────────────────────────────
  void recordEvent({
    run_id:   runId,
    stage:    "retention",
    status:   anyError ? "failure" : "success",
    metadata: {
      raw_html_nulled:            t1.affected,
      sections_deleted:           t2.affected,
      diffs_deleted:              t3.affected,
      events_deleted:             t4.affected,
      media_observations_deleted: t5.affected,
      tier_errors: {
        raw_html:           t1.error,
        sections:           t2.error,
        diffs:              t3.error,
        events:             t4.error,
        media_observations: t5.error,
      },
    },
  });

  Sentry.setContext("run_metrics", {
    stage_name:                 "retention",
    raw_html_nulled:            t1.affected,
    sections_deleted:           t2.affected,
    diffs_deleted:              t3.affected,
    events_deleted:             t4.affected,
    media_observations_deleted: t5.affected,
    tier1_error:                t1.error,
    tier2_error:                t2.error,
    tier3_error:                t3.error,
    tier4_error:                t4.error,
    tier5_error:                t5.error,
    runtimeDurationMs,
  });

  Sentry.captureCheckIn({
    monitorSlug: "retention",
    status: anyError ? "error" : "ok",
  });

  await Sentry.flush(2000);

  res.status(200).json({
    ok:     true,
    job:    "retention",
    status: overallStatus,
    tiers: {
      raw_html:           t1,
      sections:           t2,
      diffs:              t3,
      events:             t4,
      media_observations: t5,
    },
    retention_days: RETENTION_DAYS,
    runtimeDurationMs,
  });
}

export default withSentry("retention", handler);
