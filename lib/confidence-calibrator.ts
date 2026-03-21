// Self-calibrating confidence weights from signal_feedback.
//
// Analyzes signal_feedback verdicts grouped by section_type to compute
// per-section accuracy rates. Sections with high noise rates get their
// weight multiplier reduced; sections with high valid rates keep 1.0.
//
// The multiplier is applied in detect-signals on top of base SECTION_WEIGHTS:
//   effective_weight = base_weight × calibration_multiplier
//
// This creates a self-improving confidence model: operators label signals,
// the system adjusts how much it trusts each section type.

import { supabase } from "./supabase";

// Weight multiplier bounds — never reduce more than 40% or boost more than 15%
const MIN_MULTIPLIER = 0.60;
const MAX_MULTIPLIER = 1.15;

// Minimum samples before calibration kicks in
const MIN_SAMPLES = 10;

export interface CalibrationResult {
  sectionsAnalyzed: number;
  sectionsCalibrated: number;
}

/**
 * Run calibration: analyze signal_feedback, compute accuracy per section_type,
 * write weight multipliers to confidence_calibration table.
 */
export async function calibrateConfidence(): Promise<CalibrationResult> {
  // Load all feedback with signal metadata
  const { data: feedbackRows, error: fbErr } = await supabase
    .from("signal_feedback")
    .select("signal_id, verdict");

  if (fbErr) throw fbErr;

  const feedback = (feedbackRows ?? []) as { signal_id: string; verdict: string }[];
  if (feedback.length === 0) return { sectionsAnalyzed: 0, sectionsCalibrated: 0 };

  // Load signal section types (via section_diffs)
  const signalIds = feedback.map((f) => f.signal_id);

  // Get signal → section_diff → section_type mapping
  const signalSectionTypes = new Map<string, string>();

  for (let i = 0; i < signalIds.length; i += 100) {
    const chunk = signalIds.slice(i, i + 100);
    const { data: sigRows } = await supabase
      .from("signals")
      .select("id, signal_type")
      .in("id", chunk);

    for (const s of (sigRows ?? []) as { id: string; signal_type: string }[]) {
      // Derive section_type from signal_type (same mapping as noise-pattern-learner)
      signalSectionTypes.set(s.id, deriveSectionType(s.signal_type));
    }
  }

  // Aggregate by section_type
  const sectionStats = new Map<string, { valid: number; noise: number; total: number }>();

  for (const fb of feedback) {
    const sectionType = signalSectionTypes.get(fb.signal_id);
    if (!sectionType) continue;
    if (fb.verdict !== "valid" && fb.verdict !== "noise") continue; // skip uncertain

    const stats = sectionStats.get(sectionType) ?? { valid: 0, noise: 0, total: 0 };
    stats.total++;
    if (fb.verdict === "valid") stats.valid++;
    if (fb.verdict === "noise") stats.noise++;
    sectionStats.set(sectionType, stats);
  }

  // Compute and write calibrations
  let sectionsCalibrated = 0;

  for (const [sectionType, stats] of sectionStats) {
    if (stats.total < MIN_SAMPLES) continue;

    const accuracyRate = stats.valid / stats.total;

    // Multiplier: linearly scale from MIN_MULTIPLIER (at 0% accuracy) to MAX_MULTIPLIER (at 100%)
    // At 50% accuracy (coin flip) → multiplier ~0.875
    const multiplier = Math.round(
      Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER,
        MIN_MULTIPLIER + (MAX_MULTIPLIER - MIN_MULTIPLIER) * accuracyRate
      )) * 1000
    ) / 1000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("confidence_calibration")
      .upsert({
        section_type: sectionType,
        sample_count: stats.total,
        valid_count: stats.valid,
        noise_count: stats.noise,
        accuracy_rate: Math.round(accuracyRate * 1000) / 1000,
        weight_multiplier: multiplier,
        updated_at: new Date().toISOString(),
      }, { onConflict: "section_type" });

    sectionsCalibrated++;
  }

  return { sectionsAnalyzed: sectionStats.size, sectionsCalibrated };
}

/**
 * Load calibration multipliers for use in detect-signals.
 * Returns a map of section_type → weight_multiplier.
 */
export async function loadCalibrationWeights(): Promise<Map<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("confidence_calibration")
    .select("section_type, weight_multiplier");

  const weights = new Map<string, number>();
  for (const r of (rows ?? []) as { section_type: string; weight_multiplier: number }[]) {
    weights.set(r.section_type, r.weight_multiplier);
  }
  return weights;
}

function deriveSectionType(signalType: string): string {
  if (signalType.includes("pricing"))    return "pricing_plans";
  if (signalType.includes("feature"))    return "feature_list";
  if (signalType.includes("product"))    return "product_description";
  if (signalType.includes("hiring"))     return "careers";
  if (signalType.includes("position"))   return "positioning";
  if (signalType.includes("messaging"))  return "messaging_copy";
  if (signalType.includes("enterprise")) return "enterprise_push";
  if (signalType.includes("ecosystem"))  return "integrations";
  if (signalType.includes("content"))    return "content_change";
  return signalType;
}
