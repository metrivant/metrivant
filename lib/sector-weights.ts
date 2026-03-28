/**
 * Sector Weights for Runtime Pipeline
 *
 * AUTO-GENERATED from radar-ui/lib/sector-config.ts
 * DO NOT EDIT MANUALLY - Run: npx tsx scripts/generate-sector-weights.ts
 *
 * Generated: 2026-03-28T09:17:49.645Z
 */

export type SectorId = "saas" | "fintech" | "cybersecurity" | "defense" | "energy" | "custom";
export type PoolType = "newsroom" | "careers" | "investor" | "product" | "procurement" | "regulatory" | "media";

/**
 * Get signal severity multiplier for a given sector and signal type.
 * Returns 1.0 if signal type not configured for sector (neutral weight).
 */
export function getSectorSignalWeight(sector: SectorId | null, signalType: string): number {
  if (!sector || sector === "custom") return 1.0;

  const weights: Partial<Record<SectorId, Record<string, number>>> = {
  "saas": {
    "major_release": 2.2,
    "feature_launch": 2,
    "integration_release": 1.9,
    "api_change": 1.7,
    "feature_update": 1.5,
    "security_update": 1.4,
    "product_update": 1.3,
    "deprecation": 1.6,
    "price_point_change": 1.8,
    "tier_change": 1.6,
    "positioning_shift": 1.5,
    "content_change": 1.2,
    "hiring_spike": 1.2,
    "new_function": 1.1,
    "new_region": 1,
    "role_cluster": 1.1,
    "capital_raise": 1.4,
    "acquisition": 1.3,
    "earnings_release": 1.2,
    "partnership": 1.2,
    "feed_press_release": 1.2,
    "feed_newsroom_post": 1.1
  },
  "fintech": {
    "regulatory_investigation": 2.5,
    "regulatory_event": 2,
    "compliance_event": 1.8,
    "material_event": 1.7,
    "risk_disclosure": 1.6,
    "financial_disclosure": 1.5,
    "acquisition": 1.8,
    "capital_raise": 1.7,
    "earnings_release": 1.6,
    "major_contract": 1.5,
    "strategic_investment": 1.4,
    "partnership": 1.3,
    "security_update": 1.3,
    "product_update": 1,
    "major_release": 1.2,
    "price_point_change": 1.2,
    "feature_launch": 1,
    "tier_change": 1.1,
    "hiring_spike": 0.8,
    "new_function": 0.7,
    "new_region": 0.7
  },
  "cybersecurity": {
    "feature_launch": 2.3,
    "major_release": 2.2,
    "product_update": 2,
    "integration_release": 1.8,
    "api_change": 1.6,
    "regulatory_event": 2,
    "compliance_event": 1.9,
    "product_approval": 1.8,
    "regulatory_investigation": 1.6,
    "acquisition": 1.7,
    "earnings_release": 1.5,
    "guidance_update": 1.4,
    "major_contract_award": 1.5,
    "major_contract": 1.4,
    "hiring_spike": 1.4,
    "new_function": 1.2,
    "role_cluster": 1.1,
    "feed_press_release": 1.6,
    "feed_newsroom_post": 1.4,
    "price_point_change": 1.5,
    "positioning_shift": 1.2
  },
  "defense": {
    "major_contract_award": 2.5,
    "major_contract": 2.5,
    "framework_award": 2.3,
    "program_award": 2.2,
    "contract_extension": 2,
    "tender_selection": 1.9,
    "supplier_selection": 1.7,
    "acquisition": 2,
    "earnings_release": 1.8,
    "major_contract_disclosure": 1.7,
    "divestiture": 1.6,
    "guidance_update": 1.5,
    "regulatory_event": 1.8,
    "material_event": 1.6,
    "executive_change": 1.4,
    "product_update": 1,
    "hiring_spike": 1.2,
    "new_region": 1.1,
    "new_function": 1
  },
  "energy": {
    "earnings_release": 2.2,
    "guidance_update": 2,
    "acquisition": 1.9,
    "divestiture": 1.7,
    "major_contract_disclosure": 1.6,
    "material_event": 1.5,
    "regulatory_event": 1.8,
    "compliance_event": 1.6,
    "regulatory_investigation": 1.5,
    "major_contract_award": 2,
    "major_contract": 1.9,
    "framework_award": 1.7,
    "program_award": 1.6,
    "product_update": 1.3,
    "major_release": 1.2,
    "feed_press_release": 1.4,
    "feed_newsroom_post": 1.2,
    "hiring_spike": 1.1,
    "new_region": 1.2,
    "new_function": 1,
    "price_point_change": 1.3,
    "positioning_shift": 1
  }
};

  return weights[sector]?.[signalType] ?? 1.0;
}

/**
 * Get pool weight multiplier for a given sector and pool type.
 * Used for ambient activity pressure contribution.
 * Returns 1.0 if pool not configured for sector.
 */
export function getSectorPoolWeight(sector: SectorId | null, poolType: PoolType): number {
  if (!sector || sector === "custom") return 1.0;

  const weights: Partial<Record<SectorId, Record<PoolType, number>>> = {
  "saas": {
    "product": 8,
    "newsroom": 4,
    "careers": 3,
    "investor": 2.5,
    "regulatory": 1.5,
    "media": 1.5,
    "procurement": 1.3
  },
  "fintech": {
    "regulatory": 8,
    "investor": 5,
    "product": 3,
    "newsroom": 2.5,
    "careers": 2,
    "procurement": 1.5,
    "media": 1.3
  },
  "cybersecurity": {
    "product": 8,
    "newsroom": 6,
    "regulatory": 5,
    "investor": 3,
    "careers": 2.5,
    "procurement": 2,
    "media": 1.5
  },
  "defense": {
    "procurement": 8,
    "newsroom": 5,
    "regulatory": 4,
    "investor": 3,
    "careers": 2,
    "product": 1.5,
    "media": 1.3
  },
  "energy": {
    "investor": 8,
    "regulatory": 6,
    "newsroom": 4,
    "procurement": 3,
    "careers": 2,
    "product": 1.5,
    "media": 1.3
  }
};

  return weights[sector]?.[poolType] ?? 1.0;
}

/**
 * Get confidence bonus for a given sector and signal type.
 * Added to base confidence score in detect-signals.
 * Returns 0.0 if signal type not configured for sector.
 */
export function getSectorConfidenceBonus(sector: SectorId | null, signalType: string): number {
  if (!sector || sector === "custom") return 0.0;

  const bonuses: Partial<Record<SectorId, Record<string, number>>> = {
  "saas": {
    "major_release": 0.1,
    "price_point_change": 0.1,
    "feature_launch": 0.08,
    "tier_change": 0.08,
    "integration_release": 0.08,
    "api_change": 0.07
  },
  "fintech": {
    "regulatory_investigation": 0.1,
    "regulatory_event": 0.1,
    "earnings_release": 0.08,
    "acquisition": 0.08,
    "material_event": 0.08,
    "security_update": 0.07
  },
  "cybersecurity": {
    "feature_launch": 0.1,
    "regulatory_event": 0.1,
    "product_update": 0.1,
    "acquisition": 0.08
  },
  "defense": {
    "major_contract_award": 0.1,
    "framework_award": 0.1,
    "acquisition": 0.08,
    "regulatory_event": 0.08,
    "program_award": 0.08
  },
  "energy": {
    "earnings_release": 0.1,
    "major_contract_award": 0.1,
    "regulatory_event": 0.1,
    "guidance_update": 0.08,
    "acquisition": 0.08
  }
};

  return bonuses[sector]?.[signalType] ?? 0.0;
}
