import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { classifyProductEvent } from "../lib/product-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { findCrossPoolDuplicate } from "../lib/cross-pool-dedup";

// Process up to 25 pending product pool events per run.
const BATCH_SIZE = 25;

// Cross-pool dedup window: 48 hours.
// The same product launch may appear in both product feed and newsroom feed
// hours or a day apart. Product feed origin is preferred for product events.
const CROSS_POOL_DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

// Page-diff suppression window around the product event's published_at.
const DIFF_SUPPRESS_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 hours before
const DIFF_SUPPRESS_AFTER_MS  = 6 * 60 * 60 * 1000; // 6 hours after

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
  version_tag:    string | null;
}

// ── Signal hash ────────────────────────────────────────────────────────────────
// sha256(competitorId:productEventType:contentHash)[:32]
// Anchored to the pool_event's content_hash — one signal per unique product release.

function computeProductSignalHash(
  competitorId:     string,
  productEventType: string,
  contentHash:      string
): string {
  return createHash("sha256")
    .update(`${competitorId}:${productEventType}:${contentHash}`)
    .digest("hex")
    .slice(0, 32);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-product-signals", status: "in_progress" });

  try {
    // ── Load pending product pool events ──────────────────────────────────────
    const { data: pendingRows, error: pendingError } = await supabase
      .from("pool_events")
      .select("id, competitor_id, source_type, source_url, event_type, title, summary, event_url, published_at, content_hash, version_tag")
      .eq("event_type", "product_release")
      .eq("normalization_status", "pending")
      .order("published_at", { ascending: true, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const events = (pendingRows ?? []) as PoolEventRow[];
    const rowsClaimed = events.length;

    if (rowsClaimed === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-product-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-product-signals",
        rowsClaimed:        0,
        rowsPromoted:       0,
        rowsSuppressed:     0,
        rowsLowRelevance:   0,
        rowsDuplicate:      0,
        newsroomSuppressed: 0,
        diffsSuppressed:    0,
        runtimeDurationMs:  Date.now() - startedAt,
      });
    }

    // ── Pre-batch: load product / changelog page IDs per competitor ───────────
    const competitorIds = [...new Set(events.map((e) => e.competitor_id))];

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("competitor_id", competitorIds)
      .eq("active", true)
      .in("page_type", ["changelog", "blog", "features", "newsroom", "homepage"]);

    // Map: competitor_id → best context page_id
    // Preference: changelog > blog > features > newsroom > homepage
    const PAGE_TYPE_PRIORITY: Record<string, number> = {
      changelog: 5, blog: 4, features: 3, newsroom: 2, homepage: 1,
    };
    const contextPageMap = new Map<string, string>();
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      const existing = contextPageMap.get(p.competitor_id);
      if (!existing) {
        contextPageMap.set(p.competitor_id, p.id);
      } else {
        // Check if this page type has higher priority
        const existingType = ((pageRows ?? []) as { id: string; page_type: string }[])
          .find((r) => r.id === existing)?.page_type ?? "homepage";
        if ((PAGE_TYPE_PRIORITY[p.page_type] ?? 0) > (PAGE_TYPE_PRIORITY[existingType] ?? 0)) {
          contextPageMap.set(p.competitor_id, p.id);
        }
      }
    }

    // Also build a set of changelog/blog/features page IDs for diff suppression
    const changelogPageMap = new Map<string, string>(); // competitor_id → changelog page_id
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      if (["changelog", "blog", "features"].includes(p.page_type)) {
        const existing = changelogPageMap.get(p.competitor_id);
        if (!existing || (PAGE_TYPE_PRIORITY[p.page_type] ?? 0) > (PAGE_TYPE_PRIORITY[
          ((pageRows ?? []) as { id: string; page_type: string }[]).find((r) => r.id === existing)?.page_type ?? "blog"
        ] ?? 0)) {
          changelogPageMap.set(p.competitor_id, p.id);
        }
      }
    }

    // ── Pre-batch: classify all events + compute signal hashes ────────────────
    type EventMeta = {
      productEventType: string;
      confidence:       number;
      signalHash:       string;
      classifiedBy:     string;
    };
    const eventMeta = new Map<string, EventMeta>();

    for (const event of events) {
      const classification = classifyProductEvent(event.title, event.summary, event.version_tag);
      const signalHash = computeProductSignalHash(
        event.competitor_id,
        classification.productEventType,
        event.content_hash
      );
      eventMeta.set(event.id, {
        productEventType: classification.productEventType,
        confidence:       classification.confidence,
        signalHash,
        classifiedBy:     classification.classifiedBy,
      });
    }

    // Batch-check existing signal hashes
    const allHashes = [...eventMeta.values()].map((m) => m.signalHash);
    const { data: existingHashRows } = await supabase
      .from("signals")
      .select("signal_hash")
      .in("signal_hash", allHashes);

    const existingHashes = new Set<string>(
      ((existingHashRows ?? []) as { signal_hash: string }[]).map((r) => r.signal_hash)
    );

    // ── Process each event ────────────────────────────────────────────────────
    let rowsPromoted       = 0;
    let rowsSuppressed     = 0;
    let rowsLowRelevance   = 0;
    let rowsDuplicate      = 0;
    let newsroomSuppressed = 0;
    let diffsSuppressed    = 0;

    for (const event of events) {
      const elapsed = startTimer();
      const meta    = eventMeta.get(event.id)!;

      try {
        // ── Relevance gate ─────────────────────────────────────────────────────
        if (event.published_at) {
          const ageMs = Date.now() - new Date(event.published_at).getTime();
          if (ageMs > 90 * 24 * 60 * 60 * 1000) {
            await supabase
              .from("pool_events")
              .update({ normalization_status: "suppressed", suppression_reason: "too_old" })
              .eq("id", event.id);
            rowsSuppressed += 1;
            continue;
          }
        }

        if (!event.title || event.title.length < 3) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "suppressed", suppression_reason: "title_too_short" })
            .eq("id", event.id);
          rowsLowRelevance += 1;
          continue;
        }

        // ── Standard signal hash dedup ─────────────────────────────────────────
        if (existingHashes.has(meta.signalHash)) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "duplicate" })
            .eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "product_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: "duplicate_signal_hash" } });
          continue;
        }

        // ── Task 8a: Cross-pool dedup — 48-hour window against newsroom pool ───
        // If the same product launch was already published in the newsroom feed,
        // prefer the product feed signal. Suppress the newsroom signal.
        if (event.event_url) {
          const publishedMs    = event.published_at ? new Date(event.published_at).getTime() : Date.now();
          const windowStart48  = new Date(publishedMs - CROSS_POOL_DEDUP_WINDOW_MS).toISOString();
          const windowEnd48    = new Date(publishedMs + CROSS_POOL_DEDUP_WINDOW_MS).toISOString();

          const { data: newsroomDups } = await supabase
            .from("pool_events")
            .select("id, promoted_signal_id, normalization_status")
            .eq("competitor_id", event.competitor_id)
            .eq("event_url", event.event_url)
            .in("source_type", ["rss", "atom", "newsroom_feed"])
            .neq("event_type", "job_posting")
            .neq("event_type", "investor_update")
            .gte("published_at", windowStart48)
            .lte("published_at", windowEnd48);

          const newsroomDupRows = (newsroomDups ?? []) as { id: string; promoted_signal_id: string | null; normalization_status: string }[];

          for (const dup of newsroomDupRows) {
            if (dup.promoted_signal_id) {
              await supabase
                .from("signals")
                .update({ is_duplicate: true })
                .eq("id", dup.promoted_signal_id);
              newsroomSuppressed += 1;
            }
            if (dup.normalization_status === "pending" || dup.normalization_status === "promoted") {
              await supabase
                .from("pool_events")
                .update({
                  normalization_status: "suppressed",
                  suppression_reason:   "superseded_by_product_feed",
                })
                .eq("id", dup.id);
            }
          }
        }

        // ── Task 8b: suppress changelog page-diff signals ──────────────────────
        // Mark confirmed changelog/blog/features diffs within the event window
        // as signal_detected=true so detect-signals skips them.
        const changelogPageId = changelogPageMap.get(event.competitor_id);
        if (changelogPageId && event.published_at) {
          const publishedMs  = new Date(event.published_at).getTime();
          const windowStart2 = new Date(publishedMs - DIFF_SUPPRESS_BEFORE_MS).toISOString();
          const windowEnd2   = new Date(publishedMs + DIFF_SUPPRESS_AFTER_MS).toISOString();

          const { data: conflictingDiffs } = await supabase
            .from("section_diffs")
            .select("id")
            .eq("monitored_page_id", changelogPageId)
            .eq("signal_detected", false)
            .eq("confirmed", true)
            .gte("last_seen_at", windowStart2)
            .lte("last_seen_at", windowEnd2);

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
        const versionNote  = event.version_tag ? ` (${event.version_tag})` : "";
        const currentExcerpt = [
          `${event.title}${versionNote}`,
          event.summary,
        ]
          .filter(Boolean)
          .join(". ")
          .slice(0, 500);

        // ── Cross-pool dedup check ──────────────────────────────────────────
        const dedup = await findCrossPoolDuplicate(
          event.competitor_id, meta.productEventType, currentExcerpt, event.published_at ?? new Date().toISOString()
        );
        if (dedup.isDuplicate) {
          await supabase.from("pool_events").update({ normalization_status: "duplicate" }).eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "product_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: `cross_pool_dedup:${dedup.matchReason}`, matched_signal: dedup.matchedSignalId } });
          continue;
        }

        // ── Create signal ──────────────────────────────────────────────────────
        const { data: newSignal, error: signalError } = await supabase
          .from("signals")
          .insert({
            competitor_id:     event.competitor_id,
            monitored_page_id: contextPageMap.get(event.competitor_id) ?? null,
            section_diff_id:   null,
            signal_type:       meta.productEventType,
            severity:          "medium",
            confidence_score:  meta.confidence,
            signal_hash:       meta.signalHash,
            source_type:       "feed_event",
            status:            "pending",
            interpreted:       false,
            retry_count:       0,
            is_duplicate:      false,
            detected_at:       event.published_at ?? new Date().toISOString(),
            signal_data:       {
              previous_excerpt:   null,
              current_excerpt:    currentExcerpt,
              product_event_type: meta.productEventType,
              version_tag:        event.version_tag ?? null,
              classified_by:      meta.classifiedBy,
            },
          })
          .select("id")
          .single();

        if (signalError) {
          if (signalError.code === "23505") {
            // Race on signal_hash unique constraint
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

        // ── Store product_event_type on pool_events + mark promoted ───────────
        await supabase
          .from("pool_events")
          .update({
            normalization_status: "promoted",
            promoted_signal_id:   promotedSignalId,
            product_event_type:   meta.productEventType,
          })
          .eq("id", event.id);

        rowsPromoted += 1;
        void recordEvent({
          run_id: runId,
          stage:  "product_promote",
          status: "success",
          duration_ms: elapsed(),
          metadata: {
            pool_event_id:       event.id,
            signal_id:           promotedSignalId,
            signal_type:         meta.productEventType,
            competitor_id:       event.competitor_id,
            confidence:          meta.confidence,
            classified_by:       meta.classifiedBy,
            version_tag:         event.version_tag,
            newsroom_suppressed: newsroomSuppressed,
            diffs_suppressed:    diffsSuppressed,
          },
        });
      } catch (eventError) {
        Sentry.captureException(eventError);
        void recordEvent({
          run_id: runId,
          stage:  "product_promote",
          status: "failure",
          duration_ms: elapsed(),
          metadata: { pool_event_id: event.id, error: eventError instanceof Error ? eventError.message : JSON.stringify(eventError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:        "promote-product-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      newsroomSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-product-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-product-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      newsroomSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-product-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-product-signals", handler);
