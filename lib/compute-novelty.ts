/**
 * Novelty Scoring System
 *
 * Computes novelty scores for signals to distinguish first-time strategic moves
 * (high novelty, high value) from repeated operational patterns (low novelty, noise).
 *
 * Core insight: First-time behaviors predict strategic pivots. Repeated behaviors
 * are operational noise.
 *
 * Scoring model:
 * - First occurrence: 1.0 (maximum novelty)
 * - Second occurrence (90d): 0.6
 * - Third+ occurrence: 0.3 × (1 / log2(count))
 * - Cross-signal boost: +0.15 if multiple novel signals detected in same 24h window
 *
 * Integration points:
 * - detect-signals: compute score at signal creation
 * - update-pressure-index: weight pressure contribution by novelty (novel signals = 2x weight)
 * - briefs: prioritize novel movements
 * - UI: display novelty badges in Activity Stream and intelligence drawer
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type NoveltyContext = {
  competitorId: string;
  signalType: string;
  detectedAt: string;
};

export type NoveltyResult = {
  noveltyScore: number;
  firstSeenAt: string | null;
  recurrenceCount: number;
};

/**
 * Compute novelty score for a new signal.
 *
 * Queries historical signals to determine:
 * 1. Is this the first time we've seen this signal_type for this competitor?
 * 2. How many times has it occurred in the last 90 days?
 * 3. Are there other novel signals detected in the same 24h window? (cross-signal boost)
 *
 * @param supabase - Supabase client (service role for cross-table queries)
 * @param context - Signal context (competitor, type, timestamp)
 * @returns NoveltyResult with score (0.0-1.0), first occurrence timestamp, and recurrence count
 */
export async function computeNovelty(
  supabase: SupabaseClient,
  context: NoveltyContext
): Promise<NoveltyResult> {
  const { competitorId, signalType, detectedAt } = context;

  // Query: Find all prior occurrences of this signal_type for this competitor in last 90d
  const ninetyDaysAgo = new Date(new Date(detectedAt).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: priorSignals, error } = await (supabase as any)
    .from("signals")
    .select("detected_at, novelty_score")
    .eq("competitor_id", competitorId)
    .eq("signal_type", signalType)
    .gte("detected_at", ninetyDaysAgo)
    .lt("detected_at", detectedAt) // Only count signals BEFORE this one
    .in("status", ["pending", "interpreted"])
    .order("detected_at", { ascending: true });

  if (error) {
    console.error("[compute-novelty] Query failed:", error);
    // Fallback: assume first occurrence
    return {
      noveltyScore: 1.0,
      firstSeenAt: null,
      recurrenceCount: 1,
    };
  }

  const priorCount = (priorSignals ?? []).length;

  // Base novelty score computation
  let baseScore: number;
  let firstSeenAt: string | null = null;
  let recurrenceCount: number;

  if (priorCount === 0) {
    // First occurrence
    baseScore = 1.0;
    firstSeenAt = null;
    recurrenceCount = 1;
  } else if (priorCount === 1) {
    // Second occurrence
    baseScore = 0.6;
    firstSeenAt = priorSignals[0].detected_at;
    recurrenceCount = 2;
  } else {
    // Third+ occurrence
    // Score decays logarithmically: 0.3 × (1 / log2(count))
    recurrenceCount = priorCount + 1;
    const decayFactor = 1 / Math.log2(recurrenceCount);
    baseScore = Math.max(0.0, 0.3 * decayFactor);
    firstSeenAt = priorSignals[0].detected_at;
  }

  // Cross-signal novelty boost
  // If other novel signals (score >= 0.8) detected in same 24h window → +0.15 boost
  const twentyFourHoursAgo = new Date(new Date(detectedAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAhead = new Date(new Date(detectedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentNovelSignals, error: crossError } = await (supabase as any)
    .from("signals")
    .select("id")
    .eq("competitor_id", competitorId)
    .gte("detected_at", twentyFourHoursAgo)
    .lte("detected_at", twentyFourHoursAhead)
    .gte("novelty_score", 0.8)
    .in("status", ["pending", "interpreted"])
    .limit(5); // Cap query

  if (!crossError && (recentNovelSignals ?? []).length > 0) {
    // Apply cross-signal boost
    baseScore = Math.min(1.0, baseScore + 0.15);
  }

  return {
    noveltyScore: Math.round(baseScore * 100) / 100, // Round to 2 decimals
    firstSeenAt,
    recurrenceCount,
  };
}

/**
 * Compute novelty weight multiplier for pressure index calculation.
 *
 * Novel signals (score >= 0.8) contribute 2x to pressure.
 * Medium novelty (0.5-0.79) contributes 1.5x.
 * Low novelty (<0.5) contributes 1.0x (baseline).
 *
 * @param noveltyScore - Signal novelty score (0.0-1.0)
 * @returns Pressure weight multiplier (1.0-2.0)
 */
export function getNoveltyPressureWeight(noveltyScore: number | null): number {
  if (noveltyScore === null) return 1.0; // No novelty data = baseline weight

  if (noveltyScore >= 0.8) return 2.0; // High novelty = 2x pressure
  if (noveltyScore >= 0.5) return 1.5; // Medium novelty = 1.5x pressure
  return 1.0; // Low novelty = baseline pressure
}

/**
 * Get novelty display label and color for UI.
 *
 * @param noveltyScore - Signal novelty score (0.0-1.0)
 * @returns Display label, color, and symbol for UI rendering
 */
export function getNoveltyDisplay(noveltyScore: number | null): {
  label: string;
  color: string;
  symbol: string;
  shouldDisplay: boolean; // Only display badge if high/medium novelty
} {
  if (noveltyScore === null || noveltyScore < 0.5) {
    return {
      label: "Operational",
      color: "#475569", // slate-600
      symbol: "·",
      shouldDisplay: false,
    };
  }

  if (noveltyScore >= 0.8) {
    return {
      label: "First-time",
      color: "#2EE6A6", // green - high value signal
      symbol: "✦",
      shouldDisplay: true,
    };
  }

  return {
    label: "Recurring",
    color: "#f59e0b", // amber - medium novelty
    symbol: "↻",
    shouldDisplay: true,
  };
}
