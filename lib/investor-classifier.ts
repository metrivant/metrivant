// Deterministic investor event classification.
//
// Classifies investor feed entries by keyword matching on title + summary.
// Rules are evaluated in priority order — first match wins.
// Returns an investor_event_type and a confidence weight that adjusts signal confidence.
//
// No AI. Deterministic and expandable.
//
// Canonical investor event types:
//   earnings_release | acquisition | divestiture | guidance_update |
//   major_contract   | capital_raise | strategic_investment | partnership |
//   investor_presentation | other_investor_event

export type InvestorEventType =
  | "earnings_release"
  | "acquisition"
  | "divestiture"
  | "guidance_update"
  | "major_contract"
  | "capital_raise"
  | "strategic_investment"
  | "partnership"
  | "investor_presentation"
  | "other_investor_event";

// Significance tiers drive signal confidence.
// High significance → 0.85, Medium → 0.80, Standard → 0.75, Other → 0.72
export type SignificanceTier = "high" | "medium" | "standard" | "other";

export interface ClassificationResult {
  investorEventType: InvestorEventType;
  significanceTier:  SignificanceTier;
  confidence:        number;
}

// Each rule: keywords to match (case-insensitive substring), event type, tier.
// Rules evaluated in order — more-specific rules first.
const RULES: Array<{ type: InvestorEventType; tier: SignificanceTier; keywords: string[] }> = [
  // ── High significance ──────────────────────────────────────────────────────
  {
    type: "acquisition",
    tier: "high",
    keywords: [
      "acquisition", "acquired", "acquires", "acquire",
      "merger", "merges", "definitive agreement", "agreement to acquire",
      "agreement to purchase", "business combination", "takeover",
    ],
  },
  {
    type: "divestiture",
    tier: "high",
    keywords: [
      "divestiture", "divests", "divest", "divestment",
      "sale of", "sells its", "disposed of", "disposal of",
      "spin-off", "spinoff", "carve-out",
    ],
  },
  {
    type: "capital_raise",
    tier: "high",
    keywords: [
      "offering", "capital raise", "raises capital",
      "debt offering", "senior notes", "notes offering",
      "equity offering", "private placement",
      "follow-on offering", "secondary offering",
      "credit facility", "revolving credit",
      "ipo", "initial public offering",
    ],
  },
  {
    type: "major_contract",
    tier: "high",
    keywords: [
      "awarded contract", "contract awarded", "wins contract", "contract win",
      "selected for", "awarded by",
      // Revenue scale markers — "$XM" or "$XB" patterns handled separately
      "billion contract", "million contract",
    ],
  },
  {
    type: "strategic_investment",
    tier: "high",
    keywords: [
      "strategic investment", "invests in", "investment in",
      "venture investment", "minority stake", "equity stake",
      "takes stake in", "equity investment", "strategic stake",
    ],
  },

  // ── Medium significance ────────────────────────────────────────────────────
  {
    type: "earnings_release",
    tier: "medium",
    keywords: [
      "earnings", "quarterly results", "financial results",
      "fiscal year results", "annual results",
      "q1 results", "q2 results", "q3 results", "q4 results",
      "first quarter", "second quarter", "third quarter", "fourth quarter",
      "full year results", "fy results", "fy20", "fy21", "fy22", "fy23", "fy24", "fy25",
      "revenue results", "reports results", "reports earnings",
      "eps", "ebitda results",
    ],
  },
  {
    type: "guidance_update",
    tier: "medium",
    keywords: [
      "guidance", "raises guidance", "lowers guidance", "reaffirms guidance",
      "updates guidance", "revises guidance", "updates outlook",
      "forecast update", "financial forecast", "outlook update",
      "raises outlook", "lowers outlook", "narrows guidance",
      "increases full-year", "decreases full-year",
    ],
  },

  // ── Standard significance ──────────────────────────────────────────────────
  {
    type: "partnership",
    tier: "standard",
    keywords: [
      "partnership", "partners with", "joint venture",
      "collaboration agreement", "strategic alliance",
      "alliance", "collaborates with", "commercial agreement",
      "reseller agreement", "distribution agreement",
      "memorandum of understanding", "mou",
    ],
  },
  {
    type: "investor_presentation",
    tier: "standard",
    keywords: [
      "investor day", "investor presentation", "analyst day",
      "investor conference", "capital markets day",
      "annual meeting", "shareholder meeting",
      "analyst presentation", "road show", "roadshow",
      "conferences and events",
    ],
  },
];

// Confidence values per significance tier
const TIER_CONFIDENCE: Record<SignificanceTier, number> = {
  high:     0.85,
  medium:   0.80,
  standard: 0.75,
  other:    0.72,
};

// Revenue scale pattern: "$5M", "$1.2B", "$500 million", "$2 billion"
const REVENUE_SCALE_RE = /\$\d+(?:\.\d+)?\s*(?:m|b|million|billion)/i;

// Classify a single investor feed entry.
// text = title + " " + (summary ?? "")
export function classifyInvestorEvent(
  title:   string,
  summary: string | null | undefined
): ClassificationResult {
  const text  = `${title} ${summary ?? ""}`.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          investorEventType: rule.type,
          significanceTier:  rule.tier,
          confidence:        TIER_CONFIDENCE[rule.tier],
        };
      }
    }
  }

  // Revenue-scale marker without any other keyword → major_contract
  if (REVENUE_SCALE_RE.test(text)) {
    return {
      investorEventType: "major_contract",
      significanceTier:  "high",
      confidence:        TIER_CONFIDENCE.high,
    };
  }

  return {
    investorEventType: "other_investor_event",
    significanceTier:  "other",
    confidence:        TIER_CONFIDENCE.other,
  };
}
