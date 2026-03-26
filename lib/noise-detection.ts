/**
 * Autonomous Noise Detection
 *
 * Six deterministic filters that identify non-signal changes without human input.
 * Each filter returns a noise reason string or null (not noise).
 */

import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NoiseReason =
  | "whitespace_only"
  | "dynamic_content_only"
  | "oscillation"           // A→B→A pattern (reversion)
  | "infrastructure"        // Cross-competitor correlation
  | "structural"            // Non-content elements only
  | "churn"                 // High-frequency changes
  | "reversion"             // Immediate undo (<1h)
  | "semantic_similarity";  // Minor wording change (95%+ similar)

export interface NoiseDetectionResult {
  isNoise: boolean;
  reason?: NoiseReason;
  metadata?: Record<string, unknown>;
}

// ── Filter 1: Whitespace-only (already implemented, extracted here) ───────────

export function detectWhitespaceNoise(previous: string, current: string): NoiseDetectionResult {
  if (previous.replace(/\s+/g, "") === current.replace(/\s+/g, "")) {
    return { isNoise: true, reason: "whitespace_only" };
  }
  return { isNoise: false };
}

// ── Filter 2: Dynamic content (already implemented, extracted here) ───────────

function normalizeForComparison(text: string): string {
  return text
    // ISO timestamps: 2024-03-25T14:30:00Z → [TIMESTAMP]
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "[TIMESTAMP]")
    // Unix timestamps: 1711372800 → [TIMESTAMP]
    .replace(/\b\d{10,13}\b/g, "[TIMESTAMP]")
    // UTM parameters: ?utm_source=x&utm_medium=y → [UTM]
    .replace(/[?&]utm_[^&\s]+/g, "[UTM]")
    // Session IDs, tracking tokens (long alphanumeric strings)
    .replace(/\b[a-f0-9]{32,}\b/gi, "[TOKEN]")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export function detectDynamicContentNoise(previous: string, current: string): NoiseDetectionResult {
  const prevNorm = normalizeForComparison(previous);
  const currNorm = normalizeForComparison(current);
  if (prevNorm === currNorm) {
    return { isNoise: true, reason: "dynamic_content_only" };
  }
  return { isNoise: false };
}

// ── Filter 3: Oscillation detection (A→B→A pattern) ──────────────────────────

