import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";

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
  diffId: string
): string {
  // One signal per (competitor, signal_type, section_type, diff) — anchored to the
  // specific diff rather than a calendar-day bucket. This preserves deduplication
  // (the same diff can never create two signals) while allowing multiple real events
  // on the same competitor+section+type within a single day — e.g., a morning pricing
  // change and an evening rollback are both recorded as distinct intelligence signals.
  return createHash("sha256")
    .update(`${competitorId}:${signalType}:${sectionType}:${diffId}`)
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

// ── Per-competitor suppression tracking ──────────────────────────────────────

interface CompetitorRunStats {
  candidateDiffs:            number;
  suppressedByNoise:         number;
  suppressedByLowConfidence: number;
  suppressedByDuplicate:     number;
  signalsCreated:            number;
}

// Suppression ratio threshold above which a competitor triggers an anomaly alert.
// Represents 98% of candidate diffs being suppressed across a single run.
const SUPPRESSION_ANOMALY_RATIO = 0.98;
const SUPPRESSION_ANOMALY_MIN_DIFFS = 5; // ignore competitors with too few diffs

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();

  let rowsClaimed               = 0;
  let rowsProcessed             = 0;
  let rowsSucceeded             = 0;
  let rowsFailed                = 0;
  let signalsCreated            = 0;
  let signalsSuppressed         = 0; // total suppressed (noise + low confidence)
  let suppressedByNoise         = 0; // whitespace_only or dynamic_content_only
  let suppressedByLowConfidence = 0; // confidence < CONFIDENCE_SUPPRESS
  let signalsDeduplicated       = 0; // same hash already exists (reprocessed diff)
  let signalsPendingReview      = 0; // CONFIDENCE_SUPPRESS ≤ confidence < CONFIDENCE_INTERPRET

  // Per-competitor breakdown — enables suppression clustering detection.
  const perCompetitorStats = new Map<string, CompetitorRunStats>();
  const getOrInitStats = (id: string): CompetitorRunStats => {
    let s = perCompetitorStats.get(id);
    if (!s) {
      s = { candidateDiffs: 0, suppressedByNoise: 0, suppressedByLowConfidence: 0, suppressedByDuplicate: 0, signalsCreated: 0 };
      perCompetitorStats.set(id, s);
    }
    return s;
  };

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

        // Count every valid diff as a candidate — denominator for suppression ratio.
        const cStats = getOrInitStats(competitorId);
        cStats.candidateDiffs += 1;

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
          cStats.suppressedByNoise += 1;
          suppressedByNoise += 1;
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
          cStats.suppressedByNoise += 1;
          suppressedByNoise += 1;
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
          cStats.suppressedByLowConfidence += 1;
          suppressedByLowConfidence += 1;
          signalsSuppressed += 1;
          rowsSucceeded += 1;
          continue;
        }

        // ── Signal-hash deduplication ─────────────────────────────────────────
        // One signal per diff — anchored to diff.id, not a calendar day.
        const signalHash = computeSignalHash(
          competitorId,
          signal.signal_type,
          diff.section_type,
          diff.id
        );

        const { data: hashCheck } = await supabase
          .from("signals")
          .select("id")
          .eq("signal_hash", signalHash)
          .maybeSingle();

        if (hashCheck) {
          // Already have a signal for this diff — mark processed and skip.
          await supabase
            .from("section_diffs")
            .update({ signal_detected: true })
            .eq("id", diff.id);
          cStats.suppressedByDuplicate += 1;
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
              competitor_id:     competitorId,
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

        cStats.signalsCreated += 1;
        signalsCreated += 1;
        if (signalStatus === "pending_review") signalsPendingReview += 1;
        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    // ── Suppression anomaly detection ─────────────────────────────────────────
    // If a competitor has ≥5 candidate diffs and ≥98% were suppressed, emit a
    // structured warning. This surfaces extraction drift, calibration issues,
    // or overly aggressive dedupe before they cause a "silent desert."
    const suppressionBreakdown: Array<CompetitorRunStats & { competitor_id: string; suppressionRatio: number }> = [];
    for (const [cid, s] of perCompetitorStats) {
      const totalSuppressed = s.suppressedByNoise + s.suppressedByLowConfidence + s.suppressedByDuplicate;
      const suppressionRatio = s.candidateDiffs > 0 ? totalSuppressed / s.candidateDiffs : 0;
      suppressionBreakdown.push({ competitor_id: cid, ...s, suppressionRatio });

      if (s.candidateDiffs >= SUPPRESSION_ANOMALY_MIN_DIFFS && suppressionRatio >= SUPPRESSION_ANOMALY_RATIO) {
        Sentry.captureMessage("suppression_anomaly", {
          level: "warning",
          extra: {
            competitor_id: cid,
            candidate_diffs: s.candidateDiffs,
            suppressed_by_noise: s.suppressedByNoise,
            suppressed_by_low_confidence: s.suppressedByLowConfidence,
            suppressed_by_duplicate: s.suppressedByDuplicate,
            signals_created: s.signalsCreated,
            suppression_ratio: parseFloat(suppressionRatio.toFixed(3)),
          },
        });
      }
    }

    Sentry.setContext("run_metrics", {
      stage_name: "detect-signals",
      batch_size: rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      signalsCreated,
      signalsSuppressed,
      suppressedByNoise,
      suppressedByLowConfidence,
      signalsDeduplicated,
      signalsPendingReview,
      runtimeDurationMs,
    });

    // Emit suppression breakdown context only when an anomaly exists — avoids
    // payload noise on normal runs and reduces Sentry context volume.
    const suppressionAnomalies = suppressionBreakdown.filter(
      (s) => s.candidateDiffs >= SUPPRESSION_ANOMALY_MIN_DIFFS && s.suppressionRatio >= SUPPRESSION_ANOMALY_RATIO
    );
    if (suppressionAnomalies.length > 0) {
      Sentry.setContext("suppression_breakdown", {
        byCompetitor: suppressionAnomalies,
      });
    }

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
      suppressedByNoise,
      suppressedByLowConfidence,
      signalsDeduplicated,
      signalsPendingReview,
      suppressionBreakdown,
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
