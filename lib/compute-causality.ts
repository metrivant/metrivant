/**
 * Signal Causality Detection Engine
 *
 * Detects cause→effect relationships between signals to transform isolated point
 * events into coherent strategic narratives.
 *
 * Core insight: Sequences like hiring_spike → product_launch → pricing_change
 * reveal strategic intent (market expansion) that's invisible when signals are
 * viewed atomically.
 *
 * Detection approach:
 * 1. Template matching: predefined causal patterns (hiring→launch: 7-21d)
 * 2. AI validation: GPT-4o-mini validates candidate pairs with evidence
 * 3. Confidence scoring: template match = 0.6-0.7, AI validated = 0.8-0.95
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openai } from "./openai";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CausalTemplate = {
  name: string;
  precursor_type: string; // signal_type that happens first
  consequence_type: string; // signal_type that happens after
  min_days: number; // minimum time gap
  max_days: number; // maximum time gap
  base_confidence: number; // 0.6-0.7 for template matches
  description: string; // human-readable explanation
};

export type SignalForCausality = {
  id: string;
  competitor_id: string;
  signal_type: string;
  detected_at: string;
  summary: string | null;
  confidence_score: number | null;
};

export type CausalRelationship = {
  signal_id: string;
  related_signal_id: string;
  relationship_type: "precursor" | "consequence" | "corroboration";
  confidence_score: number;
  detection_method: "template_match" | "ai_validated";
  metadata: {
    template_name?: string;
    time_gap_days?: number;
    ai_reasoning?: string;
  };
};

// ── Causal Templates ───────────────────────────────────────────────────────────

export const CAUSAL_TEMPLATES: CausalTemplate[] = [
  {
    name: "hiring_to_launch",
    precursor_type: "hiring_spike",
    consequence_type: "product_launch",
    min_days: 7,
    max_days: 21,
    base_confidence: 0.7,
    description: "Sales/engineering hiring spike precedes product launch",
  },
  {
    name: "hiring_to_launch_alt",
    precursor_type: "hiring_spike",
    consequence_type: "feature_launch",
    min_days: 7,
    max_days: 21,
    base_confidence: 0.7,
    description: "Engineering hiring spike precedes feature launch",
  },
  {
    name: "launch_to_messaging",
    precursor_type: "product_launch",
    consequence_type: "messaging_shift",
    min_days: 0,
    max_days: 5,
    base_confidence: 0.65,
    description: "Product launch triggers positioning/messaging update",
  },
  {
    name: "launch_to_messaging_alt",
    precursor_type: "feature_launch",
    consequence_type: "messaging_shift",
    min_days: 0,
    max_days: 5,
    base_confidence: 0.65,
    description: "Feature launch triggers positioning update",
  },
  {
    name: "pricing_to_messaging",
    precursor_type: "price_point_change",
    consequence_type: "messaging_shift",
    min_days: 0,
    max_days: 3,
    base_confidence: 0.7,
    description: "Pricing change triggers positioning adjustment",
  },
  {
    name: "pricing_to_launch",
    precursor_type: "feature_launch",
    consequence_type: "price_point_change",
    min_days: 0,
    max_days: 14,
    base_confidence: 0.65,
    description: "New feature enables pricing strategy shift",
  },
  {
    name: "acquisition_to_expansion",
    precursor_type: "acquisition",
    consequence_type: "team_expansion",
    min_days: 14,
    max_days: 45,
    base_confidence: 0.75,
    description: "Acquisition leads to team expansion",
  },
  {
    name: "acquisition_to_hiring",
    precursor_type: "acquisition",
    consequence_type: "hiring_spike",
    min_days: 14,
    max_days: 45,
    base_confidence: 0.75,
    description: "Acquisition triggers hiring surge",
  },
  {
    name: "contract_to_hiring",
    precursor_type: "major_contract",
    consequence_type: "hiring_spike",
    min_days: 7,
    max_days: 30,
    base_confidence: 0.7,
    description: "Major contract win triggers hiring",
  },
  {
    name: "contract_to_expansion",
    precursor_type: "major_contract",
    consequence_type: "team_expansion",
    min_days: 7,
    max_days: 30,
    base_confidence: 0.7,
    description: "Major contract win drives team expansion",
  },
  {
    name: "reposition_to_product",
    precursor_type: "market_reposition",
    consequence_type: "product_expansion",
    min_days: 14,
    max_days: 60,
    base_confidence: 0.65,
    description: "Market repositioning precedes product expansion",
  },
  {
    name: "regulatory_to_compliance",
    precursor_type: "regulatory_event",
    consequence_type: "compliance_update",
    min_days: 0,
    max_days: 30,
    base_confidence: 0.75,
    description: "Regulatory event drives compliance response",
  },
];

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Load recent signals for a competitor within time window.
 *
 * @param supabase - Supabase client
 * @param competitorId - Competitor UUID
 * @param windowDays - Days to look back (default 14)
 * @returns Array of signals suitable for causality detection
 */
