// Signal velocity anomaly dampening.
//
// When a competitor suddenly produces far more signals than their historical
// average (e.g., website redesign → every section changes), the excess signals
// are noise. This module detects velocity anomalies and tells detect-signals
// to suppress signals beyond the dampening cap.
//
// Logic:
//   1. Load competitor's signal count in the last 14 days
//   2. Compute average daily signal rate
//   3. If signals-in-this-run exceed ANOMALY_MULTIPLIER × daily average → dampen
//   4. Only the first MAX_SIGNALS_PER_RUN signals per competitor are created
//
// The dampener resets naturally — each run is independent.

import { supabase } from "./supabase";

// A competitor producing >5x their daily average in a single run is anomalous.
const ANOMALY_MULTIPLIER = 5;

// Absolute cap: never create more than this many signals per competitor per run,
// regardless of historical average. Prevents new competitors (avg=0) from flooding.
const ABSOLUTE_CAP = 15;

// Minimum daily average to use. Prevents division by zero and ensures
// new competitors get a reasonable baseline.
const MIN_DAILY_AVERAGE = 0.5;

const WINDOW_DAYS = 14;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DampeningState {
  competitorId: string;
  dailyAverage: number;
  capForRun: number;
  signalsCreatedThisRun: number;
}

// ── Pre-load historical rates ─────────────────────────────────────────────────

/**
 * Load historical signal rates for a batch of competitors.
 * Returns a map of competitor_id → DampeningState.
 */
export async function loadDampeningStates(
  competitorIds: string[]
): Promise<Map<string, DampeningState>> {
  if (competitorIds.length === 0) return new Map();

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sigRows } = await supabase
    .from("signals")
    .select("competitor_id")
    .gte("detected_at", cutoff)
    .in("competitor_id", competitorIds);

  // Count signals per competitor
  const counts = new Map<string, number>();
  for (const s of (sigRows ?? []) as { competitor_id: string }[]) {
    counts.set(s.competitor_id, (counts.get(s.competitor_id) ?? 0) + 1);
  }

  const states = new Map<string, DampeningState>();
  for (const cid of competitorIds) {
    const totalSignals = counts.get(cid) ?? 0;
    const dailyAverage = Math.max(MIN_DAILY_AVERAGE, totalSignals / WINDOW_DAYS);
    const capForRun = Math.min(ABSOLUTE_CAP, Math.ceil(dailyAverage * ANOMALY_MULTIPLIER));

    states.set(cid, {
      competitorId: cid,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      capForRun,
      signalsCreatedThisRun: 0,
    });
  }

  return states;
}

/**
 * Check if a signal should be dampened for this competitor.
 * Call before creating each signal. Returns true if signal should be suppressed.
 * Increments the counter if not dampened.
 */
export function shouldDampen(state: DampeningState): boolean {
  if (state.signalsCreatedThisRun >= state.capForRun) {
    return true; // Over cap → dampen
  }
  state.signalsCreatedThisRun++;
  return false;
}
