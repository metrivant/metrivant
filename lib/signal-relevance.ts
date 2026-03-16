// Signal relevance classification via gpt-4o-mini.
// Runs immediately after signal creation, before interpretation.
// Purpose: prevent low-value diffs from consuming interpretation quota.
//
// Rules:
// - Default bias is permissive — prefer medium over low when uncertain
// - high_value page_class signals can never be classified 'low'
// - Never suppresses signals — classification is advisory only

import { openai } from "./openai";

export type RelevanceLevel = "high" | "medium" | "low";

export interface SignalRelevanceInput {
  competitor_name: string;
  section_type:    string;
  page_class:      string;
  signal_type:     string;
  previous_excerpt: string;
  current_excerpt:  string;
}

export interface RelevanceResult {
  relevance_level: RelevanceLevel;
  rationale:       string;
}

const SYSTEM_PROMPT = `You classify competitor website changes for strategic relevance.

Return JSON with exactly:
- relevance_level: "high" | "medium" | "low"
- rationale: one sentence (max 15 words)

Definitions:
- high: pricing change, product launch, positioning shift, strategic announcement, hiring surge
- medium: notable but context-dependent — new content section, messaging update, feature mention
- low: cosmetic only — footer edit, cookie banner, pagination text, minor punctuation, whitespace

Default bias: permissive. When uncertain, prefer medium over low.
high_value page class (pricing, changelog, newsroom): never return low.

Return only valid JSON.`;

export async function classifySignalRelevance(
  signal: SignalRelevanceInput
): Promise<RelevanceResult> {
  const isHighValue = signal.page_class === "high_value";

  const userPrompt = [
    `Competitor: ${signal.competitor_name}`,
    `Section: ${signal.section_type} | Page class: ${signal.page_class} | Signal: ${signal.signal_type}`,
    ``,
    `Previous:`,
    signal.previous_excerpt.slice(0, 300) || "(empty)",
    ``,
    `Current:`,
    signal.current_excerpt.slice(0, 300) || "(empty)",
  ].join("\n");

  const response = await openai.chat.completions.create({
    model:           "gpt-4o-mini",
    temperature:     0,
    max_tokens:      80,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("empty response from relevance classifier");

  const parsed = JSON.parse(content) as Partial<RelevanceResult>;
  let level    = parsed.relevance_level;

  // Hard gate: high_value pages cannot be classified low
  if (isHighValue && level === "low") level = "medium";

  // Coerce unexpected values to medium (permissive default)
  if (level !== "high" && level !== "medium" && level !== "low") level = "medium";

  return {
    relevance_level: level,
    rationale:       typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 200) : "",
  };
}
