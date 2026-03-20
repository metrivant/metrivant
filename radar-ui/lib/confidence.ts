// ── Confidence language calibration ───────────────────────────────────────────
//
// Maps a confidence score (0.0–1.0) to calibrated language and styling.
// Used in intelligence drawer to prefix interpretations with appropriate
// epistemic certainty language.
//
// Threshold model (aligned with detect-signals gating):
//   ≥ 0.90  → "almost certainly"   (very strong signal evidence)
//   0.75–0.89 → "likely"           (high confidence movement)
//   0.65–0.74 → "possible"         (above gate, moderate confidence)
//   0.50–0.64 → "Likely: " prefix  (legacy pending_review tier)
//   < 0.50   → "Possible indicator — " prefix

export type ConfidenceTier = "strong" | "high" | "moderate" | "low" | "weak";

export type ConfidenceLanguage = {
  tier:   ConfidenceTier;
  adverb: string;        // "almost certainly" | "likely" | "possible" | ""
  prefix: string | null; // prefix shown before interpretation text, or null for none
  color:  string;        // CSS color for tier badge
};

export function confidenceLanguage(confidence: number | null | undefined): ConfidenceLanguage {
  const c = confidence ?? 0;

  if (c >= 0.90) return {
    tier:   "strong",
    adverb: "almost certainly",
    prefix: null,
    color:  "rgba(0,180,255,0.90)",
  };

  if (c >= 0.75) return {
    tier:   "high",
    adverb: "likely",
    prefix: null,
    color:  "rgba(0,180,255,0.70)",
  };

  if (c >= 0.65) return {
    tier:   "moderate",
    adverb: "possible",
    prefix: null,
    color:  "rgba(245,158,11,0.80)",
  };

  if (c >= 0.50) return {
    tier:   "low",
    adverb: "",
    prefix: "Likely: ",
    color:  "rgba(148,163,184,0.70)",
  };

  return {
    tier:   "weak",
    adverb: "",
    prefix: "Possible indicator — ",
    color:  "rgba(100,116,139,0.60)",
  };
}

// ── Signal age color ──────────────────────────────────────────────────────────
//
// Returns a CSS color string for signal age indicator tinting.
//
//   new     (<6h)   → amber  — active, fresh intelligence
//   recent  (<24h)  → neutral — standard operating state
//   stale   (≥24h)  → blue-grey — data aging, lower urgency

export function signalAgeColor(lastSignalAt: string | null | undefined): string {
  if (!lastSignalAt) return "rgba(100,116,139,0.50)"; // no signal — blue-grey

  const ageHours = (Date.now() - new Date(lastSignalAt).getTime()) / 3_600_000;

  if (ageHours < 6)  return "#f59e0b";              // amber — new
  if (ageHours < 24) return "rgba(148,163,184,0.70)"; // neutral slate
  return "rgba(100,116,139,0.45)";                   // blue-grey — stale
}
