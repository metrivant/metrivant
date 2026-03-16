// Strategic movement narrative synthesis via gpt-4o.
// Called by the decoupled synthesize-movement-narratives cron — NOT inline
// during detect-movements. This ensures LLM latency/failures cannot affect
// movement detection throughput.

import { openai } from "./openai";

export interface SignalForSynthesis {
  signal_type:             string;
  section_type:            string;
  summary:                 string | null;
  strategic_implication:   string | null;
  detected_at:             string;
  changed_content_snippet?: string | null; // ≤300 char excerpt of actual diff content
}

export interface MovementSynthesisResult {
  movement_summary:      string;
  strategic_implication: string;
  confidence_level:      "high" | "medium" | "low";
  confidence_reason:     string;
}

const SYSTEM_PROMPT = `You are a competitive intelligence analyst.

Your task is to synthesize multiple observed signals from a competitor
into a concise explanation of the strategic movement they represent.

Focus on identifying the strategic thread connecting the signals.
Your explanation must reference concrete evidence from the signals.
State your assessment directly.
Use confidence qualifiers sparingly and only when evidence is genuinely ambiguous.
Do not hedge every sentence.
Do not speculate beyond the signals provided.

Return JSON with exactly these fields:
- movement_summary: 2-3 sentences — what the competitor is doing and what it signals, grounded in the observed evidence
- strategic_implication: 1-2 sentences — why this matters for the reader's competitive position
- confidence_level: "high" | "medium" | "low"
  - high = multiple consistent signals with clear content evidence
  - medium = signals point in the same direction but evidence is partial
  - low = signals are sparse or ambiguous
- confidence_reason: one sentence explaining the rating

Rules:
- Reference specific observed actions, not generic descriptions
- Write like a practitioner, not a consultant
- Never use: leverage, synergy, holistic, it's worth noting, in conclusion, going forward
- Never recommend monitoring as a response
- Return only valid JSON`;

export async function synthesizeMovement(
  competitorName: string,
  movementType:   string,
  sector:         string,
  signals:        SignalForSynthesis[]
): Promise<MovementSynthesisResult | null> {
  if (signals.length === 0) return null;

  const sectorHint = sector && sector !== "custom" ? ` (${sector} sector)` : "";

  // Build compact signal list — cap at 8 to keep prompt bounded
  const signalLines = signals.slice(0, 8).map((s, i) => {
    const parts = [`${i + 1}. [${s.signal_type} / ${s.section_type}] ${s.detected_at.slice(0, 10)}`];
    if (s.changed_content_snippet) parts.push(`Evidence: "${s.changed_content_snippet.slice(0, 200)}"`);
    else if (s.summary)            parts.push(s.summary);
    if (s.strategic_implication)   parts.push(`→ ${s.strategic_implication}`);
    return parts.join(" ");
  });

  const userPrompt = [
    `Competitor: ${competitorName}${sectorHint}`,
    `Sector: ${sector}`,
    `Movement Type: ${movementType.replace(/_/g, " ")}`,
    ``,
    `Signals detected in the last 14 days:`,
    ...signalLines,
    ``,
    `Explain the strategic movement suggested by these signals.`,
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model:           "gpt-4o",
      temperature:     0.1,
      max_tokens:      280,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<MovementSynthesisResult>;
    if (!parsed.movement_summary || !parsed.strategic_implication) return null;

    const confidenceLevel = (["high", "medium", "low"] as const).includes(
      parsed.confidence_level as "high" | "medium" | "low"
    )
      ? (parsed.confidence_level as "high" | "medium" | "low")
      : "medium";

    return {
      movement_summary:      parsed.movement_summary,
      strategic_implication: parsed.strategic_implication,
      confidence_level:      confidenceLevel,
      confidence_reason:     parsed.confidence_reason ?? "",
    };
  } catch {
    return null;
  }
}
