// Deterministic procurement event classification.
//
// Classification is keyword-based on title + summary.
// Rules evaluated in priority order — first match wins.
// More-specific keywords (program_award, framework_award) before general ones.
//
// Value-aware weighting: if contract_value is available, large-value awards
// receive a confidence boost regardless of event type.
//
// Canonical procurement event types:
//   major_contract_award | framework_award | tender_selection | bid_notice |
//   program_award | supplier_selection | contract_extension |
//   partner_award | other_procurement_event

export type ProcurementEventType =
  | "major_contract_award"
  | "framework_award"
  | "tender_selection"
  | "bid_notice"
  | "program_award"
  | "supplier_selection"
  | "contract_extension"
  | "partner_award"
  | "other_procurement_event";

export type ProcurementSignificanceTier = "high" | "medium" | "low" | "other";

export interface ProcurementClassificationResult {
  procurementEventType: ProcurementEventType;
  significanceTier:     ProcurementSignificanceTier;
  confidence:           number;
}

// High-value event types: use the 120-hour investor cross-pool dedup window.
export const HIGH_VALUE_PROCUREMENT_TYPES = new Set<ProcurementEventType>([
  "major_contract_award",
  "program_award",
  "framework_award",
]);

const TIER_BY_TYPE: Record<ProcurementEventType, ProcurementSignificanceTier> = {
  major_contract_award:     "high",
  program_award:            "high",
  framework_award:          "medium",   // upgraded to high if large value
  tender_selection:         "medium",
  supplier_selection:       "medium",
  contract_extension:       "medium",
  bid_notice:               "low",
  partner_award:            "low",
  other_procurement_event:  "other",
};

// Base confidence values per tier (all above 0.65 CONFIDENCE_INTERPRET gate)
const TIER_CONFIDENCE: Record<ProcurementSignificanceTier, number> = {
  high:   0.85,
  medium: 0.78,
  low:    0.72,
  other:  0.70,
};

// Large-value boost: when contract_value is present and above threshold.
// USD-denominated threshold; applies regardless of reported currency
// since cross-currency comparison is out of scope for this build.
const LARGE_VALUE_THRESHOLD  = 50_000_000;  // $50M — high boost
const MEDIUM_VALUE_THRESHOLD =  5_000_000;  // $5M  — medium boost
const LARGE_VALUE_CONFIDENCE_BOOST  = 0.03;
const MEDIUM_VALUE_CONFIDENCE_BOOST = 0.01;

// ── Keyword classification rules ──────────────────────────────────────────────
// Evaluated in order — most-specific patterns first.

const RULES: Array<{ type: ProcurementEventType; keywords: string[] }> = [
  {
    type: "program_award",
    keywords: [
      "program award", "phase award", "task order", "delivery order",
      "task and delivery order", "indefinite delivery", "idiq",
      "other transaction authority", "ota award", "ota contract",
    ],
  },
  {
    type: "framework_award",
    keywords: [
      "framework agreement", "framework award", "approved supplier",
      "approved supplier list", "panel appointment", "dynamic purchasing",
      "blanket purchase agreement", "bpa ", "government wide acquisition",
      "gwac", "multiple award schedule", "mas ", "schedule contract",
    ],
  },
  {
    type: "tender_selection",
    keywords: [
      "preferred bidder", "selected bidder", "downselect", "down-select",
      "shortlisted", "shortlist", "sole source selection", "competitive selection",
    ],
  },
  {
    type: "bid_notice",
    keywords: [
      "request for proposal", "rfp ", " rfp", "request for information", "rfi ",
      "tender notice", "solicitation", "invitation to bid", "itb ",
      "invitation to tender", "itt ", "advance notice", "sources sought",
      "pre-solicitation", "request for quotation", "rfq ",
    ],
  },
  {
    type: "contract_extension",
    keywords: [
      "option exercised", "options exercised", "contract extension",
      "extended contract", "renewed contract", "renewal of",
      "contract modified", "modification exercised",
    ],
  },
  {
    type: "partner_award",
    keywords: [
      "subcontract award", "subcontract", "teaming agreement",
      "partner selected", "consortium award", "prime subcontractor",
      "joint bid",
    ],
  },
  {
    type: "supplier_selection",
    keywords: [
      "chosen supplier", "selected vendor", "awarded supplier",
      "designated supplier", "preferred supplier", "approved vendor",
      "vendor of record",
    ],
  },
  {
    type: "major_contract_award",
    keywords: [
      "contract award", "awarded contract", "wins contract", "contract win",
      "awarded to", "selected for", "receives contract", "awarded a contract",
      "award of contract", "contract valued", "contract worth",
      "awarded $", "contract for $",
    ],
  },
];

// Revenue scale pattern: "$5M", "$1.2B", "$500 million", "$2 billion", "£50M"
const REVENUE_SCALE_RE = /(?:\$|£|€|AUD|CAD)\s*\d+(?:\.\d+)?\s*(?:m|b|million|billion|mn|bn)\b/i;

export function classifyProcurementEvent(
  title:         string,
  summary:       string | null | undefined,
  contractValue: number | null | undefined
): ProcurementClassificationResult {
  const text = `${title} ${summary ?? ""}`.toLowerCase();

  let eventType: ProcurementEventType = "other_procurement_event";

  // Keyword matching
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        eventType = rule.type;
        break;
      }
    }
    if (eventType !== "other_procurement_event") break;
  }

  // Revenue-scale marker in text with no other keyword → major_contract_award
  if (eventType === "other_procurement_event" && REVENUE_SCALE_RE.test(`${title} ${summary ?? ""}`)) {
    eventType = "major_contract_award";
  }

  let tier = TIER_BY_TYPE[eventType];

  // Value-aware tier upgrade: large-value framework_award → high significance
  if (eventType === "framework_award" && contractValue && contractValue >= LARGE_VALUE_THRESHOLD) {
    tier = "high";
  }

  // Base confidence
  let confidence = TIER_CONFIDENCE[tier];

  // Value-aware confidence boost
  if (contractValue) {
    if (contractValue >= LARGE_VALUE_THRESHOLD) {
      confidence = Math.min(0.95, confidence + LARGE_VALUE_CONFIDENCE_BOOST);
    } else if (contractValue >= MEDIUM_VALUE_THRESHOLD) {
      confidence = Math.min(0.95, confidence + MEDIUM_VALUE_CONFIDENCE_BOOST);
    }
  }

  return { procurementEventType: eventType, significanceTier: tier, confidence };
}
