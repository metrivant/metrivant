import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { findCrossPoolDuplicate } from "../lib/cross-pool-dedup";

// Feed signals are given a fixed confidence of 0.80:
//   • Above the 0.65 CONFIDENCE_INTERPRET threshold → status='pending' immediately
//   • Above the 0.75 model routing threshold → gpt-4o used in interpret-signals
// This reflects that feed entries are first-party announcements, not inferred changes.
const FEED_SIGNAL_CONFIDENCE = 0.80;

// Process up to 25 pending pool events per run.
// Each event requires 2–3 DB round-trips. 25 × 3 = 75 calls, safe within Vercel timeout.
const BATCH_SIZE = 25;

// Time window for newsroom page-diff suppression.
// If a newsroom diff lands within this window of the feed entry's publication time,
// we mark it as signal_detected=true so detect-signals skips it.
// Feed signal is the richer representation — structured title + URL vs. raw diff excerpt.
//
// BEFORE: 2h — press releases rarely appear in feeds before going live on the site.
//              Keeping this tight prevents suppressing updates made before the announcement.
//
// AFTER:  12h — covers worst-case pipeline lag for standard-class pages:
//               3h crawl cycle + 15min extract-sections + 30min detect-diffs +
//               30min detect-signals + 30min promote = ~5h worst case.
//               12h gives 7h buffer above that without swallowing genuine same-day
//               editorial updates (corrections, added links) as non-events.
//
// Title similarity suppression (≥0.8 Jaccard) is deferred to Phase 2 once we
// have empirical data on which diffs are genuine vs. feed echoes. Adding it now
// without calibration data risks over-suppression during the observation window.
const DIFF_SUPPRESS_WINDOW_BEFORE_MS =  2 * 60 * 60 * 1000; //  2 hours before published_at
const DIFF_SUPPRESS_WINDOW_AFTER_MS  = 12 * 60 * 60 * 1000; // 12 hours after published_at

interface PoolEventRow {
  id:             string;
  competitor_id:  string;
  source_type:    string;
  source_url:     string;
  event_type:     string;
  title:          string;
  summary:        string | null;
  event_url:      string | null;
  published_at:   string | null;
  content_hash:   string;
}

// ── Relevance classification (deterministic) ───────────────────────────────────
// A first-pass filter before signal creation. No AI in this step.
//
// candidate_relevant: event is worth promoting into a signal
// low_relevance:      event lacks enough content to be useful
// suppressed:         event is definitively not useful (too old, malformed)

type NormalizationStatus = "candidate_relevant" | "low_relevance" | "suppressed";

function classifyEvent(event: PoolEventRow): { status: NormalizationStatus; reason?: string } {
  // Too old — archived entries from feed history.
  if (event.published_at) {
    const ageMs = Date.now() - new Date(event.published_at).getTime();
    if (ageMs > 90 * 24 * 60 * 60 * 1000) {
      return { status: "suppressed", reason: "too_old" };
    }
  }

  // Title too short to be meaningful.
  if (!event.title || event.title.length < 5) {
    return { status: "low_relevance", reason: "title_too_short" };
  }

  // No summary AND no event_url: nothing for the AI to interpret beyond a title.
  // Keep entries that have at least a URL (model can infer from title + URL context).
  if (!event.summary && !event.event_url) {
    return { status: "low_relevance", reason: "no_content_or_url" };
  }

  return { status: "candidate_relevant" };
}

// ── Signal hash for feed-sourced signals ──────────────────────────────────────
// sha256(competitor_id:signal_type:content_hash)[:32]
// Anchored to the pool_event content_hash rather than a diff ID.
// One signal per (competitor, signal_type, feed entry content) — dedup on re-runs.

function computeFeedSignalHash(
  competitorId: string,
  signalType:   string,
  contentHash:  string
): string {
  return createHash("sha256")
    .update(`${competitorId}:${signalType}:${contentHash}`)
    .digest("hex")
    .slice(0, 32);
}

// ── Signal type mapping ────────────────────────────────────────────────────────

