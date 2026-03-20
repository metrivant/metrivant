import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { classifyInvestorEvent } from "../lib/investor-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Process up to 25 pending investor pool events per run.
const BATCH_SIZE = 25;

// Cross-pool dedup window: 48 hours.
// Companies frequently publish investor filings and press releases hours or a
// day apart for the same event. We prefer the investor signal.
const CROSS_POOL_DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

// Page-diff suppression window around the investor event's published_at.
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
}

// ── Deal value extraction ──────────────────────────────────────────────────────
// Parses dollar / pound / euro amounts from event text.
// Returns normalised value in $M equivalent, or null if no amount found.

function extractDealValue(text: string): number | null {
  const patterns: Array<[RegExp, boolean]> = [
    [/\$\s*([\d,.]+)\s*B(?:illion)?/i,   true],
    [/\$\s*([\d,.]+)\s*M(?:illion)?/i,   false],
    [/£\s*([\d,.]+)\s*B(?:illion)?/i,    true],
    [/£\s*([\d,.]+)\s*M(?:illion)?/i,    false],
    [/EUR\s*([\d,.]+)\s*B(?:illion)?/i,  true],
    [/EUR\s*([\d,.]+)\s*M(?:illion)?/i,  false],
    [/([\d,.]+)\s*billion/i,             true],
    [/([\d,.]+)\s*million/i,             false],
  ];
  for (const [p, isBillion] of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = parseFloat(m[1].replace(/,/g, ""));
      return isBillion ? raw * 1000 : raw;
    }
  }
  return null;
}

// ── Signal hash ────────────────────────────────────────────────────────────────
// sha256(competitorId:investorEventType:contentHash)[:32]
// Anchored to the pool_event's content_hash — one signal per unique investor event.

