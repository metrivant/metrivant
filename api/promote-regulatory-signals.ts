import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import {
  classifyRegulatoryEvent,
  HIGH_VALUE_REGULATORY_TYPES,
  type RegulatoryEventType,
} from "../lib/regulatory-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { findCrossPoolDuplicate } from "../lib/cross-pool-dedup";

// Process up to 25 pending regulatory pool events per run.
const BATCH_SIZE = 25;

// Standard cross-pool dedup window: 72 hours.
// Regulatory signals often trail newsroom/investor coverage of the same event.
// We prefer the regulatory signal (legally authoritative source).
const DEDUP_WINDOW_STANDARD_MS   = 72  * 60 * 60 * 1000;

// Extended window for high-value filings (material_event, acquisition_disclosure,
// major_contract_disclosure, product_approval): the same event commonly appears
// across newsroom, investor, and regulatory feeds over a 5-day window.
const DEDUP_WINDOW_HIGH_VALUE_MS = 120 * 60 * 60 * 1000;

// Page-diff suppression window around the regulatory event's published_at.
const DIFF_SUPPRESS_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 hours before
const DIFF_SUPPRESS_AFTER_MS  = 8 * 60 * 60 * 1000; // 8 hours after

interface PoolEventRow {
  id:              string;
  competitor_id:   string;
  source_type:     string;
  source_url:      string | null;
  event_type:      string;
  title:           string;
  summary:         string | null;
  event_url:       string | null;
  published_at:    string | null;
  content_hash:    string;
  filing_type:     string | null;
  filing_id:       string | null;
  regulatory_body: string | null;
  jurisdiction:    string | null;
}

// ── Signal hash ────────────────────────────────────────────────────────────────
// sha256(competitorId:regulatoryEventType:stableKey)[:32]
//
// stableKey = filing_id when available (SEC accession number is stable across
// all feeds that reference the same EDGAR filing), otherwise content_hash.
// This prevents duplicate signals when the same SEC filing appears in both
// a competitor-scoped EDGAR feed and a sector-scoped regulatory source.