export async function loadSignalWindow(
  supabase: SupabaseClient,
  competitorId: string,
  windowDays: number = 14
): Promise<SignalForCausality[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Load both page-diff and pool signals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pageSignals } = await (supabase as any)
    .from("signals")
    .select("id, signal_type, detected_at, competitor_id, confidence_score")
    .not("monitored_page_id", "is", null)
    .eq("competitor_id", competitorId)
    .gte("detected_at", since)
    .in("status", ["pending", "interpreted"]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: poolSignals } = await (supabase as any)
    .from("signals")
    .select("id, signal_type, detected_at, competitor_id, confidence_score")
    .is("monitored_page_id", null)
    .eq("competitor_id", competitorId)
    .gte("detected_at", since)
    .in("status", ["pending", "interpreted"]);

  const allSignals = [...(pageSignals ?? []), ...(poolSignals ?? [])];

  // Get interpretations for summaries (best-effort)
  const signalIds = allSignals.map((s: { id: string }) => s.id);
  let summaryMap = new Map<string, string>();
  if (signalIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: interps } = await (supabase as any)
      .from("interpretations")
      .select("signal_id, summary")
      .in("signal_id", signalIds);
    summaryMap = new Map(
      (interps ?? []).map((i: { signal_id: string; summary: string }) => [i.signal_id, i.summary])
    );
  }

  return allSignals.map((s: {
    id: string;
    competitor_id: string;
    signal_type: string;
    detected_at: string;
    confidence_score: number | null;
  }) => ({
    id: s.id,
    competitor_id: s.competitor_id,
    signal_type: s.signal_type,
    detected_at: s.detected_at,
    summary: summaryMap.get(s.id) ?? null,
    confidence_score: s.confidence_score,
  }));
}

/**
 * Detect causal relationships using template matching.
 *
 * @param signals - Signals to analyze (must be sorted by detected_at ASC)
 * @returns Array of candidate causal relationships
 */
