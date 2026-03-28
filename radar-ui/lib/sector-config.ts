// ── Comprehensive Sector Configuration ───────────────────────────────────────
//
// This file defines sector-specific intelligence weightings, thresholds, and
// behavior across all Metrivant systems. Sector configuration affects:
//   - Pool weighting in pressure_index calculation
//   - Signal severity multipliers
//   - Confidence bonuses
//   - Pattern detection thresholds
//   - Onboarding templates
//   - Terminology (via lib/sectors.ts)
//
// Principle: The pipeline remains deterministic. Sector config changes *how*
// evidence is weighted, not *what* evidence is collected.

import type { CatalogCategory } from "./catalog";
import { SECTOR_CONFIGS, translateMovementType, translateSignalType } from "./sectors";

// ── Core Types ────────────────────────────────────────────────────────────────

export type SectorId =
  | "saas"
  | "fintech"
  | "cybersecurity"
  | "defense"
  | "energy"
  | "healthcare"
  | "ecommerce"
  | "enterprise"
  | "custom";

export type PoolType =
  | "newsroom"      // Pool 1
  | "careers"       // Pool 2
  | "investor"      // Pool 3
  | "product"       // Pool 4
  | "procurement"   // Pool 5
  | "regulatory"    // Pool 6
  | "media";        // Pool 7

export type SignalType =
  // Page diff signals
  | "price_point_change"
  | "tier_change"
  | "feature_launch"
  | "positioning_shift"
  | "content_change"
  | "hiring_surge"
  // Pool signals
  | "hiring_spike"
  | "new_function"
  | "new_region"
  | "role_cluster"
  | "earnings_release"
  | "acquisition"
  | "major_contract"
  | "product_update"
  | "regulatory_event";

// ── Sector Configuration Interface ────────────────────────────────────────────

export interface ComprehensiveSectorConfig {
  id: SectorId;
  label: string;
  description: string;

  // Pool weighting (multipliers for pressure_index calculation)
  poolWeights: Record<PoolType, number>;

  // Signal severity multipliers (applied to base severity weight)
  signalWeights: Partial<Record<SignalType, number>>;

  // Confidence bonuses (added to base confidence score)
  confidenceBonuses: Partial<Record<SignalType, number>>;

  // Pattern detection thresholds
  patternThresholds: {
    hiringVelocity: number;      // roles/week to trigger hiring_spike
    signalDensity: number;       // signals/7d to trigger pattern detection
    anomalyMultiplier: number;   // sector baseline multiplier for anomaly detection
  };

  // Onboarding templates
  onboarding: {
    defaultPages: string[];      // page types to monitor by default
    priorityPoolUrls: Partial<Record<PoolType, string>>;  // feed URLs to seed
  };

  // Catalog categories (from lib/catalog.ts)
  catalogCategories: CatalogCategory[];
}

// ── Fintech Configuration ─────────────────────────────────────────────────────

const FINTECH_CONFIG: ComprehensiveSectorConfig = {
  id: "fintech",
  label: "Fintech",
  description: "Financial services, banking, payments, and compliance-heavy markets",

  poolWeights: {
    regulatory: 10.0,   // SEC, FINRA, compliance events are critical
    investor: 5.0,      // Capital raises and earnings matter
    product: 3.0,       // Product updates moderate importance
    newsroom: 2.5,      // Standard newswire visibility
    careers: 2.0,       // Hiring matters but less than compliance
    procurement: 1.5,   // Government contracts less common
    media: 1.0,         // Sector narratives baseline
  },

  signalWeights: {
    regulatory_event: 2.0,      // Double weight for regulatory signals
    acquisition: 1.8,           // M&A activity highly significant
    major_contract: 1.5,        // Contract wins matter
    earnings_release: 1.3,      // Financial disclosure important
    product_update: 1.0,        // Product changes standard weight
    hiring_spike: 0.8,          // Hiring less critical than compliance
  },

  confidenceBonuses: {
    regulatory_event: 0.15,     // High confidence in regulatory filings
    earnings_release: 0.12,     // SEC filings are authoritative
    acquisition: 0.10,          // M&A disclosures well-documented
  },

  patternThresholds: {
    hiringVelocity: 5,          // 5 roles/week = hiring_spike
    signalDensity: 3,           // 3 signals/7d = pattern
    anomalyMultiplier: 2.5,     // 2.5x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "pricing",
      "investor-relations",
      "compliance",
      "security",
      "newsroom",
      "careers",
    ],
    priorityPoolUrls: {
      regulatory: "https://www.sec.gov/cgi-bin/browse-edgar",
      investor: "https://www.bloomberg.com/",
      newsroom: "https://www.prnewswire.com/news-releases/financial-services-and-banking",
    },
  },

  catalogCategories: [],  // Fintech uses dedicated catalog from lib/sector-catalog.ts
};

