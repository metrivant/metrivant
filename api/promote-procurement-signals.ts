import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { classifyProcurementEvent, HIGH_VALUE_PROCUREMENT_TYPES } from "../lib/procurement-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { findCrossPoolDuplicate } from "../lib/cross-pool-dedup";

// Process up to 25 pending procurement pool events per run.
const BATCH_SIZE = 25;

// Tiered cross-pool dedup windows per spec:
//   Procurement ↔ Newsroom:              72 hours for all event types
//   Procurement ↔ Investor (high-value): 120 hours (5 days) for
//     major_contract_award, program_award, framework_award
//   Procurement ↔ Investor (standard):   72 hours for other types
//
// Rationale: investor filings for material contracts often lag the government
// announcement by 2–5 business days.
const DEDUP_NEWSROOM_MS          =  72 * 60 * 60 * 1000; //  72h
const DEDUP_INVESTOR_HIGH_MS     = 120 * 60 * 60 * 1000; // 120h (5 days)
const DEDUP_INVESTOR_STANDARD_MS =  72 * 60 * 60 * 1000; //  72h

// Page-diff suppression window around the procurement event's published_at.
const DIFF_SUPPRESS_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 hours before
const DIFF_SUPPRESS_AFTER_MS  = 8 * 60 * 60 * 1000; // 8 hours after

interface PoolEventRow {
  id:              string;
  competitor_id:   string;
  source_type:     string;
  source_url:      string;
  event_type:      string;
  title:           string;
  summary:         string | null;
  event_url:       string | null;
  published_at:    string | null;
  content_hash:    string;
  awardee_name:    string | null;
  contract_value:  number | null;
  contract_id:     string | null;
  buyer_name:      string | null;
  program_name:    string | null;
}

// ── Procurement metadata extraction ───────────────────────────────────────────
// Extracts buyer_name, currency, program_name, region, and deal value from
// free-text title + summary. Best-effort; null on no match.

function extractProcurementMetadata(title: string, summary: string | null): {
  buyerName:   string | null;
  currency:    string | null;
  programName: string | null;
  region:      string | null;
  dealValueM:  number | null;
} {
  const text = `${title} ${summary ?? ""}`;

  // buyer_name: "awarded by [Agency]", "issued by [Agency]", etc.
  const buyerMatch = text.match(
    /(?:awarded by|issued by|contract from|procured by|purchased by)\s+([A-Z][^.,\n]{2,60}?)(?:\s*[.,]|\s+for|\s+to\b)/i
  );
  const buyerName = buyerMatch?.[1]?.trim() ?? null;

  // currency detection
  const currencyMatch = text.match(/\b(USD|GBP|EUR|AUD|CAD|JPY|£|€|\$)/);
  const currency = currencyMatch?.[1] ?? (text.includes("$") ? "USD" : null);

  // program_name: "under the [Program] program/contract/initiative/framework/vehicle"
  const programMatch = text.match(
    /(?:under the?|via the?|through the?)\s+([A-Z][^.,\n]{2,80}?)\s+(?:program|contract|initiative|framework|vehicle)/i
  );
  const programName = programMatch?.[1]?.trim() ?? null;

  // region: military commands, full country/region names, or US state abbreviations
  const regionPatterns: RegExp[] = [
    /\b(CONUS|OCONUS|CENTCOM|INDO-PACOM|EUCOM|AFRICOM)\b/,
    /\b(United States|UK|United Kingdom|Australia|Germany|France|Canada|Middle East|Europe|Asia Pacific|Indo-Pacific)\b/i,
    /\b([A-Z]{2})\b(?=\s+(?:state|region|territory))/,
  ];
  let region: string | null = null;
  for (const p of regionPatterns) {
    const m = text.match(p);
    if (m) { region = m[1]; break; }
  }

  // deal value — normalised to $M equivalent
  const valuePatterns: Array<{ r: RegExp; mult: number }> = [
    { r: /\$\s*([\d,.]+)\s*B/i,   mult: 1000 },
    { r: /\$\s*([\d,.]+)\s*M/i,   mult: 1    },
    { r: /([\d,.]+)\s*billion/i,  mult: 1000 },
    { r: /([\d,.]+)\s*million/i,  mult: 1    },
  ];
  let dealValueM: number | null = null;
  for (const { r, mult } of valuePatterns) {
    const m = text.match(r);
    if (m) { dealValueM = parseFloat(m[1].replace(/,/g, "")) * mult; break; }
  }

  return { buyerName, currency, programName, region, dealValueM };
}

