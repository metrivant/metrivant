// Post-interpretation hallucination detection.
//
// Uses GPT-4o-mini (cheaper model) to validate whether GPT-4o's interpretation
// logically follows from the raw signal evidence.
//
// The validator sees:
//   - The raw change (old_content → new_content)
//   - The interpretation (summary, strategic_implication, recommended_action)
//
// It classifies as:
//   - valid: interpretation follows from evidence
//   - weak: interpretation is plausible but overstated or speculative
//   - hallucinated: interpretation makes claims not supported by the evidence
//
// Temperature 0.05 — we want deterministic classification, not creative judging.

import { openai } from "./openai";

const SYSTEM_PROMPT = `You are a quality assurance analyst reviewing AI-generated competitive intelligence interpretations.

Given raw evidence (previous content and current content of a webpage change) and an AI interpretation of that change, determine whether the interpretation is grounded in the evidence.

Classify as:
- "valid": The interpretation accurately describes what changed and its implications follow logically from the evidence.
- "weak": The interpretation describes the change but overstates its significance, makes speculative leaps, or draws conclusions not strongly supported by the evidence.
- "hallucinated": The interpretation makes claims that are not present in or contradicted by the evidence. The strategic implication does not follow from what actually changed.

Return ONLY a JSON object:
{
  "status": "valid" | "weak" | "hallucinated",
  "reason": "one sentence explaining your classification"
}`;

export type ValidationStatus = "valid" | "weak" | "hallucinated";

export interface ValidationResult {
  status: ValidationStatus;
  reason: string;
}

export interface InterpretationForValidation {
  old_content:            string | null;
  new_content:            string | null;
  summary:                string | null;
  strategic_implication:  string | null;
  recommended_action:     string | null;
}

/**
 * Validate a single interpretation against its evidence.
 */
export async function validateInterpretation(
  interp: InterpretationForValidation,
): Promise<ValidationResult> {
  const oldContent = (interp.old_content ?? "(no previous content)").slice(0, 800);
  const newContent = (interp.new_content ?? "(no current content)").slice(0, 800);
  const summary = interp.summary ?? "(no summary)";
  const implication = interp.strategic_implication ?? "(no implication)";
  const action = interp.recommended_action ?? "(no action)";

  // If no evidence exists, can't validate — mark as weak
  if (!interp.old_content && !interp.new_content) {
    return { status: "weak", reason: "No evidence content available for validation" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: 150,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `EVIDENCE:
Previous content: ${oldContent}
Current content: ${newContent}

INTERPRETATION:
Summary: ${summary}
Strategic implication: ${implication}
Recommended action: ${action}

Classify this interpretation.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { status?: string; reason?: string };

    const status = parsed.status as ValidationStatus;
    if (status === "valid" || status === "weak" || status === "hallucinated") {
      return { status, reason: parsed.reason ?? "" };
    }

    return { status: "weak", reason: "Validator returned unrecognized status" };
  } catch {
    return { status: "weak", reason: "Validation failed — defaulting to weak" };
  }
}