// ── SaaS Configuration ────────────────────────────────────────────────────────

const SAAS_CONFIG: ComprehensiveSectorConfig = {
  id: "saas",
  label: "Software & AI",
  description: "Software, AI models, developer tools, and B2B platforms",

  poolWeights: {
    product: 10.0,      // Product releases and features are critical
    newsroom: 4.0,      // Product announcements matter
    careers: 3.0,       // Hiring signals growth
    investor: 2.5,      // Funding rounds moderate importance
    regulatory: 1.5,    // Compliance less critical than fintech
    procurement: 1.0,   // Government contracts uncommon
    media: 1.5,         // Sector narratives valuable
  },

  signalWeights: {
    feature_launch: 2.0,        // Feature velocity is primary signal
    price_point_change: 1.8,    // Pricing changes highly significant
    tier_change: 1.6,           // Tier repositioning matters
    positioning_shift: 1.5,     // Messaging shifts important
    product_update: 1.4,        // Regular updates expected
    hiring_spike: 1.2,          // Hiring signals scale
  },

  confidenceBonuses: {
    feature_launch: 0.12,       // Changelog evidence is clear
    price_point_change: 0.15,   // Pricing pages are authoritative
    tier_change: 0.10,          // Tier changes well-documented
  },

  patternThresholds: {
    hiringVelocity: 20,         // 20 roles/week = hiring_spike
    signalDensity: 5,           // 5 signals/7d = pattern
    anomalyMultiplier: 2.0,     // 2x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "pricing",
      "features",
      "changelog",
      "integrations",
      "blog",
      "newsroom",
      "careers",
    ],
    priorityPoolUrls: {
      product: "https://github.com/",  // Placeholder for repo tracking
      newsroom: "https://techcrunch.com/category/saas/",
      careers: "https://www.greenhouse.io/",
    },
  },

  catalogCategories: SECTOR_CONFIGS.saas?.catalogCategories ?? [],
};

// ── Defense Configuration ─────────────────────────────────────────────────────

const DEFENSE_CONFIG: ComprehensiveSectorConfig = {
  id: "defense",
  label: "Defense & Aerospace",
  description: "Defense contractors, aerospace, and government suppliers",

  poolWeights: {
    procurement: 10.0,  // Government contracts are critical
    newsroom: 5.0,      // Program announcements matter
    regulatory: 4.0,    // Compliance and disclosures important
    investor: 3.0,      // Earnings and guidance matter
    careers: 2.0,       // Hiring less visible than contracts
    product: 1.5,       // Capability updates moderate
    media: 1.0,         // Sector narratives baseline
  },

  signalWeights: {
    major_contract: 2.5,        // Contract awards are primary signal
    acquisition: 2.0,           // M&A highly significant
    regulatory_event: 1.8,      // Compliance events matter
    earnings_release: 1.5,      // Financial disclosure important
    hiring_spike: 1.2,          // Security clearance hiring visible
    product_update: 1.0,        // Capability announcements standard
  },

  confidenceBonuses: {
    major_contract: 0.20,       // Contract awards are public record
    acquisition: 0.15,          // M&A heavily documented
    regulatory_event: 0.12,     // Filings authoritative
  },

  patternThresholds: {
    hiringVelocity: 8,          // 8 roles/week = hiring_spike
    signalDensity: 3,           // 3 signals/7d = pattern
    anomalyMultiplier: 3.0,     // 3x sector baseline = anomaly (slower sector)
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "capabilities",
      "programs",
      "contracts",
      "investor-relations",
      "news",
      "careers",
    ],
    priorityPoolUrls: {
      procurement: "https://sam.gov/",
      regulatory: "https://www.sec.gov/cgi-bin/browse-edgar",
      newsroom: "https://www.defensenews.com/",
    },
  },

  catalogCategories: SECTOR_CONFIGS.defense?.catalogCategories ?? [],
};

// ── Energy Configuration ──────────────────────────────────────────────────────

