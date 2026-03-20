// Feedback-driven weight calibration — weekly Sunday 03:30 UTC.
//
// Reads operator-labeled signal_feedback to compute per-section-type precision.
// Stores a calibration snapshot in calibration_reports.
// detect-signals loads the latest snapshot at handler start to adjust SECTION_WEIGHTS.
//
// Precision  = true_positive / (true_positive + false_positive)
// Adj weight = lerp(base_weight, DEFAULT_WEIGHT, 1 - precision)
//            = clamp at DEFAULT_WEIGHT floor — weight never falls below 0.25.
//
// Minimum sample threshold: MIN_BUCKET_SAMPLES = 10
// Below this, the bucket is recorded but adjusted_weight == base_weight (no calibration).
//
// Verdicts: "valid" (true positive) | "noise" (false positive) | "uncertain" (excluded from precision)
//
// This handler has no OpenAI calls — DB-only, maxDuration: 30s.

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

const MIN_BUCKET_SAMPLES = 10;
const DEFAULT_WEIGHT     = 0.25;

// Mirror of SECTION_WEIGHTS from detect-signals — used as anchor for calibration.
// Keep in sync when detect-signals SECTION_WEIGHTS changes.
const BASE_SECTION_WEIGHTS: Record<string, number> = {
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
};

interface SectionStat {
  section_type:    string;
  true_positive:   number;
  false_positive:  number;
  uncertain:       number;
  total:           number;
  precision:       number; // -1 if insufficient data
  base_weight:     number;
  adjusted_weight: number;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "calibrate-weights", status: "in_progress" });

  try {
    // ── Step 1: load all signal_feedback ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedbackRows, error: feedbackError } = await (supabase as any)
      .from("signal_feedback")
      .select("verdict, signal_id");

    if (feedbackError) throw feedbackError;

    if (!feedbackRows || feedbackRows.length === 0) {
      Sentry.captureCheckIn({ checkInId, monitorSlug: "calibrate-weights", status: "ok" });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "calibrate-weights",
        signalCount: 0,
        bucketsAnalyzed: 0,
        appliedCount: 0,
        runtimeDurationMs: Date.now() - startedAt,
      });
    }

    const signalIds = (feedbackRows as Array<{ signal_id: string; verdict: string }>)
      .map((r: { signal_id: string; verdict: string }) => r.signal_id);

    // ── Step 2: resolve section_diff_id for each signal ───────────────────────
    const { data: signalRows, error: signalError } = await supabase
      .from("signals")
      .select("id, section_diff_id")
      .in("id", signalIds);

    if (signalError) throw signalError;

    const signalDiffMap = new Map<string, string>(); // signal_id → section_diff_id
    for (const row of (signalRows ?? []) as Array<{ id: string; section_diff_id: string | null }>) {
      if (row.section_diff_id) signalDiffMap.set(row.id, row.section_diff_id);
    }

    const diffIds = [...new Set(signalDiffMap.values())];

    // ── Step 3: resolve section_type for each diff ────────────────────────────
    const diffSectionMap = new Map<string, string>(); // diff_id → section_type

    if (diffIds.length > 0) {
      const { data: diffRows, error: diffError } = await supabase
        .from("section_diffs")
        .select("id, section_type")
        .in("id", diffIds);

      if (diffError) throw diffError;

      for (const row of (diffRows ?? []) as Array<{ id: string; section_type: string }>) {
        diffSectionMap.set(row.id, row.section_type);
      }
    }

    // ── Step 4: aggregate verdict counts per section_type ─────────────────────
    const buckets = new Map<string, { tp: number; fp: number; uncertain: number }>();

    for (const fb of feedbackRows as Array<{ verdict: string; signal_id: string }>) {
      const diffId      = signalDiffMap.get(fb.signal_id);
      if (!diffId) continue;
      const sectionType = diffSectionMap.get(diffId);
      if (!sectionType) continue;

      if (!buckets.has(sectionType)) {
        buckets.set(sectionType, { tp: 0, fp: 0, uncertain: 0 });
      }
      const b = buckets.get(sectionType)!;
      if      (fb.verdict === "valid") b.tp        += 1;
      else if (fb.verdict === "noise") b.fp        += 1;
      else                             b.uncertain += 1;
    }

    // ── Step 5: compute adjusted weights ─────────────────────────────────────
    const sectionStats: SectionStat[] = [];
    let appliedCount = 0;

    for (const [sectionType, counts] of buckets) {
      const total   = counts.tp + counts.fp + counts.uncertain;
      const labeled = counts.tp + counts.fp; // uncertain excluded from precision

      // Only apply calibration when there are enough labeled samples.
      const precision = labeled >= MIN_BUCKET_SAMPLES
        ? counts.tp / labeled
        : -1;

      const baseWeight = BASE_SECTION_WEIGHTS[sectionType] ?? DEFAULT_WEIGHT;

      let adjustedWeight = baseWeight;
      if (precision >= 0) {
        // Linear interpolation toward DEFAULT_WEIGHT proportional to noise rate.
        // precision=1.0 → no adjustment (full base weight kept)
        // precision=0.5 → halfway between base and DEFAULT_WEIGHT
        // precision=0.0 → adjusted to DEFAULT_WEIGHT (floor)
        adjustedWeight = Math.max(
          DEFAULT_WEIGHT,
          DEFAULT_WEIGHT + (baseWeight - DEFAULT_WEIGHT) * precision,
        );
        appliedCount += 1;
      }

      sectionStats.push({
        section_type:    sectionType,
        true_positive:   counts.tp,
        false_positive:  counts.fp,
        uncertain:       counts.uncertain,
        total,
        precision:       precision >= 0 ? parseFloat(precision.toFixed(3)) : -1,
        base_weight:     baseWeight,
        adjusted_weight: parseFloat(adjustedWeight.toFixed(4)),
      });
    }

    // ── Step 6: store calibration report ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("calibration_reports")
      .insert({
        signal_count:  feedbackRows.length,
        applied_count: appliedCount,
        section_stats: sectionStats,
      });

    if (insertError) throw insertError;

    const runtimeDurationMs = Date.now() - startedAt;

    // Warn on high-noise buckets (precision < 0.60 with sufficient data).
    const highNoiseBuckets = sectionStats.filter(s => s.precision >= 0 && s.precision < 0.60);
    if (highNoiseBuckets.length > 0) {
      Sentry.captureMessage("calibration_high_noise_buckets", {
        level: "warning",
        extra: {
          buckets: highNoiseBuckets.map(s => ({
            section_type:   s.section_type,
            precision:      s.precision,
            false_positive: s.false_positive,
            true_positive:  s.true_positive,
          })),
        },
      });
    }

    Sentry.setContext("calibration_result", {
      signalCount:     feedbackRows.length,
      bucketsAnalyzed: buckets.size,
      appliedCount,
    });

    Sentry.captureCheckIn({ checkInId, monitorSlug: "calibrate-weights", status: "ok" });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok: true,
      job: "calibrate-weights",
      signalCount:     feedbackRows.length,
      bucketsAnalyzed: buckets.size,
      appliedCount,
      sectionStats,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ checkInId, monitorSlug: "calibrate-weights", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("calibrate-weights", handler);
