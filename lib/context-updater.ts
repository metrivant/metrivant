// lib/context-updater.ts
// Post-interpretation context update: calls GPT-4o-mini to revise the hypothesis,
// append evidence, and update open questions based on new signal interpretations.

import { openai } from "./openai";
import { supabase } from "./supabase";
import {
  CompetitorContext,
  ContextEvidenceItem,
  upsertCompetitorContext,
} from "./competitor-context";

type NewEvidence = {
  signal_type: string;
  summary: string;
  strategic_implication: string | null;
  detected_at: string;
};

// Jaccard word-overlap similarity between two hypothesis strings.
// Returns true when word overlap is < 50% — indicating a significant strategic pivot.
function hypothesisShifted(prev: string | null, next: string): boolean {
  if (!prev || !next) return false;
  const prevWords = new Set<string>(prev.toLowerCase().match(/\w+/g) ?? []);
  const nextWords = new Set<string>(next.toLowerCase().match(/\w+/g) ?? []);
  const intersection = [...prevWords].filter((w) => nextWords.has(w)).length;
  const union = new Set([...prevWords, ...nextWords]).size;
  return union > 0 && intersection / union < 0.50;
}

// Resolve org_id from tracked_competitors for a given competitor.
// Returns the first org that tracks this competitor, or null if none found.
async function resolveOrgId(competitorId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("tracked_competitors")
    .select("org_id")
    .eq("competitor_id", competitorId)
    .limit(1)
    .single();
  return (data as { org_id: string } | null)?.org_id ?? null;
}

export async function updateCompetitorContext(
  existing: CompetitorContext | null,
  competitorId: string,
  orgId: string,
  competitorName: string,
  newEvidence: NewEvidence[]
): Promise<void> {
  if (newEvidence.length === 0) return;

  // Resolve org_id: prefer the caller-supplied value; fall back to tracked_competitors lookup
  // if the caller passed an empty string (e.g. pool-agnostic signals with no org context).
  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    const looked = await resolveOrgId(competitorId);
    if (!looked) return; // Cannot persist without org_id — skip silently
    resolvedOrgId = looked;
  }

  const existingCtxText = existing
    ? `Current hypothesis: ${existing.hypothesis ?? "none"}
Confidence: ${existing.confidence_level}
Evidence trail (last 5): ${JSON.stringify(existing.evidence_trail.slice(-5))}
Open questions: ${JSON.stringify(existing.open_questions)}
Strategic arc: ${existing.strategic_arc ?? "none"}`
    : "No existing context — building from scratch.";

  const newEvidenceText = newEvidence
    .map(
      (e) =>
        `[${e.detected_at.slice(0, 10)}] ${e.signal_type}: ${e.summary}${e.strategic_implication ? ` — ${e.strategic_implication}` : ""}`
    )
    .join("\n");

  const systemPrompt = `You are a strategic intelligence analyst. Your job is to maintain a compact, accurate strategic profile for a competitor based on accumulated evidence.

Output valid JSON only. No prose outside the JSON object.`;

  const userPrompt = `Competitor: ${competitorName}

Existing context:
${existingCtxText}

New signal interpretations to integrate:
${newEvidenceText}

Update the competitor context. Return JSON with this exact shape:
{
  "hypothesis": "1-2 sentence strategic hypothesis — what is this competitor building toward?",
  "confidence_level": "low|medium|high",
  "new_evidence_items": [
    { "signal_type": "...", "summary": "...", "verdict": "validates|contradicts|neutral" }
  ],
  "open_questions": ["...", "..."],
  "strategic_arc": "3-sentence rolling summary of confirmed movements over the past 3 months"
}

Rules:
- hypothesis must be specific and falsifiable, not generic
- confidence_level: low = 1-2 weak signals, medium = 3-4 consistent signals, high = 5+ signals with clear pattern
- new_evidence_items: one item per new signal
- open_questions: max 3, only include genuine unknowns
- strategic_arc: summary of MOVEMENTS (not signals), drawn from evidence trail`;

  let parsed: {
    hypothesis: string;
    confidence_level: "low" | "medium" | "high";
    new_evidence_items: Array<{ signal_type: string; summary: string; verdict: "validates" | "contradicts" | "neutral" }>;
    open_questions: string[];
    strategic_arc: string;
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    parsed = JSON.parse(raw);
  } catch {
    // Non-blocking: if update fails, existing context is preserved
    return;
  }

  const newItems: ContextEvidenceItem[] = (parsed.new_evidence_items ?? []).map(
    (item, i) => ({
      date: newEvidence[i]?.detected_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      signal_type: item.signal_type,
      summary: item.summary,
      verdict: item.verdict,
    })
  );

  const updatedTrail: ContextEvidenceItem[] = [
    ...(existing?.evidence_trail ?? []),
    ...newItems,
  ].slice(-20); // Keep last 20 items max

  const newHypothesis = parsed.hypothesis ?? existing?.hypothesis ?? null;
  const shifted = newHypothesis !== null && hypothesisShifted(existing?.hypothesis ?? null, newHypothesis);

  await upsertCompetitorContext({
    competitor_id: competitorId,
    org_id: resolvedOrgId,
    competitor_name: competitorName,
    hypothesis:       newHypothesis,
    confidence_level: parsed.confidence_level ?? existing?.confidence_level ?? "low",
    evidence_trail:   updatedTrail,
    open_questions:   parsed.open_questions ?? existing?.open_questions ?? [],
    strategic_arc:    parsed.strategic_arc ?? existing?.strategic_arc ?? null,
    signal_count:     (existing?.signal_count ?? 0) + newEvidence.length,
    // Hypothesis shift tracking: snapshot old hypothesis, clear alerted flag so
    // check-signals will send a "Strategy Pivot Detected" email on next run.
    previous_hypothesis:         shifted ? (existing?.hypothesis ?? null) : (existing?.previous_hypothesis ?? null),
    hypothesis_changed_at:       shifted ? new Date().toISOString() : (existing?.hypothesis_changed_at ?? null),
    hypothesis_shift_alerted_at: shifted ? null : (existing?.hypothesis_shift_alerted_at ?? null),
  });
}
