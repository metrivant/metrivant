/**
 * Weekly Brief Validation
 *
 * Validates GPT-4o-generated briefs against their source artifacts to ensure
 * grounding in evidence and prevent hallucinations before email delivery.
 *
 * Validation approach:
 * 1. Load brief content (BriefContent JSON) and source artifacts (sector_summary,
 *    movements[], activity[])
 * 2. GPT-4o-mini prompt: "Does this brief accurately reflect the source data?
 *    Flag any claims not supported by the artifacts."
 * 3. Returns: validation_status ('validated'|'weak'|'hallucinated'),
 *    validation_reasoning (one-sentence explanation)
 * 4. Hallucinated briefs skip email delivery, trigger Sentry warning
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type BriefValidationResult = {
  validation_status: "validated" | "weak" | "hallucinated";
  validation_reasoning: string;
};

const BASE_SYSTEM_PROMPT = `You are a quality assurance analyst reviewing AI-generated weekly intelligence briefs.

Given source artifacts (sector summary, movement narratives, activity narratives) and a generated brief, determine whether the brief is grounded in the artifacts.

Classify as:
- "validated": The brief accurately synthesizes the source artifacts. All claims are supported.
- "weak": The brief is mostly accurate but overstates patterns or draws speculative conclusions not directly supported by artifacts.
- "hallucinated": The brief makes specific claims about competitors, movements, or implications that are not present in the source artifacts.

Return ONLY: { "status": "validated"|"weak"|"hallucinated", "reason": "one sentence" }`;

export async function validateBrief(
  openaiKey: string,
  briefContent: Record<string, unknown>,
  sectorSummary: string | null,
  movements: Array<{ competitor_name: string; movement_type: string; movement_summary: string; strategic_implication: string | null }>,
  activity: Array<{ competitor_name: string; narrative: string; signal_count: number }>
): Promise<BriefValidationResult> {
  // Build source artifact summary
  const lines: string[] = [];

  if (sectorSummary) {
    lines.push("SECTOR INTELLIGENCE:");
    lines.push(sectorSummary);
    lines.push("");
  }

  if (movements.length > 0) {
    lines.push("STRATEGIC MOVEMENTS:");
    for (const m of movements) {
      lines.push(`- ${m.competitor_name}: ${m.movement_type}`);
      lines.push(`  Summary: ${m.movement_summary}`);
      if (m.strategic_implication) {
        lines.push(`  Implication: ${m.strategic_implication}`);
      }
    }
    lines.push("");
  }

  if (activity.length > 0) {
    lines.push("COMPETITOR ACTIVITY:");
    for (const a of activity) {
      lines.push(`- ${a.competitor_name} (${a.signal_count} signals): ${a.narrative}`);
    }
    lines.push("");
  }

  const artifactsText = lines.join("\n");

  // Build brief text from BriefContent
  const briefLines: string[] = [];
  const bc = briefContent as {
    headline?: string;
    major_moves?: Array<{ competitor: string; move: string; severity: string }>;
    strategic_implications?: Array<{ theme: string; implication: string }>;
    recommended_actions?: Array<{ action: string; priority: string }>;
    closing_insight?: string;
  };

  if (bc.headline) briefLines.push(`HEADLINE: ${bc.headline}`);
  if (bc.major_moves && bc.major_moves.length > 0) {
    briefLines.push("MAJOR MOVES:");
    for (const m of bc.major_moves) {
      briefLines.push(`- ${m.competitor}: ${m.move} [${m.severity}]`);
    }
  }
  if (bc.strategic_implications && bc.strategic_implications.length > 0) {
    briefLines.push("IMPLICATIONS:");
    for (const i of bc.strategic_implications) {
      briefLines.push(`- ${i.theme}: ${i.implication}`);
    }
  }
  if (bc.recommended_actions && bc.recommended_actions.length > 0) {
    briefLines.push("ACTIONS:");
    for (const a of bc.recommended_actions) {
      briefLines.push(`- [${a.priority}] ${a.action}`);
    }
  }
  if (bc.closing_insight) briefLines.push(`INSIGHT: ${bc.closing_insight}`);

  const briefText = briefLines.join("\n");

  // Call GPT-4o-mini for validation
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: 150,
      messages: [
        { role: "system", content: BASE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `SOURCE ARTIFACTS:\n${artifactsText}\n\nGENERATED BRIEF:\n${briefText}\n\nClassify this brief.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content?.trim() ?? "{}";
  const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned) as { status?: string; reason?: string };

  const status = (parsed.status ?? "weak") as "validated" | "weak" | "hallucinated";
  const reason = parsed.reason ?? "No reasoning provided";

  return {
    validation_status: status,
    validation_reasoning: reason,
  };
}
