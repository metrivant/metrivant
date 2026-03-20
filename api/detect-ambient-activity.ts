import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

/**
 * detect-ambient-activity
 *
 * Processes confirmed diffs from ambient-class pages (blog, careers, feeds).
 * Instead of creating signals (which flow to OpenAI), these create activity_events —
 * lightweight records that feed the UI ticker, radar node micro-activity, and
 * the pressure_index computation.
 *
 * Ambient activity intentionally bypasses:
 *   - signal confidence gating
 *   - OpenAI interpretation
 *   - strategic_movements aggregation
 *
 * It can still influence AI interpretation indirectly via the pressure_index:
 * if ambient activity pushes a competitor's pressure_index above the threshold,
 * update-pressure-index will promote any pending_review signals to pending.
 */

// ── Activity type classification ──────────────────────────────────────────────

const AMBIENT_EVENT_TYPES: Record<string, string> = {
  release_feed:      "content_update",
  announcements:     "announcement",
  careers_feed:      "hiring_activity",
  press_feed:        "press_mention",
  product_mentions:  "product_update",
  blog_feed:         "blog_post",
  headline:          "messaging_update",
  hero:              "messaging_update",
  default:           "page_change",
};

function classifyAmbientEvent(sectionType: string): string {
  return AMBIENT_EVENT_TYPES[sectionType] ?? AMBIENT_EVENT_TYPES.default;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AmbientDiffRow {
  id: string;
  section_type: string;
  monitored_page_id: string;
  last_seen_at: string | null;
  monitored_pages: {
    competitor_id: string;
    url: string;
  } | null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  let rowsClaimed     = 0;
  let rowsProcessed   = 0;
  let rowsSucceeded   = 0;
  let rowsFailed      = 0;
  let eventsCreated   = 0;

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "detect-ambient-activity",
    status: "in_progress",
  });

  try {
    // page_class is denormalized onto section_diffs (migration 022).
    // Filter directly at the DB layer — hits idx_section_diffs_ambient_pending
    // (partial index: confirmed=true, signal_detected=false, is_noise=false,
    // page_class='ambient') with no overlap with the detect-signals index.
    const { data: diffs, error } = await supabase
      .from("section_diffs")
      .select(`
        id,
        section_type,
        monitored_page_id,
        last_seen_at,
        monitored_pages!inner ( competitor_id, url )
      `)
      .eq("confirmed", true)
      .eq("signal_detected", false)
      .eq("is_noise", false)
      .eq("page_class", "ambient")
      .order("last_seen_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    rowsClaimed = (diffs ?? []).length;

    for (const diff of (diffs ?? []) as unknown as AmbientDiffRow[]) {
      rowsProcessed += 1;

      try {
        const competitorId = diff.monitored_pages?.competitor_id;
        const url          = diff.monitored_pages?.url ?? null;

        if (!competitorId) {
          throw new Error(`Diff ${diff.id} has no competitor_id`);
        }

        const eventType = classifyAmbientEvent(diff.section_type);

        const { error: insertError } = await supabase
          .from("activity_events")
          .insert({
            competitor_id:   competitorId,
            event_type:      eventType,
            source_headline: null,
            url,
            detected_at:     diff.last_seen_at ?? new Date().toISOString(),
            page_class:      "ambient",
            raw_data:        { section_type: diff.section_type },
          });

        if (insertError) throw insertError;

        // Mark diff as processed so it doesn't re-enter this loop.
        const { error: updateError } = await supabase
          .from("section_diffs")
          .update({ signal_detected: true })
          .eq("id", diff.id);

        if (updateError) throw updateError;

        eventsCreated += 1;
        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    // Inline retention pruning — all three calls are non-fatal.
    // Runs at the end of the ambient stage (least-frequent pipeline stage)
    // to keep storage bounded without a separate maintenance cron job.
    try {
      // activity_events: 30-day rolling window (already existed, now via RPC).
      await supabase.rpc("prune_activity_events");
      // snapshots: raw_html column — 90 days after sections extracted.
      await supabase.rpc("prune_old_snapshots");
      // section_diffs: 90 days (clean), 180 days (noise).
      await supabase.rpc("prune_old_section_diffs");
    } catch (pruneError) {
      Sentry.captureException(pruneError);
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      eventsCreated,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "detect-ambient-activity",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-ambient-activity",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      eventsCreated,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "detect-ambient-activity",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-ambient-activity", handler);
