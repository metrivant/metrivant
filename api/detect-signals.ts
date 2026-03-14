import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";

// ── Signal weight constants ───────────────────────────────────────────────────
// Base confidence contribution by section type.
// pricing > positioning > product/feature > ambient.

const SECTION_WEIGHTS: Record<string, number> = {
  pricing_plans:        0.85,
  pricing_references:   0.85,
  hero:                 0.65,
  headline:             0.60,
  nav_links:            0.55,
  cta_blocks:           0.55,
  release_feed:         0.55,
  announcements:        0.55,
  features_overview:    0.50,
  press_feed:           0.50,
  product_mentions:     0.45,
  careers_feed:         0.30,
};

const DEFAULT_WEIGHT = 0.25;

// Confidence thresholds — gate signal interpretation cost.
const CONFIDENCE_SUPPRESS  = 0.35; // below this: no signal created
const CONFIDENCE_INTERPRET = 0.65; // at or above: status='pending' → sent to OpenAI
//                                    between these: status='pending_review'
//                                    → skipped by AI until pressure_index promotes them

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiffRow {
  id: string;
  previous_section_id: string | null;
  current_section_id: string;
  section_type: string;
  monitored_page_id: string;
  last_seen_at: string | null;
  observation_count: number | null;
  monitored_pages: {
    page_class: string;
    competitor_id: string;
  } | null;
}

