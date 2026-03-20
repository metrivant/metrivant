// Cross-pool signal deduplication.
//
// Before any promote handler inserts a new signal, call `findCrossPoolDuplicate()`
// to check if a semantically similar signal already exists for the same competitor
// within a recent time window.
//
// Match criteria (any ONE sufficient):
//   1. Title/summary Jaccard word similarity >= 0.55 AND within 48h
//   2. Same signal_type AND within 6h
//
// If a match is found:
//   - Returns the existing signal ID (caller should skip insert)
//   - Optionally boosts the existing signal's confidence by CORROBORATION_BOOST
//
// This prevents the same competitive event from creating 2-3 signals through
// different detection paths (page-diff, newsroom feed, careers feed, etc.).

import { supabase } from "./supabase";

// ── Config ────────────────────────────────────────────────────────────────────

const JACCARD_THRESHOLD = 0.55;
const WIDE_WINDOW_HOURS = 48;
const NARROW_WINDOW_HOURS = 6;
const CORROBORATION_BOOST = 0.05;
const MAX_CONFIDENCE = 1.0;

// Maximum recent signals to load for comparison (limits DB + CPU cost).
const MAX_RECENT_SIGNALS = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentSignal {
  id: string;
  signal_type: string;
  detected_at: string;
  confidence_score: number;
  summary: string | null;
  signal_data: { current_excerpt?: string; previous_excerpt?: string | null } | null;
}

export interface DedupResult {
  isDuplicate: boolean;
  matchedSignalId: string | null;
  matchReason: string | null;
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Main dedup check ──────────────────────────────────────────────────────────

/**
 * Check if a semantically similar signal already exists for this competitor.
 *
 * @param competitorId - The competitor this signal belongs to
 * @param signalType - The signal_type being created
 * @param contentText - The title/summary/excerpt of the new signal (for Jaccard)
 * @param detectedAt - When the new signal was detected (ISO string or Date)
 * @returns DedupResult indicating whether to skip insertion
 */
export async function findCrossPoolDuplicate(
  competitorId: string,
  signalType: string,
  contentText: string,
  detectedAt: string | Date,
): Promise<DedupResult> {
  const detectedMs = new Date(detectedAt).getTime();
  const wideWindowStart = new Date(detectedMs - WIDE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Load recent signals for this competitor within the wide window.
  const { data: recentRows, error } = await supabase
    .from("signals")
    .select("id, signal_type, detected_at, confidence_score, summary, signal_data")
    .eq("competitor_id", competitorId)
    .gte("detected_at", wideWindowStart)
    .eq("is_duplicate", false)
    .order("detected_at", { ascending: false })
    .limit(MAX_RECENT_SIGNALS);

  if (error || !recentRows || recentRows.length === 0) {
    return { isDuplicate: false, matchedSignalId: null, matchReason: null };
  }

  const recent = recentRows as unknown as RecentSignal[];

  for (const existing of recent) {
    const existingMs = new Date(existing.detected_at).getTime();
    const hoursDiff = Math.abs(detectedMs - existingMs) / (60 * 60 * 1000);

    // ── Check 1: Same signal_type within narrow window ──────────────────
    if (existing.signal_type === signalType && hoursDiff <= NARROW_WINDOW_HOURS) {
      await boostConfidence(existing.id, existing.confidence_score);
      return {
        isDuplicate: true,
        matchedSignalId: existing.id,
        matchReason: `same_type_within_${NARROW_WINDOW_HOURS}h`,
      };
    }

    // ── Check 2: Jaccard similarity within wide window ──────────────────
    if (hoursDiff <= WIDE_WINDOW_HOURS) {
      // Build the existing signal's text for comparison
      const existingText = buildComparisonText(existing);
      if (existingText && contentText) {
        const similarity = jaccardSimilarity(contentText, existingText);
        if (similarity >= JACCARD_THRESHOLD) {
          await boostConfidence(existing.id, existing.confidence_score);
          return {
            isDuplicate: true,
            matchedSignalId: existing.id,
            matchReason: `jaccard_${similarity.toFixed(2)}_within_${WIDE_WINDOW_HOURS}h`,
          };
        }
      }
    }
  }

  return { isDuplicate: false, matchedSignalId: null, matchReason: null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildComparisonText(signal: RecentSignal): string {
  const parts: string[] = [];
  if (signal.summary) parts.push(signal.summary);
  if (signal.signal_data?.current_excerpt) parts.push(signal.signal_data.current_excerpt);
  return parts.join(" ").slice(0, 500);
}

async function boostConfidence(signalId: string, currentConfidence: number): Promise<void> {
  const newConfidence = Math.min(MAX_CONFIDENCE, currentConfidence + CORROBORATION_BOOST);
  if (newConfidence <= currentConfidence) return;
  try {
    await supabase
      .from("signals")
      .update({ confidence_score: newConfidence })
      .eq("id", signalId);
  } catch {
    // Non-fatal — the dedup decision is more important than the boost.
  }
}