export function detectCausalPairs(signals: SignalForCausality[]): CausalRelationship[] {
  const relationships: CausalRelationship[] = [];

  // Sort by detected_at ascending (oldest first)
  const sorted = [...signals].sort(
    (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
  );

  // For each template, look for matching pairs
  for (const template of CAUSAL_TEMPLATES) {
    for (let i = 0; i < sorted.length; i++) {
      const precursor = sorted[i];
      if (precursor.signal_type !== template.precursor_type) continue;

      // Look for consequence signals within time window
      for (let j = i + 1; j < sorted.length; j++) {
        const consequence = sorted[j];
        if (consequence.signal_type !== template.consequence_type) continue;

        const gapMs =
          new Date(consequence.detected_at).getTime() - new Date(precursor.detected_at).getTime();
        const gapDays = gapMs / (24 * 60 * 60 * 1000);

        if (gapDays >= template.min_days && gapDays <= template.max_days) {
          // Template match found
          relationships.push({
            signal_id: precursor.id,
            related_signal_id: consequence.id,
            relationship_type: "precursor",
            confidence_score: template.base_confidence,
            detection_method: "template_match",
            metadata: {
              template_name: template.name,
              time_gap_days: Math.round(gapDays * 10) / 10,
            },
          });
        }
      }
    }
  }

  return relationships;
}

/**
 * Validate a causal relationship using AI.
 *
 * Uses GPT-4o-mini to assess whether the relationship is plausible given
 * the signal summaries and timing.
 *
 * @param supabase - Supabase client (not used)
 * @param precursor - First signal
 * @param consequence - Second signal
 * @param relationship - Template-detected relationship
 * @returns Enhanced relationship with AI validation (or null if rejected)
 */
export async function validateRelationship(
  supabase: SupabaseClient,
  precursor: SignalForCausality,
  consequence: SignalForCausality,
  relationship: CausalRelationship
): Promise<CausalRelationship | null> {
  try {
    // Format dates for readability
    const precursorDate = new Date(precursor.detected_at).toISOString().slice(0, 10);
    const consequenceDate = new Date(consequence.detected_at).toISOString().slice(0, 10);
    const timeGapDays = relationship.metadata.time_gap_days ?? 0;
    const templateName = relationship.metadata.template_name ?? "unknown";

    // Build prompt with signal details
    const systemPrompt = `You validate causal relationships between competitor signals.

Given two signals and their timing, determine if the causal link is plausible based on typical business behavior patterns.

Consider:
- Are these signal types causally related? (e.g., hiring often precedes launches)
- Is the timing reasonable for this relationship?
- Does the order make sense? (cause before effect)

Return ONLY: { "plausible": true|false, "confidence": 0.8-0.95, "reasoning": "one sentence" }`;

    const userPrompt = `PRECURSOR: ${precursor.signal_type}${precursor.summary ? ` (${precursor.summary})` : ""} detected ${precursorDate}.
CONSEQUENCE: ${consequence.signal_type}${consequence.summary ? ` (${consequence.summary})` : ""} detected ${consequenceDate}.
Time gap: ${timeGapDays} days.
Template: ${templateName.replace(/_/g, " ")}.

Is this causal link plausible?`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      plausible?: boolean;
      confidence?: number;
      reasoning?: string;
    };

    const plausible = parsed.plausible ?? false;
    const aiConfidence = parsed.confidence ?? 0.85;
    const reasoning = parsed.reasoning ?? "No reasoning provided";

    if (!plausible) {
      // Reject relationship — return null so it's not added to signal_relationships
      return null;
    }

    // Plausible — boost confidence and add AI reasoning
    return {
      ...relationship,
      confidence_score: Math.min(1.0, aiConfidence),
      detection_method: "ai_validated",
      metadata: {
        ...relationship.metadata,
        ai_reasoning: reasoning,
      },
    };
  } catch (error) {
    // Fail-safe: on validation error, accept template match as-is
    // This prevents validation failures from blocking relationship detection entirely
    console.error("validateRelationship error:", error instanceof Error ? error.message : error);
    return relationship;
  }
}

/**
 * Compute all causal relationships for a competitor's recent signals.
 *
 * @param supabase - Supabase client
 * @param competitorId - Competitor UUID
 * @param windowDays - Days to look back (default 14)
 * @returns Array of detected and validated relationships
 */
export async function computeCausalityForCompetitor(
  supabase: SupabaseClient,
  competitorId: string,
  windowDays: number = 14
): Promise<CausalRelationship[]> {
  // Load signals
  const signals = await loadSignalWindow(supabase, competitorId, windowDays);

  if (signals.length < 2) {
    return []; // Need at least 2 signals to detect relationships
  }

  // Detect candidate pairs via template matching
  const candidates = detectCausalPairs(signals);

  // Validate each candidate (currently pass-through, future: AI validation)
  const validated: CausalRelationship[] = [];
  for (const candidate of candidates) {
    const precursor = signals.find((s) => s.id === candidate.signal_id);
    const consequence = signals.find((s) => s.id === candidate.related_signal_id);

    if (!precursor || !consequence) continue;

    const result = await validateRelationship(supabase, precursor, consequence, candidate);
    if (result) {
      validated.push(result);
    }
  }

  return validated;
}
