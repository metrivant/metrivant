/**
 * Sector Weights for Runtime Pipeline
 *
 * Provides sector-specific multipliers for pressure index and confidence calculations.
 * Mirrors configuration from radar-ui/lib/sector-config.ts but optimized for runtime use.
 */

export type SectorId = "saas" | "fintech" | "cybersecurity" | "defense" | "energy" | "custom";
export type PoolType = "newsroom" | "careers" | "investor" | "product" | "procurement" | "regulatory" | "media";

/**
 * Get signal severity multiplier for a given sector and signal type.
 * Returns 1.0 if signal type not configured for sector (neutral weight).
 */
export function getSectorSignalWeight(sector: SectorId | null, signalType: string): number {
  if (!sector || sector === "custom") return 1.0;

  const weights: Record<SectorId, Record<string, number>> = {
    fintech: {
      regulatory_investigation: 2.5,
      regulatory_event: 2.0,
      compliance_event: 1.8,
      material_event: 1.7,
      risk_disclosure: 1.6,
      financial_disclosure: 1.5,
      earnings_release: 2.0,
      acquisition: 1.8,
      guidance_update: 1.6,
      capital_raise: 1.5,
      strategic_investment: 1.4,
      product_update: 1.3,
      major_release: 1.2,
      feed_press_release: 1.4,
      feed_newsroom_post: 1.2,
      hiring_spike: 1.3,
      new_function: 1.1,
      price_point_change: 1.4,
      positioning_shift: 1.2,
    },
    saas: {
      major_release: 2.2,
      feature_launch: 2.0,
      integration_release: 1.9,
      api_change: 1.7,
      product_update: 1.6,
      price_point_change: 2.0,
      tier_change: 1.8,
      positioning_shift: 1.5,
      feed_press_release: 1.6,
      feed_newsroom_post: 1.3,
      hiring_spike: 1.4,
      new_function: 1.2,
      role_cluster: 1.1,
      earnings_release: 1.5,
      acquisition: 1.6,
      guidance_update: 1.3,
    },
    defense: {
      major_contract_award: 2.5,
      major_contract: 2.5,
      framework_award: 2.3,
      program_award: 2.2,
      contract_extension: 2.0,
      tender_selection: 1.9,
      supplier_selection: 1.7,
      acquisition: 2.0,
      earnings_release: 1.8,
      major_contract_disclosure: 1.7,
      divestiture: 1.6,
      guidance_update: 1.5,
      regulatory_event: 1.8,
      material_event: 1.6,
      executive_change: 1.4,
      product_update: 1.0,
      hiring_spike: 1.2,
      new_region: 1.1,
      new_function: 1.0,
    },
    energy: {
      earnings_release: 2.2,
      guidance_update: 2.0,
      acquisition: 1.9,
      divestiture: 1.7,
      major_contract_disclosure: 1.6,
      material_event: 1.5,
      regulatory_event: 1.8,
      compliance_event: 1.6,
      regulatory_investigation: 1.5,
      major_contract_award: 2.0,
      major_contract: 1.9,
      framework_award: 1.7,
      program_award: 1.6,
      product_update: 1.3,
      major_release: 1.2,
      feed_press_release: 1.4,
      feed_newsroom_post: 1.2,
      hiring_spike: 1.1,
      new_region: 1.2,
      new_function: 1.0,
      price_point_change: 1.3,
      positioning_shift: 1.0,
    },
    cybersecurity: {
      feature_launch: 2.3,
      major_release: 2.2,
      product_update: 2.0,
      integration_release: 1.8,
      api_change: 1.6,
      regulatory_event: 2.0,
      compliance_event: 1.9,
      product_approval: 1.8,
      regulatory_investigation: 1.6,
      acquisition: 1.7,
      earnings_release: 1.5,
      guidance_update: 1.4,
      major_contract_award: 1.5,
      major_contract: 1.4,
      hiring_spike: 1.4,
      new_function: 1.2,
      role_cluster: 1.1,
      feed_press_release: 1.6,
      feed_newsroom_post: 1.4,
      price_point_change: 1.5,
      positioning_shift: 1.2,
    },
    custom: {},
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

  const weights: Record<SectorId, Record<PoolType, number>> = {
    fintech: {
      regulatory: 8.0,
      investor: 5.0,
      product: 3.0,
      newsroom: 2.5,
      careers: 2.0,
      procurement: 1.5,
      media: 1.3,
    },
    saas: {
      product: 8.0,
      newsroom: 4.0,
      careers: 3.0,
      investor: 2.5,
      regulatory: 1.5,
      media: 1.5,
      procurement: 1.3,
    },
    defense: {
      procurement: 8.0,
      newsroom: 5.0,
      regulatory: 4.0,
      investor: 3.0,
      careers: 2.0,
      product: 1.5,
      media: 1.3,
    },
    energy: {
      investor: 8.0,
      regulatory: 6.0,
      newsroom: 4.0,
      procurement: 3.0,
      careers: 2.0,
      product: 1.5,
      media: 1.3,
    },
    cybersecurity: {
      product: 8.0,
      newsroom: 6.0,
      regulatory: 5.0,
      investor: 3.0,
      careers: 2.5,
      procurement: 2.0,
      media: 1.5,
    },
    custom: {
      newsroom: 1.0,
      careers: 1.0,
      investor: 1.0,
      product: 1.0,
      procurement: 1.0,
      regulatory: 1.0,
      media: 1.0,
    },
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

  const bonuses: Record<SectorId, Record<string, number>> = {
    fintech: {
      regulatory_investigation: 0.10,
      regulatory_event: 0.10,
      earnings_release: 0.08,
      acquisition: 0.08,
      compliance_event: 0.08,
    },
    saas: {
      major_release: 0.10,
      price_point_change: 0.10,
      feature_launch: 0.08,
      integration_release: 0.08,
    },
    defense: {
      major_contract_award: 0.10,
      framework_award: 0.10,
      acquisition: 0.08,
      regulatory_event: 0.08,
      program_award: 0.08,
    },
    energy: {
      earnings_release: 0.10,
      major_contract_award: 0.10,
      regulatory_event: 0.10,
      guidance_update: 0.08,
      acquisition: 0.08,
    },
    cybersecurity: {
      feature_launch: 0.10,
      regulatory_event: 0.10,
      product_update: 0.10,
      acquisition: 0.08,
    },
    custom: {},
  };

  return bonuses[sector]?.[signalType] ?? 0.0;
}