// ── Signal hash ────────────────────────────────────────────────────────────────
// sha256(competitorId:procurementEventType:contentHash)[:32]
// When a stable contract_id is available, anchor to that instead of content_hash
// for a more stable dedup key across different feed representations of the same award.

function computeProcurementSignalHash(
  competitorId:         string,
  procurementEventType: string,
  contentHash:          string,
  contractId:           string | null | undefined
): string {
  const anchor = contractId
    ? `contract_id:${contractId}`
    : `content_hash:${contentHash}`;
  return createHash("sha256")
    .update(`${competitorId}:${procurementEventType}:${anchor}`)
    .digest("hex")
    .slice(0, 32);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "promote-procurement-signals", status: "in_progress" });

  try {
    // ── Load pending procurement pool events ──────────────────────────────────
    const { data: pendingRows, error: pendingError } = await supabase
      .from("pool_events")
      .select("id, competitor_id, source_type, source_url, event_type, title, summary, event_url, published_at, content_hash, awardee_name, contract_value, contract_id, buyer_name, program_name")
      .eq("event_type", "procurement_event")
      .eq("normalization_status", "pending")
      .order("published_at", { ascending: true, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pendingError) throw pendingError;

    const events = (pendingRows ?? []) as PoolEventRow[];
    const rowsClaimed = events.length;

    if (rowsClaimed === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-procurement-signals", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-procurement-signals",
        rowsClaimed:        0,
        rowsPromoted:       0,
        rowsSuppressed:     0,
        rowsLowRelevance:   0,
        rowsDuplicate:      0,
        newsroomSuppressed: 0,
        investorSuppressed: 0,
        diffsSuppressed:    0,
        runtimeDurationMs:  Date.now() - startedAt,
      });
    }

    // ── Pre-batch: load monitored page IDs per competitor ─────────────────────
    // Procurement events don't map cleanly to a page type; fall back to newsroom
    // or homepage as the context page for interpretation.
    const competitorIds = [...new Set(events.map((e) => e.competitor_id))];

    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, page_type")
      .in("competitor_id", competitorIds)
      .eq("active", true)
      .in("page_type", ["newsroom", "homepage", "features"]);

    const contextPageMap = new Map<string, string>();
    for (const p of ((pageRows ?? []) as { id: string; competitor_id: string; page_type: string }[])) {
      const existing = contextPageMap.get(p.competitor_id);
      if (!existing || p.page_type === "newsroom") {
        contextPageMap.set(p.competitor_id, p.id);
      }
    }

    // ── Pre-batch: classify all events + compute signal hashes ────────────────
    type EventMeta = {
      procurementEventType: string;
      confidence:           number;
      signalHash:           string;
      isHighValue:          boolean;
    };
    const eventMeta = new Map<string, EventMeta>();

    for (const event of events) {
      const classification = classifyProcurementEvent(event.title, event.summary, event.contract_value);
      let confidence = classification.confidence;

      // ── Deal scale boost ────────────────────────────────────────────────────
      // Extract structured metadata from free text; boost confidence for larger deals.
      const { buyerName, currency, programName, region, dealValueM } =
        extractProcurementMetadata(event.title, event.summary);

      // Update pool_event with extracted metadata (best-effort, non-blocking).
      // Only send the update when at least one field was extracted to avoid
      // unnecessary round-trips on events that already have structured data.
      if (buyerName || currency || programName || region) {
        void supabase
          .from("pool_events")
          .update({ buyer_name: buyerName, currency, program_name: programName, region })
          .eq("id", event.id)
          .then(null, () => {}); // non-blocking
      }

      if (dealValueM !== null) {
        if (dealValueM >= 1000)      confidence = Math.min(1.0, confidence + 0.12); // $1B+
        else if (dealValueM >= 100)  confidence = Math.min(1.0, confidence + 0.07); // $100M+
        else if (dealValueM >= 10)   confidence = Math.min(1.0, confidence + 0.03); // $10M+
      }

      const signalHash = computeProcurementSignalHash(
        event.competitor_id,
        classification.procurementEventType,
        event.content_hash,
        event.contract_id
      );
      eventMeta.set(event.id, {
        procurementEventType: classification.procurementEventType,
        confidence,
        signalHash,
        isHighValue:          HIGH_VALUE_PROCUREMENT_TYPES.has(classification.procurementEventType as never),
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
    let investorSuppressed = 0;
    let diffsSuppressed    = 0;

    for (const event of events) {
      const elapsed = startTimer();
      const meta    = eventMeta.get(event.id)!;

      try {
        // ── Relevance gate ─────────────────────────────────────────────────────
        if (event.published_at) {
          const ageMs = Date.now() - new Date(event.published_at).getTime();
          if (ageMs > 180 * 24 * 60 * 60 * 1000) {
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

        // ── Standard signal hash dedup ─────────────────────────────────────────
        if (existingHashes.has(meta.signalHash)) {
          await supabase
            .from("pool_events")
            .update({ normalization_status: "duplicate" })
            .eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "procurement_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: "duplicate_signal_hash" } });
          continue;
        }

        const publishedMs = event.published_at ? new Date(event.published_at).getTime() : Date.now();

        // ── Task 8a: Cross-pool dedup against newsroom pool (72h window) ───────
        // If the same contract announcement was published via newsroom feed,
        // prefer procurement signal (contains structured award evidence).
        if (event.event_url) {
          const ns = new Date(publishedMs - DEDUP_NEWSROOM_MS).toISOString();
          const ne = new Date(publishedMs + DEDUP_NEWSROOM_MS).toISOString();

          const { data: newsroomDups } = await supabase
            .from("pool_events")
            .select("id, promoted_signal_id, normalization_status")
            .eq("competitor_id", event.competitor_id)
            .eq("event_url", event.event_url)
            .in("source_type", ["rss", "atom", "newsroom_feed"])
            .in("event_type", ["press_release", "newsroom_post"])
            .gte("published_at", ns)
            .lte("published_at", ne);

          for (const dup of ((newsroomDups ?? []) as { id: string; promoted_signal_id: string | null; normalization_status: string }[])) {
            if (dup.promoted_signal_id) {
              await supabase.from("signals").update({ is_duplicate: true }).eq("id", dup.promoted_signal_id);
              newsroomSuppressed += 1;
            }
            if (dup.normalization_status === "pending" || dup.normalization_status === "promoted") {
              await supabase
                .from("pool_events")
                .update({ normalization_status: "suppressed", suppression_reason: "superseded_by_procurement_feed" })
                .eq("id", dup.id);
            }
          }
        }

        // ── Task 8b: Cross-pool dedup against investor pool (tiered window) ────
        // High-value types: 120h (5-day) window — investor filings lag government
        // announcements by 2–5 business days.
        // Standard types: 72h window.
        if (event.event_url) {
          const investorWindowMs = meta.isHighValue ? DEDUP_INVESTOR_HIGH_MS : DEDUP_INVESTOR_STANDARD_MS;
          const is = new Date(publishedMs - investorWindowMs).toISOString();
          const ie = new Date(publishedMs + investorWindowMs).toISOString();

          const { data: investorDups } = await supabase
            .from("pool_events")
            .select("id, promoted_signal_id, normalization_status")
            .eq("competitor_id", event.competitor_id)
            .eq("event_url", event.event_url)
            .in("source_type", ["investor_rss", "investor_atom", "investor_feed"])
            .eq("event_type", "investor_update")
            .gte("published_at", is)
            .lte("published_at", ie);

          for (const dup of ((investorDups ?? []) as { id: string; promoted_signal_id: string | null; normalization_status: string }[])) {
            if (dup.promoted_signal_id) {
              await supabase.from("signals").update({ is_duplicate: true }).eq("id", dup.promoted_signal_id);
              investorSuppressed += 1;
            }
            if (dup.normalization_status === "pending" || dup.normalization_status === "promoted") {
              await supabase
                .from("pool_events")
                .update({ normalization_status: "suppressed", suppression_reason: "superseded_by_procurement_feed" })
                .eq("id", dup.id);
            }
          }
        }

        // ── Task 9: suppress page-diff signals on monitored pages ─────────────
        // If Metrivant is monitoring a newsroom / homepage page and a diff
        // coincides with this procurement event, suppress the diff.
        const contextPageId = contextPageMap.get(event.competitor_id);
        if (contextPageId && event.published_at) {
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
        const valueNote = event.contract_value
          ? ` (value: ${event.contract_value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })})`
          : "";
        const buyerNote = event.buyer_name ? ` — buyer: ${event.buyer_name}` : "";
        const currentExcerpt = [
          `${event.title}${valueNote}${buyerNote}`,
          event.summary,
        ]
          .filter(Boolean)
          .join(". ")
          .slice(0, 500);

        // ── Cross-pool dedup check ──────────────────────────────────────────
        const dedup = await findCrossPoolDuplicate(
          event.competitor_id, meta.procurementEventType, currentExcerpt, event.published_at ?? new Date().toISOString()
        );
        if (dedup.isDuplicate) {
          await supabase.from("pool_events").update({ normalization_status: "duplicate" }).eq("id", event.id);
          rowsDuplicate += 1;
          void recordEvent({ run_id: runId, stage: "procurement_promote", status: "skipped", duration_ms: elapsed(), metadata: { pool_event_id: event.id, reason: `cross_pool_dedup:${dedup.matchReason}`, matched_signal: dedup.matchedSignalId } });
          continue;
        }

        // ── Create signal ──────────────────────────────────────────────────────
        const { data: newSignal, error: signalError } = await supabase
          .from("signals")
          .insert({
            competitor_id:     event.competitor_id,
            monitored_page_id: contextPageMap.get(event.competitor_id) ?? null,
            section_diff_id:   null,
            signal_type:       meta.procurementEventType,
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
              previous_excerpt:      null,
              current_excerpt:       currentExcerpt,
              procurement_event_type: meta.procurementEventType,
              awardee_name:          event.awardee_name ?? null,
              contract_value:        event.contract_value ?? null,
              contract_id:           event.contract_id ?? null,
              buyer_name:            event.buyer_name ?? null,
              program_name:          event.program_name ?? null,
            },
          })
          .select("id")
          .single();

        if (signalError) {
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

        await supabase
          .from("pool_events")
          .update({
            normalization_status:   "promoted",
            promoted_signal_id:     promotedSignalId,
            procurement_event_type: meta.procurementEventType,
          })
          .eq("id", event.id);

        rowsPromoted += 1;
        void recordEvent({
          run_id: runId,
          stage:  "procurement_promote",
          status: "success",
          duration_ms: elapsed(),
          metadata: {
            pool_event_id:        event.id,
            signal_id:            promotedSignalId,
            signal_type:          meta.procurementEventType,
            competitor_id:        event.competitor_id,
            confidence:           meta.confidence,
            is_high_value:        meta.isHighValue,
            newsroom_suppressed:  newsroomSuppressed,
            investor_suppressed:  investorSuppressed,
            diffs_suppressed:     diffsSuppressed,
          },
        });
      } catch (eventError) {
        Sentry.captureException(eventError);
        void recordEvent({
          run_id: runId,
          stage:  "procurement_promote",
          status: "failure",
          duration_ms: elapsed(),
          metadata: { pool_event_id: event.id, error: eventError instanceof Error ? eventError.message : JSON.stringify(eventError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:        "promote-procurement-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      newsroomSuppressed,
      investorSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-procurement-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-procurement-signals",
      rowsClaimed,
      rowsPromoted,
      rowsSuppressed,
      rowsLowRelevance,
      rowsDuplicate,
      newsroomSuppressed,
      investorSuppressed,
      diffsSuppressed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-procurement-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-procurement-signals", handler);
