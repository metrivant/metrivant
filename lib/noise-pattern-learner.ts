// Noise pattern learning from signal_feedback verdicts.
//
// Analyzes the signal_feedback table to find (section_type, competitor_id, signal_type)
// triples where the noise rate exceeds the threshold. These patterns are written to
// noise_suppression_rules, which detect-signals checks before creating new signals.
//
// The learning loop:
//   1. signal_feedback verdicts accumulate (operator labels signals as valid/noise/uncertain)
//   2. learn-noise-patterns cron runs weekly
//   3. Patterns with noise_rate >= NOISE_THRESHOLD over ≥ MIN_SAMPLES become active rules
//   4. detect-signals checks rules before creating signals → known-noisy patterns suppressed
//   5. Rules auto-deactivate if noise_rate drops below threshold on next learning run
//
// This creates a self-improving pipeline: each operator verdict compounds permanently.

import { supabase } from "./supabase";

// ── Config ────────────────────────────────────────────────────────────────────

// Minimum noise rate to create a suppression rule.
// 80% = 4 out of 5 verdicts must be "noise" to suppress.
const NOISE_THRESHOLD = 0.80;

// Minimum sample count before a pattern can become a rule.
// Prevents over-fitting on small samples.
const MIN_SAMPLES = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackRow {
  signal_id:      string;
  verdict:        string;
  noise_category: string | null;
}

interface SignalRow {
  id:            string;
  competitor_id: string;
  signal_type:   string;
  section_type:  string | null;
}

export interface NoisePattern {
  section_type:           string;
  competitor_id:          string;
  signal_type:            string;
  noise_rate:             number;
  sample_count:           number;
  noise_count:            number;
  primary_noise_category: string | null;
}

export interface LearnResult {
  patternsAnalyzed: number;
  rulesCreated:     number;
  rulesUpdated:     number;
  rulesDeactivated: number;
}

// ── Learner ───────────────────────────────────────────────────────────────────

/**
 * Analyze signal_feedback and produce/update noise_suppression_rules.
 */