function computeInvestorSignalHash(
  competitorId:      string,
  investorEventType: string,
  contentHash:       string
): string {
  return createHash("sha256")
    .update(`${competitorId}:${investorEventType}:${contentHash}`)
    .digest("hex")
    .slice(0, 32);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-investor-signals", status: "in_progress" });

  try {
    // ── Load pending investor pool events ─────────────────────────────────────
    const { data: pendingRows, error: pendingError } = await supabase
      .from("pool_events")
      .select("id, competitor_id, source_type, source_url, event_type, title, summary, event_url, published_at, content_hash")
      .eq("event_type", "investor_update")
      .eq("normalization_status", "pending")
      .order("published_at", { ascending: true, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const events = (pendingRows ?? []) as PoolEventRow[];
    const rowsClaimed = events.length;

    if (rowsClaimed === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-investor-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-investor-signals",
        rowsClaimed:      0,
        rowsPromoted:     0,
        rowsSuppressed:   0,
        rowsLowRelevance: 0,
        rowsDuplicate:    0,
        newsroomSuppressed: 0,
        diffsSuppressed:  0,
        runtimeDurationMs: Date.now() - startedAt,
      });
    }

    // ── Pre-batch: load IR / newsroom page IDs per competitor ─────────────────
    const competitorIds = [...new Set(events.map((e) => e.competitor_id))];

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("competitor_id", competitorIds)
      .eq("active", true)
      .in("page_type", ["newsroom", "homepage"]);

    // Map: competitor_id → best page_id for signal context
    const contextPageMap = new Map<string, string>();
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      const existing = contextPageMap.get(p.competitor_id);
      if (!existing || p.page_type === "newsroom") {
        contextPageMap.set(p.competitor_id, p.id);
      }
    }

    // ── Pre-batch: classify all events + compute signal hashes ────────────────
    type EventMeta = {
      investorEventType: string;
      confidence:        number;
      signalHash:        string;
    };
    const eventMeta = new Map<string, EventMeta>();

    for (const event of events) {
      const classification = classifyInvestorEvent(event.title, event.summary);
      let confidence = classification.confidence;

      // ── Deal scale boost ────────────────────────────────────────────────────
      // Larger announced deal values are higher-certainty signals regardless of
      // keyword tier. Boosts are additive and capped at 1.0.
      const combinedText = `${event.title ?? ""} ${event.summary ?? ""}`;
      const dealValueM = extractDealValue(combinedText);
      if (dealValueM !== null) {
        if (dealValueM >= 1000)      confidence = Math.min(1.0, confidence + 0.12); // $1B+
        else if (dealValueM >= 100)  confidence = Math.min(1.0, confidence + 0.07); // $100M+
        else if (dealValueM >= 10)   confidence = Math.min(1.0, confidence + 0.03); // $10M+
      }

      const signalHash = computeInvestorSignalHash(
        event.competitor_id,
        classification.investorEventType,
        event.content_hash
      );
      eventMeta.set(event.id, {
        investorEventType: classification.investorEventType,
        confidence,
        signalHash,
      });
    }

    // Check existing signal hashes in one batch
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

        if (!event.title || event.title.length < 5) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "suppressed", suppression_reason: "title_too_short" })
            .eq("id", event.id);
          rowsLowRelevance += 1;
          continue;
        }

        if (!event.summary && !event.event_url) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "suppressed", suppression_reason: "no_content_or_url" })
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
          void recordEvent({ run_id: runId, stage: "investor_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: "duplicate_signal_hash" } });
          continue;
        }

        // ── Task 8: Cross-pool dedup — 48-hour window against newsroom pool ────
        // If the same strategic event appears in both newsroom and investor feeds,
        // prefer the investor signal. Suppress the newsroom one.
        if (event.event_url) {
          const windowStart48 = event.published_at
            ? new Date(new Date(event.published_at).getTime() - CROSS_POOL_DEDUP_WINDOW_MS).toISOString()
            : new Date(Date.now() - CROSS_POOL_DEDUP_WINDOW_MS).toISOString();
          const windowEnd48 = event.published_at
            ? new Date(new Date(event.published_at).getTime() + CROSS_POOL_DEDUP_WINDOW_MS).toISOString()
            : new Date().toISOString();

          // Find newsroom pool_events for same competitor with same event_url within 48h
          const { data: newsroomDups } = await supabase
            .from("pool_events")
            .select("id, promoted_signal_id, normalization_status")
            .eq("competitor_id", event.competitor_id)
            .eq("event_url", event.event_url)
            .in("source_type", ["rss", "atom", "newsroom_feed"]) // newsroom source types
            .neq("event_type", "job_posting")
            .gte("published_at", windowStart48)
            .lte("published_at", windowEnd48);

          const newsroomDupRows = (newsroomDups ?? []) as { id: string; promoted_signal_id: string | null; normalization_status: string }[];

          for (const dup of newsroomDupRows) {
            // If newsroom event promoted a signal → mark that signal as duplicate
            if (dup.promoted_signal_id) {
              await supabase
                .from("signals")
                .update({ is_duplicate: true })
                .eq("id", dup.promoted_signal_id);
              newsroomSuppressed += 1;
            }
            // Mark newsroom pool_event as suppressed (investor supersedes it)
            if (dup.normalization_status === "pending" || dup.normalization_status === "promoted") {
              await supabase
                .from("pool_events")
                .update({
                  normalization_status: "suppressed",
                  suppression_reason:   "superseded_by_investor_feed",
                })
                .eq("id", dup.id);
            }
          }
        }

        // ── Task 9: suppress investor page-diff signals ────────────────────────
        // If the investor relations page diff corresponds to this feed event,
        // mark the diff as signal_detected=true.
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

        // ── Build signal_data excerpt ──────────────────────────────────────────
        const currentExcerpt = [event.title, event.summary]
          .filter(Boolean)
          .join(". ")
          .slice(0, 500);

        // ── Create signal ──────────────────────────────────────────────────────
        const { data: newSignal, error: signalError } = await supabase
          .from("signals")
          .insert({
            competitor_id:     event.competitor_id,
            monitored_page_id: contextPageMap.get(event.competitor_id) ?? null,
            section_diff_id:   null,
            signal_type:       meta.investorEventType,
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
              previous_excerpt: null,
              current_excerpt:  currentExcerpt,
              investor_event_type: meta.investorEventType,
            },
          })
          .select("id")
          .single();

        if (signalError) {
          if (signalError.code === "23505") {
            // Race — another run created it
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

        // ── Store investor_event_type on pool_events + mark promoted ──────────
        await supabase
          .from("pool_events")
          .update({
            normalization_status: "promoted",
            promoted_signal_id:   promotedSignalId,
            investor_event_type:  meta.investorEventType,
          })
          .eq("id", event.id);

        rowsPromoted += 1;
        void recordEvent({
          run_id: runId,
          stage:  "investor_promote",
          status: "success",
          duration_ms: elapsed(),
          metadata: {
            pool_event_id:        event.id,
            signal_id:            promotedSignalId,
            signal_type:          meta.investorEventType,
            competitor_id:        event.competitor_id,
            confidence:           meta.confidence,
            newsroom_suppressed:  newsroomSuppressed,
            diffs_suppressed:     diffsSuppressed,
          },
        });
      } catch (eventError) {
        Sentry.captureException(eventError);
        void recordEvent({
          run_id: runId,
          stage:  "investor_promote",
          status: "failure",
          duration_ms: elapsed(),
          metadata: { pool_event_id: event.id, error: eventError instanceof Error ? eventError.message : JSON.stringify(eventError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:        "promote-investor-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      newsroomSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-investor-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-investor-signals",
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
    Sentry.captureCheckIn({ monitorSlug: "promote-investor-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-investor-signals", handler);