interface PageSectionRow {
  id: string;
  section_text: string;
  section_hash: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeConfidence(
  sectionType: string,
  observationCount: number,
  lastSeenAt: string | null,
  pageClass: string
): number {
  const base = SECTION_WEIGHTS[sectionType] ?? DEFAULT_WEIGHT;

  // Recency bonus: fresher detections carry more weight.
  const ageMs = lastSeenAt
    ? Date.now() - new Date(lastSeenAt).getTime()
    : Infinity;
  const recencyBonus =
    ageMs < 2  * 3600 * 1000 ? 0.15 :
    ageMs < 24 * 3600 * 1000 ? 0.10 : 0.05;

  // Observation bonus: each additional confirmation (+0.05, max 0.15).
  const obsBonus = Math.min(0.15, Math.max(0, (observationCount - 1) * 0.05));

  // Page class bonus: high_value pages (pricing, changelog, newsroom) carry
  // more inherent signal quality than standard or ambient pages.
  const pageClassBonus = pageClass === "high_value" ? 0.08 : 0;

  return Math.min(1.0, base + recencyBonus + obsBonus + pageClassBonus);
}

function computeSignalHash(
  competitorId: string,
  signalType: string,
  sectionType: string,
  lastSeenAt: string | null
): string {
  // Bucket by UTC calendar day — one signal per (competitor, section_type, signal_type) per day.
  // Including section_type allows independent signals when the same signal_type fires
  // from different page sections (e.g., pricing_plans vs pricing_references).
  const dateBucket = (lastSeenAt ? new Date(lastSeenAt) : new Date())
    .toISOString()
    .slice(0, 10); // "YYYY-MM-DD"
  return createHash("sha256")
    .update(`${competitorId}:${signalType}:${sectionType}:${dateBucket}`)
    .digest("hex")
    .slice(0, 32);
}

// Normalize machine-generated dynamic tokens before semantic comparison.
// Strips ISO 8601 timestamps and tracking query parameters — these rotate
// on every page load and create false diffs with no competitive intelligence.
function normalizeForComparison(text: string): string {
  let t = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "");
  t = t.replace(/[?&](?:utm_[a-z_]+|fbclid|gclid|msclkid|_ga)=[^&\s"']*/gi, "");
  return t.replace(/\s+/g, " ").trim();
}

// Extract excerpts anchored at the first divergence point rather than position 0.
// When content is prepended (e.g., a new pricing tier added at the top), the
// change is immediately visible in the excerpt instead of being truncated away.
function buildExcerpts(
  previousText: string,
  currentText: string,
  windowSize = 200
): { previous_excerpt: string; current_excerpt: string } {
  if (previousText.length <= windowSize && currentText.length <= windowSize) {
    return { previous_excerpt: previousText, current_excerpt: currentText };
  }

  // Find the first character position where the two texts diverge.
  let divergeAt = 0;
  const minLen = Math.min(previousText.length, currentText.length);
  while (divergeAt < minLen && previousText[divergeAt] === currentText[divergeAt]) {
    divergeAt += 1;
  }

  // Back up ~40 chars before the divergence point for context, then snap to a
  // word boundary so we don't start mid-token.
  const contextStart = Math.max(0, divergeAt - 40);
  const wordBoundary = previousText.lastIndexOf(" ", contextStart);
  const start = wordBoundary > 0 ? wordBoundary + 1 : contextStart;

  return {
    previous_excerpt: previousText.slice(start, start + windowSize) || previousText.slice(0, windowSize),
    current_excerpt:  currentText.slice(start, start + windowSize)  || currentText.slice(0, windowSize),
  };
}

function classifySignal(
  sectionType: string,
  previousText: string,
  currentText: string
): { signal_type: string; severity: string; signal_data: Record<string, string> } {
  const excerpts = buildExcerpts(previousText, currentText);

  switch (sectionType) {
    case "pricing_plans":
    case "pricing_references":
      return { signal_type: "price_point_change", severity: "high",   signal_data: excerpts };

    case "hero":
    case "headline":
    case "nav_links":
    case "cta_blocks":
      return { signal_type: "positioning_shift",  severity: "medium", signal_data: excerpts };

    case "release_feed":
    case "announcements":
    case "features_overview":
    case "press_feed":
    case "product_mentions":
      return { signal_type: "feature_launch",     severity: "medium", signal_data: excerpts };

    case "careers_feed":
      return { signal_type: "hiring_surge",       severity: "low",    signal_data: excerpts };

    default:
      return { signal_type: "content_change",     severity: "low",    signal_data: excerpts };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  let rowsClaimed        = 0;
  let rowsProcessed      = 0;
  let rowsSucceeded      = 0;
  let rowsFailed         = 0;
  let signalsCreated     = 0;
  let signalsSuppressed  = 0; // confidence < CONFIDENCE_SUPPRESS
  let signalsDeduplicated = 0; // same hash already exists today
  let signalsPendingReview = 0; // CONFIDENCE_SUPPRESS ≤ confidence < CONFIDENCE_INTERPRET

  Sentry.captureCheckIn({
    monitorSlug: "detect-signals",
    status: "in_progress",
  });

  try {
    // Join monitored_pages to get page_class and competitor_id.
    // Ambient pages are handled by detect-ambient-activity and are excluded here.
    const { data: diffs, error } = await supabase
      .from("section_diffs")
      .select(`
        id,
        previous_section_id,
        current_section_id,
        section_type,
        monitored_page_id,
        last_seen_at,
        observation_count,
        monitored_pages!inner ( page_class, competitor_id )
      `)
      .eq("confirmed", true)
      .eq("signal_detected", false)
      .eq("is_noise", false)
      .order("last_seen_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    // Exclude ambient pages — those produce activity_events via detect-ambient-activity.
    const eligibleDiffs = ((diffs ?? []) as unknown as DiffRow[]).filter(
      (d) => d.monitored_pages?.page_class !== "ambient"
    );

    rowsClaimed = eligibleDiffs.length;

    // ── Pre-batch: load all referenced page_sections in 2 queries ─────────────
    // Avoids N+1 (previously 2 individual queries per diff × up to 50 diffs).
    const allSectionIds = [
      ...new Set(
        eligibleDiffs.flatMap((d) =>
          [d.previous_section_id, d.current_section_id].filter(Boolean) as string[]
        )
      ),
    ];

    const sectionContentMap = new Map<string, PageSectionRow>();

    if (allSectionIds.length > 0) {
      const { data: sectionRows, error: sectionsError } = await supabase
        .from("page_sections")
        .select("id, section_text, section_hash")
        .in("id", allSectionIds);

      if (sectionsError) throw sectionsError;

      for (const row of (sectionRows ?? []) as PageSectionRow[]) {
        sectionContentMap.set(row.id, row);
      }
    }

    for (const diff of eligibleDiffs) {
      rowsProcessed += 1;

      try {
        const competitorId = diff.monitored_pages?.competitor_id;
        if (!competitorId) {
          throw new Error(`Diff ${diff.id} has no competitor_id via monitored_pages`);
        }

        if (!diff.previous_section_id || !diff.current_section_id) {
          throw new Error(`Diff ${diff.id} missing section references`);
        }

        const previous = sectionContentMap.get(diff.previous_section_id) ?? null;
        const current  = sectionContentMap.get(diff.current_section_id) ?? null;

        if (!previous || !current) {
          throw new Error(`Diff ${diff.id} missing section rows`);
        }

        // Whitespace-only change: no semantic content moved — mark as noise, skip signal.
        // This catches formatting-only deploys (indentation, line breaks) that survive
        // the hash check but carry zero competitive intelligence.
        if (previous.section_text.replace(/\s+/g, "") === current.section_text.replace(/\s+/g, "")) {
          await supabase
            .from("section_diffs")
            .update({ signal_detected: true, is_noise: true, noise_reason: "whitespace_only" })
            .eq("id", diff.id);
          signalsSuppressed += 1;
          rowsSucceeded += 1;
          continue;
        }

        // Dynamic-content-only change: timestamps and tracking params rotated but
        // no editorial content changed — zero competitive intelligence.
        const prevNorm = normalizeForComparison(previous.section_text);
        const currNorm = normalizeForComparison(current.section_text);
        if (prevNorm === currNorm) {
          await supabase
            .from("section_diffs")
            .update({ signal_detected: true, is_noise: true, noise_reason: "dynamic_content_only" })
            .eq("id", diff.id);
          signalsSuppressed += 1;
          rowsSucceeded += 1;
          continue;
        }

        const signal = classifySignal(
          diff.section_type,
          previous.section_text,
          current.section_text
        );

        // ── Confidence gate ───────────────────────────────────────────────────
        const confidenceScore = computeConfidence(
          diff.section_type,
          diff.observation_count ?? 1,
          diff.last_seen_at,
          diff.monitored_pages?.page_class ?? "standard"
        );

        if (confidenceScore < CONFIDENCE_SUPPRESS) {
          // Below suppression floor — mark diff processed, create no signal.
          await supabase
            .from("section_diffs")
            .update({ signal_detected: true })
            .eq("id", diff.id);
          signalsSuppressed += 1;
          rowsSucceeded += 1;
          continue;
        }

        // ── Signal-hash deduplication ─────────────────────────────────────────
        // One signal per (competitor, section_type, signal_type) per calendar day.
        const signalHash = computeSignalHash(
          competitorId,
          signal.signal_type,
          diff.section_type,
          diff.last_seen_at
        );

        const { data: hashCheck } = await supabase
          .from("signals")
          .select("id")
          .eq("signal_hash", signalHash)
          .maybeSingle();

        if (hashCheck) {
          // Already have this signal for today — mark diff processed and skip.
          await supabase
            .from("section_diffs")
            .update({ signal_detected: true })
            .eq("id", diff.id);
          signalsDeduplicated += 1;
          rowsSucceeded += 1;
          continue;
        }

        // ── Signal status based on confidence ─────────────────────────────────
        // pending        → confidence >= CONFIDENCE_INTERPRET
        //                → claim_pending_signals RPC picks this up → interpreted by OpenAI
        // pending_review → CONFIDENCE_SUPPRESS ≤ confidence < CONFIDENCE_INTERPRET
        //                → skipped by AI; update-pressure-index may promote to 'pending'
        //                  if the competitor's pressure_index spikes
        const signalStatus: string = confidenceScore >= CONFIDENCE_INTERPRET
          ? "pending"
          : "pending_review";

        // ── Upsert signal ─────────────────────────────────────────────────────
        const { error: upsertError } = await supabase
          .from("signals")
          .upsert(
            {
              section_diff_id:   diff.id,
              monitored_page_id: diff.monitored_page_id,
              signal_type:       signal.signal_type,
              signal_data:       signal.signal_data,
              severity:          signal.severity,
              detected_at:       diff.last_seen_at ?? undefined,
              interpreted:       false,
              status:            signalStatus,
              retry_count:       0,
              is_duplicate:      false,
              confidence_score:  confidenceScore,
              signal_hash:       signalHash,
            },
            {
              onConflict: "section_diff_id,signal_type",
            }
          );

        if (upsertError) throw upsertError;

        const { error: updateDiffError } = await supabase
          .from("section_diffs")
          .update({ signal_detected: true, last_error: null })
          .eq("id", diff.id);

        if (updateDiffError) throw updateDiffError;

        signalsCreated += 1;
        if (signalStatus === "pending_review") signalsPendingReview += 1;
        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      signalsCreated,
      signalsSuppressed,
      signalsDeduplicated,
      signalsPendingReview,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "detect-signals",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-signals",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      signalsCreated,
      signalsSuppressed,
      signalsDeduplicated,
      signalsPendingReview,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "detect-signals",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-signals", handler);