export async function learnNoisePatterns(): Promise<LearnResult> {
  // ── Load all feedback with their signal metadata ────────────────────────
  const { data: feedbackRows, error: fbErr } = await supabase
    .from("signal_feedback")
    .select("signal_id, verdict, noise_category");

  if (fbErr) throw fbErr;

  const feedback = (feedbackRows ?? []) as FeedbackRow[];
  if (feedback.length === 0) {
    return { patternsAnalyzed: 0, rulesCreated: 0, rulesUpdated: 0, rulesDeactivated: 0 };
  }

  // ── Load signal metadata for all feedback signal_ids ────────────────────
  const signalIds = feedback.map((f) => f.signal_id);

  // Batch in chunks of 100 to avoid URL length limits
  const allSignals: SignalRow[] = [];
  for (let i = 0; i < signalIds.length; i += 100) {
    const chunk = signalIds.slice(i, i + 100);
    const { data: sigRows } = await supabase
      .from("signals")
      .select("id, competitor_id, signal_type")
      .in("id", chunk);

    // We need section_type but it's on section_diffs, not signals directly.
    // Use signal_data or section_diff_id to get it. For simplicity, derive from signal_type.
    for (const s of (sigRows ?? []) as { id: string; competitor_id: string; signal_type: string }[]) {
      allSignals.push({ ...s, section_type: derivesSectionType(s.signal_type) });
    }
  }

  const signalMap = new Map(allSignals.map((s) => [s.id, s]));

  // ── Aggregate by (section_type, competitor_id, signal_type) ─────────────
  const patternKey = (st: string, cid: string, sigType: string) => `${st}::${cid}::${sigType}`;

  const patterns = new Map<string, {
    section_type: string;
    competitor_id: string;
    signal_type: string;
    total: number;
    noise: number;
    noiseCategories: Map<string, number>;
  }>();

  for (const fb of feedback) {
    const sig = signalMap.get(fb.signal_id);
    if (!sig || !sig.section_type) continue;

    const key = patternKey(sig.section_type, sig.competitor_id, sig.signal_type);
    const existing = patterns.get(key) ?? {
      section_type: sig.section_type,
      competitor_id: sig.competitor_id,
      signal_type: sig.signal_type,
      total: 0,
      noise: 0,
      noiseCategories: new Map(),
    };

    existing.total++;
    if (fb.verdict === "noise") {
      existing.noise++;
      if (fb.noise_category) {
        existing.noiseCategories.set(
          fb.noise_category,
          (existing.noiseCategories.get(fb.noise_category) ?? 0) + 1,
        );
      }
    }

    patterns.set(key, existing);
  }

  // ── Identify patterns that meet the noise threshold ─────────────────────
  const noisyPatterns: NoisePattern[] = [];

  for (const p of patterns.values()) {
    if (p.total < MIN_SAMPLES) continue;
    const noiseRate = p.noise / p.total;

    // Find primary noise category
    let primaryCategory: string | null = null;
    let maxCategoryCount = 0;
    for (const [cat, count] of p.noiseCategories) {
      if (count > maxCategoryCount) {
        maxCategoryCount = count;
        primaryCategory = cat;
      }
    }

    if (noiseRate >= NOISE_THRESHOLD) {
      noisyPatterns.push({
        section_type: p.section_type,
        competitor_id: p.competitor_id,
        signal_type: p.signal_type,
        noise_rate: Math.round(noiseRate * 1000) / 1000,
        sample_count: p.total,
        noise_count: p.noise,
        primary_noise_category: primaryCategory,
      });
    }
  }

  // ── Upsert rules ────────────────────────────────────────────────────────
  let rulesCreated = 0;
  let rulesUpdated = 0;

  for (const pattern of noisyPatterns) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("noise_suppression_rules")
      .select("id, active")
      .eq("section_type", pattern.section_type)
      .eq("competitor_id", pattern.competitor_id)
      .eq("signal_type", pattern.signal_type)
      .limit(1);

    const row = ((existing ?? []) as { id: string; active: boolean }[])[0];

    if (row) {
      // Update existing rule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("noise_suppression_rules")
        .update({
          noise_rate: pattern.noise_rate,
          sample_count: pattern.sample_count,
          noise_count: pattern.noise_count,
          primary_noise_category: pattern.primary_noise_category,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      rulesUpdated++;
    } else {
      // Create new rule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("noise_suppression_rules")
        .insert({
          section_type: pattern.section_type,
          competitor_id: pattern.competitor_id,
          signal_type: pattern.signal_type,
          noise_rate: pattern.noise_rate,
          sample_count: pattern.sample_count,
          noise_count: pattern.noise_count,
          primary_noise_category: pattern.primary_noise_category,
          active: true,
        });
      rulesCreated++;
    }
  }

  // ── Deactivate rules whose patterns no longer meet threshold ────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeRules } = await (supabase as any)
    .from("noise_suppression_rules")
    .select("id, section_type, competitor_id, signal_type")
    .eq("active", true);

  let rulesDeactivated = 0;
  const noisyKeys = new Set(
    noisyPatterns.map((p) => patternKey(p.section_type, p.competitor_id, p.signal_type))
  );

  for (const rule of (activeRules ?? []) as { id: string; section_type: string; competitor_id: string; signal_type: string }[]) {
    const key = patternKey(rule.section_type, rule.competitor_id, rule.signal_type);
    if (!noisyKeys.has(key)) {
      // Pattern no longer meets threshold — deactivate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("noise_suppression_rules")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", rule.id);
      rulesDeactivated++;
    }
  }

  return {
    patternsAnalyzed: patterns.size,
    rulesCreated,
    rulesUpdated,
    rulesDeactivated,
  };
}

// ── Suppression check (called by detect-signals) ──────────────────────────────

/**
 * Check if a noise suppression rule exists for this signal pattern.
 * Returns the rule ID if suppressed, null otherwise.
 *
 * Pre-loads all active rules for a batch of competitor_ids in one query
 * to avoid N+1 queries in the detect-signals loop.
 */
export async function loadActiveNoiseRules(
  orgId: string,
  competitorIds: string[]
): Promise<Map<string, string>> {
  if (!orgId) return new Map();

  // Load semantic noise rules for this org (layered on top of autonomous detection)
  // Supports three pattern granularities:
  // 1. org + section + signal + competitor (most specific)
  // 2. org + section + signal (competitor-agnostic)
  // 3. org + signal (section-agnostic)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules } = await (supabase as any)
    .from("noise_suppression_rules")
    .select("id, section_type, competitor_id, signal_type, rule_type")
    .eq("org_id", orgId)
    .eq("is_active", true); // Changed from "active" to "is_active"

  // Build lookup map supporting wildcard patterns
  const ruleMap = new Map<string, string>();
  for (const r of (rules ?? []) as { id: string; section_type: string | null; competitor_id: string | null; signal_type: string; rule_type: string | null }[]) {
    const section = r.section_type || "*";
    const competitor = r.competitor_id || "*";
    const key = `${section}::${competitor}::${r.signal_type}`;
    ruleMap.set(key, r.id);
  }
  return ruleMap;
}

/**
 * Check if a specific signal pattern is suppressed (semantic noise rules).
 * Checks three pattern levels (most specific to least specific):
 * 1. section + competitor + signal
 * 2. section + signal (any competitor)
 * 3. signal only (any section, any competitor)
 */
export function isNoiseSuppressed(
  ruleMap: Map<string, string>,
  sectionType: string,
  competitorId: string,
  signalType: string,
): string | null {
  // Check most specific first
  const specificKey = `${sectionType}::${competitorId}::${signalType}`;
  if (ruleMap.has(specificKey)) return ruleMap.get(specificKey)!;

  // Check section + signal (competitor-agnostic)
  const sectionKey = `${sectionType}::*::${signalType}`;
  if (ruleMap.has(sectionKey)) return ruleMap.get(sectionKey)!;

  // Check signal only (section-agnostic, competitor-agnostic)
  const signalKey = `*::*::${signalType}`;
  if (ruleMap.has(signalKey)) return ruleMap.get(signalKey)!;

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Map signal_type back to a section_type for pattern grouping.
// This is a reverse of classifySignal — not perfect, but sufficient for pattern detection.
function derivesSectionType(signalType: string): string {
  if (signalType.includes("pricing"))    return "pricing_plans";
  if (signalType.includes("feature"))    return "feature_list";
  if (signalType.includes("product"))    return "product_description";
  if (signalType.includes("hiring"))     return "careers";
  if (signalType.includes("career"))     return "careers";
  if (signalType.includes("position"))   return "positioning";
  if (signalType.includes("messaging"))  return "messaging_copy";
  if (signalType.includes("enterprise")) return "enterprise_push";
  if (signalType.includes("ecosystem"))  return "integrations";
  if (signalType.includes("content"))    return "content_change";
  return signalType; // fallback: use the signal_type itself
}
