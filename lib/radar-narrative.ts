// Radar Intelligence Narratives — GPT-4o-mini summarization layer.
//
// Explains why a competitor's radar activity increased.
// Called by the decoupled generate-radar-narratives cron.
// Radar physics and node positions remain deterministic and unaffected.

import { openai } from "./openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignalForNarrative {
  signal_id:               string;
  page_class:              string;   // high_value | standard | ambient
  section_type:            string;
  summary:                 string | null;
  changed_content_snippet: string | null; // ≤300 char excerpt from interpretation
  detected_at:             string;
}

export interface RadarNarrativeResult {
  radar_explanation: string;
  signal_count:      number;
}

// ── Signal selection ──────────────────────────────────────────────────────────

const PAGE_CLASS_RANK: Record<string, number> = {
  high_value: 1,
  standard:   2,
  ambient:    3,
};

/**
 * Selects up to 5 signals using the priority strategy:
 *   1. high_value before standard before ambient
 *   2. Within each tier: newest first
 */
export function selectSignalsForNarrative(signals: SignalForNarrative[]): SignalForNarrative[] {
  return [...signals]
    .sort((a, b) => {
      const rankA = PAGE_CLASS_RANK[a.page_class] ?? 4;
      const rankB = PAGE_CLASS_RANK[b.page_class] ?? 4;
      if (rankA !== rankB) return rankA - rankB;
      return b.detected_at.localeCompare(a.detected_at); // newest first within tier
    })
    .slice(0, 5);
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a competitive intelligence analyst explaining activity on a competitor monitoring radar.

Given recent signals for a competitor, explain why the competitor's activity increased.

Your explanation must reference the signals provided.
Lead with the most strategically important signal.
Do not narrate events chronologically.
Organize the explanation by significance, not by time.
Do not speculate beyond the evidence.
Keep the explanation concise.

Return JSON with exactly:
- radar_explanation: 1-2 sentence explanation referencing the signal evidence
- signal_count: number of signals you are summarizing

Return only valid JSON.`;

// ── GPT-4o-mini call ──────────────────────────────────────────────────────────

export async function generateRadarNarrative(
  competitorName: string,
  sector:         string,
  pressureIndex:  number,
  signals:        SignalForNarrative[]
): Promise<RadarNarrativeResult | null> {
  if (signals.length === 0) return null;

  const signalLines = signals.map((s, i) => {
    const parts = [`${i + 1}. [${s.page_class} / ${s.section_type}]`];
    const evidence = s.changed_content_snippet ?? s.summary;
    if (evidence) parts.push(`"${evidence.slice(0, 200)}"`);
    return parts.join(" ");
  });

  const userPrompt = [
    `Competitor: ${competitorName}`,
    `Sector: ${sector}`,
    `Pressure Index: ${pressureIndex.toFixed(1)}`,
    ``,
    `Recent signals:`,
    ...signalLines,
    ``,
    `Explain why this competitor's activity increased.`,
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      temperature:     0.1,
      max_tokens:      120,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<RadarNarrativeResult>;
    if (!parsed.radar_explanation) return null;

    return {
      radar_explanation: parsed.radar_explanation,
      signal_count:      typeof parsed.signal_count === "number" ? parsed.signal_count : signals.length,
    };
  } catch {
    return null;
  }
}