function resolveSignalType(eventType: string): string {
  if (eventType === "press_release")  return "feed_press_release";
  if (eventType === "investor_update") return "feed_newsroom_post"; // future: feed_investor_update
  return "feed_newsroom_post";
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-feed-signals", status: "in_progress" });

  try {
    // ── Load pending newsroom pool events ─────────────────────────────────────
    // Scoped to newsroom event types — careers/investor/product events are handled
    // by their own promote-* handlers. Without this filter, those events would be
    // mis-classified as newsroom signals.
    const { data: pendingRows, error: pendingError } = await supabase
      .from("pool_events")
      .select("id, competitor_id, source_type, source_url, event_type, title, summary, event_url, published_at, content_hash")
      .eq("normalization_status", "pending")
      .in("event_type", ["press_release", "newsroom_post"])
      .order("published_at", { ascending: true, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const events = (pendingRows ?? []) as PoolEventRow[];
    const rowsClaimed = events.length;

    if (rowsClaimed === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-feed-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-feed-signals",
        rowsClaimed: 0,
        rowsPromoted: 0,
        rowsSuppressed: 0,
        rowsLowRelevance: 0,
        rowsDuplicate: 0,
        diffsSuppressed: 0,
        runtimeDurationMs: Date.now() - startedAt,
      });
    }

    // ── Pre-batch: load newsroom page IDs per competitor ──────────────────────
    // Used for (1) monitored_page_id on the signal and (2) newsroom diff suppression.
    const competitorIds = [...new Set(events.map((e) => e.competitor_id))];

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("competitor_id", competitorIds)
      .eq("active", true)
      .in("page_type", ["newsroom", "homepage", "features"]); // prefer newsroom for context

    // Build map: competitor_id → { newsroom page id, fallback page id }
    const newsroomPageMap = new Map<string, string>(); // competitor_id → page_id
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      const existing = newsroomPageMap.get(p.competitor_id);
      // Prefer newsroom over fallback page types.
      if (!existing || p.page_type === "newsroom") {
        newsroomPageMap.set(p.competitor_id, p.id);
      }
    }

    // ── Pre-batch: load existing signal hashes for potential feed signals ─────
    const potentialHashes = new Map<string, string>(); // pool_event.id → signal_hash
    for (const event of events) {
      const signalType = resolveSignalType(event.event_type);
      const hash = computeFeedSignalHash(event.competitor_id, signalType, event.content_hash);
      potentialHashes.set(event.id, hash);
    }

    const { data: existingHashRows } = await supabase
      .from("signals")
      .select("signal_hash")
      .in("signal_hash", [...potentialHashes.values()]);

    const existingHashes = new Set<string>(
      ((existingHashRows ?? []) as { signal_hash: string }[]).map((r) => r.signal_hash)
    );

    // ── Process each event ────────────────────────────────────────────────────
    let rowsPromoted     = 0;
    let rowsSuppressed   = 0;
    let rowsLowRelevance = 0;
    let rowsDuplicate    = 0;
    let diffsSuppressed   = 0;

    for (const event of events) {
      const elapsed    = startTimer();
      const signalType = resolveSignalType(event.event_type);
      const signalHash = potentialHashes.get(event.id)!;

      try {
        // ── Relevance gate ─────────────────────────────────────────────────────
        const classification = classifyEvent(event);

        if (classification.status === "suppressed") {
          await supabase
            .from("pool_events")
            .update({
              normalization_status: "suppressed",
              suppression_reason:   classification.reason ?? "classified_suppressed",
            })
            .eq("id", event.id);
          rowsSuppressed += 1;
          void recordEvent({ run_id: runId, stage: "feed_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: classification.reason } });
          continue;
        }

        if (classification.status === "low_relevance") {
          await supabase
            .from("pool_events")
            .update({
              normalization_status: "suppressed",
              suppression_reason:   classification.reason ?? "low_relevance",
            })
            .eq("id", event.id);
          rowsLowRelevance += 1;
          void recordEvent({ run_id: runId, stage: "feed_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: classification.reason } });
          continue;
        }

        // ── Duplicate signal check ─────────────────────────────────────────────
        if (existingHashes.has(signalHash)) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "duplicate" })
            .eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "feed_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: "duplicate_signal_hash" } });
          continue;
        }

        // ── Task 7: suppress overlapping newsroom page-diff signals ───────────
        // If Metrivant is both monitoring the newsroom page and ingesting its feed,
        // the same press release may appear as both a feed event and a page diff.
        // Pre-emptively mark the newsroom diffs as signal_detected=true so
        // detect-signals skips them. Feed signal is the richer representation.
        const newsroomPageId = newsroomPageMap.get(event.competitor_id);
        if (newsroomPageId && event.published_at) {
          const publishedMs = new Date(event.published_at).getTime();
          const windowStart = new Date(publishedMs - DIFF_SUPPRESS_WINDOW_BEFORE_MS).toISOString();
          const windowEnd   = new Date(publishedMs + DIFF_SUPPRESS_WINDOW_AFTER_MS).toISOString();

          const { data: conflictingDiffs } = await supabase
            .from("section_diffs")
            .select("id")
            .eq("monitored_page_id", newsroomPageId)
            .eq("signal_detected", false)
            .eq("confirmed", true)
            .gte("last_seen_at", windowStart)
            .lte("last_seen_at", windowEnd);

          const diffIds = ((conflictingDiffs ?? []) as { id: string }[]).map((d) => d.id);
          if (diffIds.length > 0) {
            await supabase
              .from("section_diffs")
              .update({ signal_detected: true, is_noise: false })
              .in("id", diffIds);
            diffsSuppressed += diffIds.length;
          }
        }

        // ── Build signal_data excerpt ──────────────────────────────────────────
        // Feed signals are NEW content (no previous state).
        // previous_excerpt: null — interpret-signals renders "(no previous content available)"
        // current_excerpt: title + summary, gives the AI enough context to interpret.
        const currentExcerpt = [event.title, event.summary]
          .filter(Boolean)
          .join(". ")
          .slice(0, 500);

        // ── Cross-pool dedup check ──────────────────────────────────────────
        const dedup = await findCrossPoolDuplicate(
          event.competitor_id, signalType, currentExcerpt, event.published_at ?? new Date().toISOString()
        );
        if (dedup.isDuplicate) {
          await supabase.from("pool_events").update({ normalization_status: "duplicate" }).eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "feed_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: `cross_pool_dedup:${dedup.matchReason}`, matched_signal: dedup.matchedSignalId } });
          continue;
        }

        // ── Create signal ──────────────────────────────────────────────────────
        // confidence 0.80 ≥ CONFIDENCE_INTERPRET (0.65) → status='pending'
        // confidence 0.80 ≥ model threshold (0.75) → gpt-4o used in interpret-signals
        const { data: newSignal, error: signalError } = await supabase
          .from("signals")
          .insert({
            competitor_id:     event.competitor_id,
            monitored_page_id: newsroomPageId ?? null,
            section_diff_id:   null,
            signal_type:       signalType,
            severity:          "medium",
            confidence_score:  FEED_SIGNAL_CONFIDENCE,
            signal_hash:       signalHash,
            source_type:       "feed_event",
            status:            "pending",
            interpreted:       false,
            retry_count:       0,
            is_duplicate:      false,
            detected_at:       event.published_at ?? new Date().toISOString(),
            signal_data:       {
              previous_excerpt: null,
              current_excerpt:  currentExcerpt,
            },
          })
          .select("id")
          .single();

        if (signalError) {
          // Conflict on signal_hash means a race created it — treat as duplicate.
          if (signalError.code === "23505") {
            await supabase
              .from("pool_events")
              .update({ normalization_status: "duplicate" })
              .eq("id", event.id);
            rowsDuplicate += 1;
            continue;
          }
          throw signalError;
        }

        const promotedSignalId = (newSignal as { id: string } | null)?.id ?? null;

        // ── Mark pool_event as promoted ────────────────────────────────────────
        await supabase
          .from("pool_events")
          .update({
            normalization_status: "promoted",
            promoted_signal_id:   promotedSignalId,
          })
          .eq("id", event.id);

        rowsPromoted += 1;
        void recordEvent({
          run_id: runId,
          stage:  "feed_promote",
          status: "success",
          duration_ms: elapsed(),
          metadata: {
            pool_event_id: event.id,
            signal_id:     promotedSignalId,
            signal_type:   signalType,
            competitor_id: event.competitor_id,
            diffs_suppressed: diffsSuppressed,
          },
        });
      } catch (eventError) {
        Sentry.captureException(eventError);
        void recordEvent({
          run_id: runId,
          stage:  "feed_promote",
          status: "failure",
          duration_ms: elapsed(),
          metadata: { pool_event_id: event.id, error: eventError instanceof Error ? eventError.message : JSON.stringify(eventError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:       "promote-feed-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-feed-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-feed-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      diffsSuppressed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-feed-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-feed-signals", handler);