const ENERGY_CONFIG: ComprehensiveSectorConfig = {
  id: "energy",
  label: "Energy & Resources",
  description: "Oil, gas, renewables, and energy infrastructure",

  poolWeights: {
    investor: 8.0,      // Earnings and guidance are critical
    regulatory: 6.0,    // Environmental and safety compliance
    newsroom: 4.0,      // Project announcements matter
    procurement: 3.0,   // Government contracts moderate
    careers: 2.0,       // Hiring less visible
    product: 1.5,       // Technology updates moderate
    media: 1.0,         // Sector narratives baseline
  },

  signalWeights: {
    earnings_release: 2.0,      // Financial performance primary signal
    major_contract: 1.8,        // Project awards significant
    regulatory_event: 1.6,      // Environmental compliance important
    acquisition: 1.5,           // M&A activity matters
    product_update: 1.2,        // Technology shifts visible
    hiring_spike: 1.0,          // Hiring less critical
  },

  confidenceBonuses: {
    earnings_release: 0.15,     // Investor relations authoritative
    major_contract: 0.12,       // Project awards well-documented
    regulatory_event: 0.10,     // Compliance filings clear
  },

  patternThresholds: {
    hiringVelocity: 10,         // 10 roles/week = hiring_spike
    signalDensity: 3,           // 3 signals/7d = pattern
    anomalyMultiplier: 2.5,     // 2.5x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "projects",
      "operations",
      "investor-relations",
      "sustainability",
      "news",
      "careers",
    ],
    priorityPoolUrls: {
      investor: "https://www.sec.gov/cgi-bin/browse-edgar",
      regulatory: "https://www.epa.gov/",
      newsroom: "https://www.energyvoice.com/",
    },
  },

  catalogCategories: SECTOR_CONFIGS.energy?.catalogCategories ?? [],
};

// ── Healthcare Configuration ──────────────────────────────────────────────────

const HEALTHCARE_CONFIG: ComprehensiveSectorConfig = {
  id: "healthcare",
  label: "Healthcare",
  description: "Healthcare providers, biotech, pharma, and medical devices",

  poolWeights: {
    regulatory: 12.0,   // FDA, clinical trials are existential
    investor: 6.0,      // Funding and M&A critical
    newsroom: 4.0,      // Approval announcements matter
    product: 3.0,       // Device/drug updates important
    careers: 2.0,       // Hiring less visible than approvals
    procurement: 1.5,   // Hospital contracts moderate
    media: 1.0,         // Sector narratives baseline
  },

  signalWeights: {
    regulatory_event: 3.0,      // FDA approvals are primary signal
    acquisition: 2.0,           // M&A highly significant
    earnings_release: 1.8,      // Financial performance matters
    product_update: 1.5,        // Device/drug launches important
    major_contract: 1.3,        // Hospital contracts visible
    hiring_spike: 1.0,          // Hiring standard weight
  },

  confidenceBonuses: {
    regulatory_event: 0.20,     // FDA filings authoritative
    acquisition: 0.15,          // M&A heavily documented
    earnings_release: 0.12,     // Investor relations clear
  },

  patternThresholds: {
    hiringVelocity: 6,          // 6 roles/week = hiring_spike
    signalDensity: 3,           // 3 signals/7d = pattern
    anomalyMultiplier: 2.8,     // 2.8x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "products",
      "clinical-trials",
      "investor-relations",
      "regulatory",
      "news",
      "careers",
    ],
    priorityPoolUrls: {
      regulatory: "https://www.fda.gov/",
      investor: "https://www.sec.gov/cgi-bin/browse-edgar",
      newsroom: "https://www.fiercebiotech.com/",
    },
  },

  catalogCategories: [],  // Healthcare uses dedicated catalog
};

// ── E-commerce Configuration ──────────────────────────────────────────────────

const ECOMMERCE_CONFIG: ComprehensiveSectorConfig = {
  id: "ecommerce",
  label: "E-commerce",
  description: "Retail, marketplaces, and direct-to-consumer brands",

  poolWeights: {
    newsroom: 8.0,      // Product launches and campaigns critical
    product: 6.0,       // Feature and catalog updates matter
    investor: 4.0,      // Funding and M&A important
    careers: 3.0,       // Hiring signals scale
    media: 2.0,         // Brand narratives matter
    regulatory: 1.5,    // Compliance less critical
    procurement: 1.0,   // Government sales rare
  },

  signalWeights: {
    feature_launch: 2.0,        // New features primary signal
    price_point_change: 1.8,    // Pricing highly visible
    positioning_shift: 1.6,     // Brand repositioning matters
    product_update: 1.5,        // Catalog changes important
    hiring_spike: 1.3,          // Hiring signals growth
    acquisition: 1.2,           // M&A moderate significance
  },

  confidenceBonuses: {
    price_point_change: 0.12,   // Pricing pages authoritative
    feature_launch: 0.10,       // Product announcements clear
    positioning_shift: 0.08,    // Messaging shifts visible
  },

  patternThresholds: {
    hiringVelocity: 15,         // 15 roles/week = hiring_spike
    signalDensity: 6,           // 6 signals/7d = pattern (high velocity)
    anomalyMultiplier: 1.8,     // 1.8x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "products",
      "pricing",
      "features",
      "blog",
      "newsroom",
      "careers",
    ],
    priorityPoolUrls: {
      newsroom: "https://www.prnewswire.com/news-releases/retail",
      product: "https://www.producthunt.com/",
      media: "https://techcrunch.com/category/e-commerce/",
    },
  },

  catalogCategories: [],  // E-commerce uses dedicated catalog
};