function computeRegulatorySignalHash(
  competitorId:        string,
  regulatoryEventType: string,
  stableKey:           string
): string {
  return createHash("sha256")
    .update(`${competitorId}:${regulatoryEventType}:${stableKey}`)
    .digest("hex")
    .slice(0, 32);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-regulatory-signals", status: "in_progress" });

  try {
    // ── Load pending regulatory pool events ───────────────────────────────────
    const { data: pendingRows, error: pendingError } = await supabase
      .from("pool_events")
      .select("id, competitor_id, source_type, source_url, event_type, title, summary, event_url, published_at, content_hash, filing_type, filing_id, regulatory_body, jurisdiction")
      .eq("event_type", "regulatory_filing")
      .eq("normalization_status", "pending")
      .order("published_at", { ascending: true, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const events     = (pendingRows ?? []) as PoolEventRow[];
    const rowsClaimed = events.length;

    if (rowsClaimed === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-regulatory-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-regulatory-signals",
        rowsClaimed:        0,
        rowsPromoted:       0,
        rowsSuppressed:     0,
        rowsLowRelevance:   0,
        rowsDuplicate:      0,
        crossPoolSuppressed: 0,
        diffsSuppressed:    0,
        runtimeDurationMs:  Date.now() - startedAt,
      });
    }

    // ── Pre-batch: load newsroom + homepage page IDs per competitor ────────────
    // Regulatory signals prefer the newsroom page as context; fall back to homepage.
    const competitorIds = [...new Set(events.map((e) => e.competitor_id))];

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("competitor_id", competitorIds)
      .eq("active", true)
      .in("page_type", ["newsroom", "homepage"]);

    const contextPageMap = new Map<string, string>();
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      const existing = contextPageMap.get(p.competitor_id);
      if (!existing || p.page_type === "newsroom") {
        contextPageMap.set(p.competitor_id, p.id);
      }
    }

    // ── Pre-batch: classify all events + compute signal hashes ────────────────
    type EventMeta = {
      regulatoryEventType: RegulatoryEventType;
      confidence:          number;
      signalHash:          string;
      classifiedBy:        string;
    };
    const eventMeta = new Map<string, EventMeta>();

    for (const event of events) {
      const classification = classifyRegulatoryEvent(
        event.title,
        event.summary,
        event.filing_type
      );
      // Use filing_id as the stable key when available; otherwise content_hash.
      const stableKey  = event.filing_id ?? event.content_hash;
      const signalHash = computeRegulatorySignalHash(
        event.competitor_id,
        classification.regulatoryEventType,
        stableKey
      );
      eventMeta.set(event.id, {
        regulatoryEventType: classification.regulatoryEventType,
        confidence:          classification.confidence,
        signalHash,
        classifiedBy:        classification.classifiedBy,
      });
    }

    // Check existing signal hashes in one batch query.
    const allHashes = [...eventMeta.values()].map((m) => m.signalHash);
    const { data: existingHashRows } = await supabase
      .from("signals")
      .select("signal_hash")
      .in("signal_hash", allHashes);

    const existingHashes = new Set<string>(
      ((existingHashRows ?? []) as { signal_hash: string }[]).map((r) => r.signal_hash)
    );

    // ── Process each event ────────────────────────────────────────────────────
    let rowsPromoted        = 0;
    let rowsSuppressed      = 0;
    let rowsLowRelevance    = 0;
    let rowsDuplicate       = 0;
    let crossPoolSuppressed = 0;
    let diffsSuppressed     = 0;

    for (const event of events) {
      const elapsed = startTimer();
      const meta    = eventMeta.get(event.id)!;

      try {
        // ── Relevance gates ────────────────────────────────────────────────────
        if (event.published_at) {
          const ageMs = Date.now() - new Date(event.published_at).getTime();
          if (ageMs > 365 * 24 * 60 * 60 * 1000) {
            await supabase
              .from("pool_events")
              .update({ normalization_status: "suppressed", suppression_reason: "too_old" })
              .eq("id", event.id);
            rowsSuppressed += 1;
            continue;
          }
        }

        if (!event.title || event.title.length < 5) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "suppressed", suppression_reason: "title_too_short" })
            .eq("id", event.id);
          rowsLowRelevance += 1;
          continue;
        }

        // ── Signal hash dedup ──────────────────────────────────────────────────
        if (existingHashes.has(meta.signalHash)) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "duplicate" })
            .eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "regulatory_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: "duplicate_signal_hash" } });
          continue;
        }

        // ── Cross-pool dedup: investor + newsroom ──────────────────────────────
        // Regulatory signals take precedence over investor and newsroom pool
        // events for the same story. When a matching event_url is found in
        // either pool within the dedup window, suppress the non-regulatory signal.
        if (event.event_url) {
          const isHighValue = HIGH_VALUE_REGULATORY_TYPES.has(meta.regulatoryEventType);
          const windowMs    = isHighValue ? DEDUP_WINDOW_HIGH_VALUE_MS : DEDUP_WINDOW_STANDARD_MS;
          const baseTime    = event.published_at
            ? new Date(event.published_at).getTime()
            : Date.now();
          const windowStart = new Date(baseTime - windowMs).toISOString();
          const windowEnd   = new Date(baseTime + windowMs).toISOString();

          const { data: crossPoolDups } = await supabase
            .from("pool_events")
            .select("id, promoted_signal_id, normalization_status")
            .eq("competitor_id", event.competitor_id)
            .eq("event_url", event.event_url)
            .in("event_type", ["investor_update", "press_release", "newsroom_post"])
            .gte("published_at", windowStart)
            .lte("published_at", windowEnd);

          const dupRows = (crossPoolDups ?? []) as {
            id: string;
            promoted_signal_id: string | null;
            normalization_status: string;
          }[];

          for (const dup of dupRows) {
            if (dup.promoted_signal_id) {
              await supabase
                .from("signals")
                .update({ is_duplicate: true })
                .eq("id", dup.promoted_signal_id);
              crossPoolSuppressed += 1;
            }
            if (dup.normalization_status === "pending" || dup.normalization_status === "promoted") {
              await supabase
                .from("pool_events")
                .update({
                  normalization_status: "suppressed",
                  suppression_reason:   "superseded_by_regulatory_feed",
                })
                .eq("id", dup.id);
            }
          }
        }

        // ── Page-diff suppression ──────────────────────────────────────────────
        // If a monitored page diff (newsroom/homepage) was recorded within the
        // suppression window of this regulatory filing's publication date,
        // mark the diff as signal_detected so it isn't double-processed.
        const contextPageId = contextPageMap.get(event.competitor_id);
        if (contextPageId && event.published_at) {
          const publishedMs  = new Date(event.published_at).getTime();
          const windowStart2 = new Date(publishedMs - DIFF_SUPPRESS_BEFORE_MS).toISOString();
          const windowEnd2   = new Date(publishedMs + DIFF_SUPPRESS_AFTER_MS).toISOString();

          const { data: conflictingDiffs } = await supabase
            .from("section_diffs")
            .select("id")
            .eq("monitored_page_id", contextPageId)
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

        // ── Build signal excerpt ───────────────────────────────────────────────
        const currentExcerpt = [event.title, event.summary]
          .filter(Boolean)
          .join(". ")
          .slice(0, 500);

        // ── Cross-pool dedup check ──────────────────────────────────────────
        const dedup = await findCrossPoolDuplicate(
          event.competitor_id, meta.regulatoryEventType, currentExcerpt, event.published_at ?? new Date().toISOString()
        );
        if (dedup.isDuplicate) {
          await supabase.from("pool_events").update({ normalization_status: "duplicate" }).eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "regulatory_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: `cross_pool_dedup:${dedup.matchReason}`, matched_signal: dedup.matchedSignalId } });
          continue;
        }

        // ── Create signal ──────────────────────────────────────────────────────
        const { data: newSignal, error: signalError } = await supabase
          .from("signals")
          .insert({
            competitor_id:     event.competitor_id,
            monitored_page_id: contextPageMap.get(event.competitor_id) ?? null,
            section_diff_id:   null,
            signal_type:       meta.regulatoryEventType,
            severity:          "medium",
            confidence_score:  meta.confidence,
            signal_hash:       meta.signalHash,
            source_type:       "feed_event",
            status:            "pending",
            interpreted:       false,
            retry_count:       0,
            is_duplicate:      false,
            detected_at:       event.published_at ?? new Date().toISOString(),
            signal_data: {
              previous_excerpt:       null,
              current_excerpt:        currentExcerpt,
              regulatory_event_type:  meta.regulatoryEventType,
              filing_type:            event.filing_type    ?? null,
              filing_id:              event.filing_id      ?? null,
              regulatory_body:        event.regulatory_body ?? null,
              jurisdiction:           event.jurisdiction   ?? null,
              classified_by:          meta.classifiedBy,
            },
          })
          .select("id")
          .single();

        if (signalError) {
          if (signalError.code === "23505") {
            // Race condition — another run created this signal first.
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

        // ── Store regulatory_event_type + mark promoted ────────────────────────
        await supabase
          .from("pool_events")
          .update({
            normalization_status:  "promoted",
            promoted_signal_id:    promotedSignalId,
            regulatory_event_type: meta.regulatoryEventType,
          })
          .eq("id", event.id);

        rowsPromoted += 1;
        void recordEvent({
          run_id: runId,
          stage:  "regulatory_promote",
          status: "success",
          duration_ms: elapsed(),
          metadata: {
            pool_event_id:          event.id,
            signal_id:              promotedSignalId,
            signal_type:            meta.regulatoryEventType,
            competitor_id:          event.competitor_id,
            confidence:             meta.confidence,
            classified_by:          meta.classifiedBy,
            cross_pool_suppressed:  crossPoolSuppressed,
            diffs_suppressed:       diffsSuppressed,
          },
        });
      } catch (eventError) {
        Sentry.captureException(eventError);
        void recordEvent({
          run_id: runId,
          stage:  "regulatory_promote",
          status: "failure",
          duration_ms: elapsed(),
          metadata: { pool_event_id: event.id, error: eventError instanceof Error ? eventError.message : JSON.stringify(eventError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:          "promote-regulatory-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      crossPoolSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-regulatory-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-regulatory-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      crossPoolSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-regulatory-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-regulatory-signals", handler);
