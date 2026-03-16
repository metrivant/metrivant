// Deterministic regulatory filing classification.
//
// Classification priority:
//   1. filing_type field (SEC form code): direct map — highest fidelity.
//      Only fires when the ingestion layer has already extracted a verified
//      form code from a structured feed (e.g., EDGAR Atom title).
//   2. Keyword matching on title + summary: fallback when filing_type absent.
//
// Filing whitelist:
//   Only these SEC form types are ingested. Entries with other form types
//   are dropped at ingest time and never reach the promoter.
//
// Confidence values reflect legal evidentiary weight:
//   acquisition_disclosure / major_contract_disclosure carry the highest
//   confidence because they require formal SEC disclosure at precise thresholds.
//
// Canonical regulatory event types:
//   material_event | acquisition_disclosure | major_contract_disclosure |
//   executive_change | regulatory_investigation | product_approval |
//   risk_disclosure | financial_disclosure | compliance_event |
//   other_regulatory_event

export type RegulatoryEventType =
  | "material_event"
  | "acquisition_disclosure"
  | "major_contract_disclosure"
  | "executive_change"
  | "regulatory_investigation"
  | "product_approval"
  | "risk_disclosure"
  | "financial_disclosure"
  | "compliance_event"
  | "other_regulatory_event";

export interface RegulatoryClassificationResult {
  regulatoryEventType: RegulatoryEventType;
  confidence:          number;
  classifiedBy:        "filing_type" | "keywords";
}

// ── Filing type whitelist ──────────────────────────────────────────────────────
// Only these SEC form types create pool_events. All others are dropped at ingest.

export const ALLOWED_FILING_TYPES = new Set<string>([
  "8-K",
  "10-K",
  "10-Q",
  "S-1",
  "SC 13D",
  "SC 13G",
  "DEF 14A",
]);

// ── Filing type → event type direct map ───────────────────────────────────────
// SEC form code maps unambiguously to event type. Takes precedence over keywords.

const FILING_TYPE_MAP: Partial<Record<string, RegulatoryEventType>> = {
  "8-K":     "material_event",
  "10-K":    "financial_disclosure",
  "10-Q":    "financial_disclosure",
  "S-1":     "financial_disclosure",
  "DEF 14A": "compliance_event",
  "SC 13D":  "acquisition_disclosure",
  "SC 13G":  "acquisition_disclosure",
};

// ── Confidence values per event type ──────────────────────────────────────────
// Regulatory filings are legally mandated — confidence reflects disclosure
// threshold rather than signal detection noise.

const CONFIDENCE_BY_TYPE: Record<RegulatoryEventType, number> = {
  acquisition_disclosure:    0.95,
  major_contract_disclosure: 0.92,
  material_event:            0.90,
  product_approval:          0.88,
  executive_change:          0.82,
  financial_disclosure:      0.78,
  regulatory_investigation:  0.75,
  risk_disclosure:           0.70,
  compliance_event:          0.65,
  other_regulatory_event:    0.60,
};

// ── High-value regulatory types: 120-hour cross-pool dedup window ─────────────
// These event types warrant extended dedup because the same event is likely to
// appear in both investor feeds and newsroom feeds within a 5-day window.

export const HIGH_VALUE_REGULATORY_TYPES = new Set<RegulatoryEventType>([
  "acquisition_disclosure",
  "major_contract_disclosure",
  "material_event",
  "product_approval",
]);

// ── Keyword classification rules ──────────────────────────────────────────────
// Evaluated in order — most specific patterns first.
// Used as fallback when filing_type is not available (non-EDGAR sources).