// ── Enterprise Configuration ──────────────────────────────────────────────────

const ENTERPRISE_CONFIG: ComprehensiveSectorConfig = {
  id: "enterprise",
  label: "Enterprise",
  description: "Large-scale enterprise software and infrastructure",

  poolWeights: {
    investor: 7.0,      // Earnings and guidance critical
    product: 6.0,       // Platform updates important
    newsroom: 5.0,      // Announcements matter
    careers: 3.0,       // Hiring signals scale
    regulatory: 2.0,    // Compliance moderate
    procurement: 2.0,   // Government contracts moderate
    media: 1.5,         // Sector narratives valuable
  },

  signalWeights: {
    feature_launch: 1.8,        // Platform updates significant
    acquisition: 1.7,           // M&A highly important
    earnings_release: 1.6,      // Financial performance matters
    major_contract: 1.5,        // Large deals visible
    price_point_change: 1.4,    // Pricing changes important
    hiring_spike: 1.3,          // Hiring signals investment
  },

  confidenceBonuses: {
    earnings_release: 0.15,     // Investor relations authoritative
    acquisition: 0.12,          // M&A well-documented
    major_contract: 0.10,       // Large deals announced
  },

  patternThresholds: {
    hiringVelocity: 25,         // 25 roles/week = hiring_spike (large orgs)
    signalDensity: 4,           // 4 signals/7d = pattern
    anomalyMultiplier: 2.2,     // 2.2x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "platform",
      "features",
      "pricing",
      "investor-relations",
      "newsroom",
      "careers",
    ],
    priorityPoolUrls: {
      investor: "https://www.sec.gov/cgi-bin/browse-edgar",
      newsroom: "https://www.prnewswire.com/news-releases/technology",
      product: "https://www.gartner.com/",
    },
  },

  catalogCategories: [],  // Enterprise uses combined catalog
};

// ── Cybersecurity Configuration ───────────────────────────────────────────────

const CYBERSECURITY_CONFIG: ComprehensiveSectorConfig = {
  id: "cybersecurity",
  label: "Cybersecurity",
  description: "Security software, threat intelligence, and compliance",

  poolWeights: {
    product: 9.0,       // Threat detection and features critical
    newsroom: 6.0,      // Vulnerability and breach announcements matter
    regulatory: 5.0,    // Compliance certifications important
    investor: 3.0,      // Funding and M&A moderate
    careers: 2.5,       // Security hiring visible
    procurement: 2.0,   // Government contracts moderate
    media: 1.5,         // Sector narratives valuable
  },

  signalWeights: {
    feature_launch: 2.2,        // Security features primary signal
    regulatory_event: 2.0,      // Compliance updates critical
    product_update: 1.8,        // Threat intelligence updates important
    acquisition: 1.6,           // M&A significant
    major_contract: 1.4,        // Enterprise deals matter
    hiring_spike: 1.3,          // Security talent hiring visible
  },

  confidenceBonuses: {
    feature_launch: 0.15,       // Security features well-documented
    regulatory_event: 0.12,     // Compliance certs authoritative
    product_update: 0.10,       // Threat intel updates clear
  },

  patternThresholds: {
    hiringVelocity: 12,         // 12 roles/week = hiring_spike
    signalDensity: 5,           // 5 signals/7d = pattern
    anomalyMultiplier: 2.3,     // 2.3x sector baseline = anomaly
  },

  onboarding: {
    defaultPages: [
      "homepage",
      "products",
      "features",
      "security",
      "compliance",
      "blog",
      "newsroom",
      "careers",
    ],
    priorityPoolUrls: {
      product: "https://nvd.nist.gov/",
      newsroom: "https://www.darkreading.com/",
      regulatory: "https://www.cisa.gov/",
    },
  },

  catalogCategories: [],  // Cybersecurity uses dedicated catalog
};