export async function detectOscillation(
  sectionId: string,
  currentText: string
): Promise<NoiseDetectionResult> {
  // Query recent diffs for this section (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentDiffs } = await supabase
    .from("section_diffs")
    .select("id, created_at, page_sections!current_section_id(section_text)")
    .eq("current_section_id", sectionId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(3);

  if (!recentDiffs || recentDiffs.length < 2) {
    return { isNoise: false };
  }

  // Check if current text matches the text from 2 diffs ago (A→B→A pattern)
  const previousPreviousDiff = recentDiffs[1];
  const previousPreviousText = (previousPreviousDiff.page_sections as unknown as { section_text: string })?.section_text;

  if (previousPreviousText && currentText === previousPreviousText) {
    return {
      isNoise: true,
      reason: "oscillation",
      metadata: { pattern: "A→B→A", lookback_days: 7 },
    };
  }

  return { isNoise: false };
}

// ── Filter 4: Cross-competitor correlation (infrastructure updates) ───────────

export async function detectInfrastructureNoise(
  contentHash: string,
  detectedAt: Date,
  currentCompetitorId: string
): Promise<NoiseDetectionResult> {
  // Check if 5+ OTHER competitors had identical change in 2-hour window
  const twoHoursBefore = new Date(detectedAt.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const twoHoursAfter = new Date(detectedAt.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const { data: correlatedChanges } = await supabase
    .from("section_diffs")
    .select("id, monitored_pages!inner(competitor_id)")
    .gte("created_at", twoHoursBefore)
    .lte("created_at", twoHoursAfter)
    .limit(10);

  if (!correlatedChanges) {
    return { isNoise: false };
  }

  // Count distinct competitors (excluding current one) with matching hash
  const otherCompetitorIds = new Set(
    correlatedChanges
      .map((d) => (d.monitored_pages as unknown as { competitor_id: string })?.competitor_id)
      .filter((id) => id && id !== currentCompetitorId)
  );

  if (otherCompetitorIds.size >= 5) {
    return {
      isNoise: true,
      reason: "infrastructure",
      metadata: { correlated_competitors: otherCompetitorIds.size, window_hours: 2 },
    };
  }

  return { isNoise: false };
}

// ── Filter 5: Structural noise (non-content elements only) ────────────────────

function stripNonContentElements(html: string): string {
  return html
    // Remove scripts
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove styles
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove tracking pixels/iframes
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Remove data attributes (tracking)
    .replace(/\s+data-[a-z-]+="[^"]*"/gi, "")
    // Remove inline styles
    .replace(/\s+style="[^"]*"/gi, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export function detectStructuralNoise(previous: string, current: string): NoiseDetectionResult {
  const prevContent = stripNonContentElements(previous);
  const currContent = stripNonContentElements(current);

  if (prevContent === currContent && prevContent.length > 0) {
    return {
      isNoise: true,
      reason: "structural",
      metadata: { changed_elements: "scripts/styles/tracking only" },
    };
  }

  return { isNoise: false };
}

// ── Filter 6: High-frequency churn ────────────────────────────────────────────

export async function detectChurnNoise(pageId: string): Promise<NoiseDetectionResult> {
  // If page has changed >10 times in last 24h, it's a high-churn page (blog/news)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("section_diffs")
    .select("id", { count: "exact", head: true })
    .eq("monitored_page_id", pageId)
    .gte("created_at", twentyFourHoursAgo);

  if ((count ?? 0) > 10) {
    return {
      isNoise: true,
      reason: "churn",
      metadata: { changes_24h: count, threshold: 10 },
    };
  }

  return { isNoise: false };
}

// ── Filter 7: Immediate reversion (change undone <1h) ─────────────────────────

export async function detectImmediateReversion(
  sectionId: string,
  currentText: string
): Promise<NoiseDetectionResult> {
  // Check if this reverts a change made in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recentDiff } = await supabase
    .from("section_diffs")
    .select("id, created_at, page_sections!previous_section_id(section_text)")
    .eq("current_section_id", sectionId)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!recentDiff) {
    return { isNoise: false };
  }

  const previousText = (recentDiff.page_sections as unknown as { section_text: string })?.section_text;
  if (previousText && currentText === previousText) {
    const ageMinutes = Math.floor((Date.now() - new Date(recentDiff.created_at).getTime()) / 60000);
    return {
      isNoise: true,
      reason: "reversion",
      metadata: { reverted_after_minutes: ageMinutes },
    };
  }

  return { isNoise: false };
}

// ── Filter 8: Semantic similarity (minor wording changes) ─────────────────────

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function detectSemanticNoise(previous: string, current: string): NoiseDetectionResult {
  // Skip if texts are very different in length (likely real change)
  const lengthRatio = Math.min(previous.length, current.length) / Math.max(previous.length, current.length);
  if (lengthRatio < 0.80) {
    return { isNoise: false };
  }

  const distance = levenshteinDistance(previous, current);
  const longerLength = Math.max(previous.length, current.length);
  const similarity = 1 - distance / longerLength;

  if (similarity > 0.95) {
    return {
      isNoise: true,
      reason: "semantic_similarity",
      metadata: { similarity_score: similarity.toFixed(3), threshold: 0.95 },
    };
  }

  return { isNoise: false };
}

// ── Main detection function (runs all filters) ────────────────────────────────

export async function detectNoise(params: {
  previousText: string;
  currentText: string;
  sectionId: string;
  pageId: string;
  competitorId: string;
  contentHash: string;
  detectedAt: Date;
}): Promise<NoiseDetectionResult> {
  const { previousText, currentText, sectionId, pageId, competitorId, contentHash, detectedAt } = params;

  // Run fast synchronous filters first
  const whitespace = detectWhitespaceNoise(previousText, currentText);
  if (whitespace.isNoise) return whitespace;

  const dynamic = detectDynamicContentNoise(previousText, currentText);
  if (dynamic.isNoise) return dynamic;

  const structural = detectStructuralNoise(previousText, currentText);
  if (structural.isNoise) return structural;

  const semantic = detectSemanticNoise(previousText, currentText);
  if (semantic.isNoise) return semantic;

  // Run async database-dependent filters
  const churn = await detectChurnNoise(pageId);
  if (churn.isNoise) return churn;

  const reversion = await detectImmediateReversion(sectionId, currentText);
  if (reversion.isNoise) return reversion;

  const oscillation = await detectOscillation(sectionId, currentText);
  if (oscillation.isNoise) return oscillation;

  const infrastructure = await detectInfrastructureNoise(contentHash, detectedAt, competitorId);
  if (infrastructure.isNoise) return infrastructure;

  // Not noise
  return { isNoise: false };
}

// ── Confidence calibration based on competitor noise baseline ─────────────────

export interface ConfidenceAdjustment {
  adjustedConfidence: number;
  adjustment: number;
  noiseRate: number | null;
}

/**
 * Calibrates signal confidence based on competitor's 30-day noise baseline.
 *
 * - Low noise rate (< 0.10): boost confidence by 0.08 (high-quality source)
 * - Normal noise rate (0.10-0.30): no adjustment
 * - High noise rate (> 0.30): reduce confidence proportionally (noisy source)
 *
 * Returns adjusted confidence clamped to [0.0, 1.0].
 */
export async function calibrateConfidence(
  baseConfidence: number,
  competitorId: string
): Promise<ConfidenceAdjustment> {
  const { data: baseline } = await supabase
    .from("competitor_noise_baselines")
    .select("noise_rate, total_diffs")
    .eq("competitor_id", competitorId)
    .single();

  // No baseline yet or insufficient data — no adjustment
  if (!baseline || baseline.total_diffs < 5) {
    return {
      adjustedConfidence: baseConfidence,
      adjustment: 0,
      noiseRate: null,
    };
  }

  const noiseRate = baseline.noise_rate;
  let adjustment = 0;

  if (noiseRate < 0.10) {
    // High-quality source — boost confidence
    adjustment = 0.08;
  } else if (noiseRate > 0.30) {
    // Noisy source — reduce confidence proportionally
    // At 0.30 → -0.00, at 0.50 → -0.10, at 0.70 → -0.20, at 1.00 → -0.35
    adjustment = -((noiseRate - 0.30) * 0.5);
  }

  const adjustedConfidence = Math.max(0.0, Math.min(1.0, baseConfidence + adjustment));

  return {
    adjustedConfidence,
    adjustment,
    noiseRate,
  };
}