const RULES: Array<{ type: RegulatoryEventType; keywords: string[] }> = [
  {
    type: "acquisition_disclosure",
    keywords: [
      "acquisition", "merger", "purchase agreement", "business combination",
      "definitive agreement", "to be acquired", "takeover", "merger agreement",
      "going-private", "tender offer",
    ],
  },
  {
    type: "major_contract_disclosure",
    keywords: [
      "material contract", "contract award", "major contract",
      "definitive contract", "awarded contract", "contract valued",
      "significant contract",
    ],
  },
  {
    type: "executive_change",
    keywords: [
      "appoints", "appointment of", "resignation", "resigns", "new ceo",
      "new cfo", "new cto", "new president", "named as", "stepping down",
      "departure of", "principal executive", "chief executive officer",
      "chief financial officer", "board of directors",
    ],
  },
  {
    type: "product_approval",
    keywords: [
      "fda approval", "fda cleared", "fda granted", "510(k)",
      "premarket approval", "pma approved", "market authorization",
      "regulatory clearance", "certification received", "approved by",
      "breakthrough designation", "fast track designation",
    ],
  },
  {
    type: "regulatory_investigation",
    keywords: [
      "investigation", "sec investigation", "doj investigation",
      "enforcement action", "subpoena", "civil investigative demand",
      "grand jury", "formal order of investigation", "under inquiry",
      "regulatory inquiry", "ftc investigation",
    ],
  },
  {
    type: "risk_disclosure",
    keywords: [
      "material weakness", "going concern", "restatement",
      "audit committee", "adverse opinion", "impairment charge",
      "risk factor", "significant risk", "internal control",
    ],
  },
  {
    type: "financial_disclosure",
    keywords: [
      "quarterly results", "annual results", "earnings", "revenue",
      "financial results", "quarterly report", "annual report",
      "fiscal year", "guidance update", "preliminary results",
      "fourth quarter", "first quarter", "second quarter", "third quarter",
    ],
  },
  {
    type: "compliance_event",
    keywords: [
      "proxy statement", "annual meeting", "shareholder vote",
      "board nomination", "executive compensation", "say-on-pay",
      "director election", "definitive proxy", "record date",
    ],
  },
  {
    type: "material_event",
    keywords: [
      "material event", "material development", "current report",
      "material agreement", "entry into", "amendment to",
      "material definitive", "unregistered sales",
    ],
  },
];

// ── Filing type extraction from EDGAR Atom entry title ────────────────────────
// EDGAR Atom titles follow the pattern "{FORM_TYPE}" or "{FORM_TYPE} - {description}".
// Amended forms (e.g., "8-K/A", "SC 13D/A") are normalized to the base type.
// Returns null when no whitelisted form type is found.

export function extractFilingType(title: string): string | null {
  const normalized = title.trim().toUpperCase().replace(/\/A\b/, "");

  for (const ft of ALLOWED_FILING_TYPES) {
    // Escape special regex characters in the form type (handles "SC 13D", "DEF 14A")
    const escaped = ft.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    // Match at start of string or preceded by whitespace — not embedded in a word
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|[-–]|$)`);
    if (re.test(normalized)) return ft;
  }

  return null;
}

// ── Main classification function ───────────────────────────────────────────────

export function classifyRegulatoryEvent(
  title:       string,
  summary:     string | null | undefined,
  filingType?: string | null
): RegulatoryClassificationResult {

  // ── Priority 1: Direct filing type map ──────────────────────────────────────
  if (filingType) {
    const mapped = FILING_TYPE_MAP[filingType];
    if (mapped) {
      return {
        regulatoryEventType: mapped,
        confidence:          CONFIDENCE_BY_TYPE[mapped],
        classifiedBy:        "filing_type",
      };
    }
  }

  // ── Priority 2: Keyword matching on title + summary ─────────────────────────
  const text = `${title} ${summary ?? ""}`.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          regulatoryEventType: rule.type,
          confidence:          CONFIDENCE_BY_TYPE[rule.type],
          classifiedBy:        "keywords",
        };
      }
    }
  }

  return {
    regulatoryEventType: "other_regulatory_event",
    confidence:          CONFIDENCE_BY_TYPE["other_regulatory_event"],
    classifiedBy:        "keywords",
  };
}