// ── Custom Configuration (User-defined) ───────────────────────────────────────

const CUSTOM_CONFIG: ComprehensiveSectorConfig = {
  id: "custom",
  label: "Custom",
  description: "User-defined sector with manual competitor selection",

  // Custom sector uses SaaS defaults
  poolWeights: SAAS_CONFIG.poolWeights,
  signalWeights: SAAS_CONFIG.signalWeights,
  confidenceBonuses: SAAS_CONFIG.confidenceBonuses,
  patternThresholds: SAAS_CONFIG.patternThresholds,
  onboarding: SAAS_CONFIG.onboarding,
  catalogCategories: [],
};

// ── Configuration Map ─────────────────────────────────────────────────────────

export const COMPREHENSIVE_SECTOR_CONFIGS: Record<SectorId, ComprehensiveSectorConfig> = {
  saas: SAAS_CONFIG,
  fintech: FINTECH_CONFIG,
  cybersecurity: CYBERSECURITY_CONFIG,
  defense: DEFENSE_CONFIG,
  energy: ENERGY_CONFIG,
  healthcare: HEALTHCARE_CONFIG,
  ecommerce: ECOMMERCE_CONFIG,
  enterprise: ENTERPRISE_CONFIG,
  custom: CUSTOM_CONFIG,
};

export const DEFAULT_SECTOR_ID: SectorId = "saas";

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get comprehensive sector configuration for a given sector string.
 * Falls back to SaaS config if sector not found.
 */
export function getSectorConfig(sector: string | null | undefined): ComprehensiveSectorConfig {
  if (sector && sector in COMPREHENSIVE_SECTOR_CONFIGS) {
    return COMPREHENSIVE_SECTOR_CONFIGS[sector as SectorId];
  }
  return COMPREHENSIVE_SECTOR_CONFIGS[DEFAULT_SECTOR_ID];
}

/**
 * Get pool weight multiplier for a given sector and pool type.
 * Used in pressure_index calculation.
 */
export function getPoolWeight(sector: string | null | undefined, poolType: PoolType): number {
  const config = getSectorConfig(sector);
  return config.poolWeights[poolType] ?? 1.0;
}

/**
 * Get signal severity multiplier for a given sector and signal type.
 * Applied to base severity weight in pressure_index calculation.
 */
export function getSignalWeight(sector: string | null | undefined, signalType: string): number {
  const config = getSectorConfig(sector);
  return config.signalWeights[signalType as SignalType] ?? 1.0;
}

/**
 * Get confidence bonus for a given sector and signal type.
 * Added to base confidence score in detect-signals.
 */
export function getConfidenceBonus(sector: string | null | undefined, signalType: string): number {
  const config = getSectorConfig(sector);
  return config.confidenceBonuses[signalType as SignalType] ?? 0.0;
}

/**
 * Get hiring velocity threshold for a given sector.
 * Roles/week required to trigger hiring_spike signal.
 */
export function getHiringVelocityThreshold(sector: string | null | undefined): number {
  const config = getSectorConfig(sector);
  return config.patternThresholds.hiringVelocity;
}

/**
 * Get signal density threshold for a given sector.
 * Signals/7d required to trigger pattern detection.
 */
export function getSignalDensityThreshold(sector: string | null | undefined): number {
  const config = getSectorConfig(sector);
  return config.patternThresholds.signalDensity;
}

/**
 * Get anomaly multiplier for a given sector.
 * Multiplier of sector baseline to trigger anomaly warning.
 */
export function getAnomalyMultiplier(sector: string | null | undefined): number {
  const config = getSectorConfig(sector);
  return config.patternThresholds.anomalyMultiplier;
}

/**
 * Get default monitored page types for a given sector.
 * Used in onboard-competitor to seed monitored_pages.
 */
export function getDefaultPages(sector: string | null | undefined): string[] {
  const config = getSectorConfig(sector);
  return config.onboarding.defaultPages;
}

/**
 * Get sector-specific pool URL suggestions for onboarding.
 * Returns partial map of pool type to example URL.
 */
export function getPriorityPoolUrls(
  sector: string | null | undefined
): Partial<Record<PoolType, string>> {
  const config = getSectorConfig(sector);
  return config.onboarding.priorityPoolUrls;
}

// ── Re-export Terminology Functions ──────────────────────────────────────────

export { translateMovementType, translateSignalType };
