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
  // Newsroom feed signals
  | "feed_press_release"
  | "feed_newsroom_post"
  // Careers pool signals
  | "hiring_spike"
  | "new_function"
  | "new_region"
  | "role_cluster"
  // Investor pool signals
  | "earnings_release"
  | "acquisition"
  | "divestiture"
  | "guidance_update"
  | "major_contract"
  | "capital_raise"
  | "strategic_investment"
  | "partnership"
  | "investor_presentation"
  | "other_investor_event"
  // Product pool signals
  | "major_release"
  | "feature_update"
  | "integration_release"
  | "security_update"
  | "bugfix_release"
  | "api_change"
  | "docs_update"
  | "deprecation"
  | "other_product_event"
  | "product_update"  // Legacy alias
  // Procurement pool signals
  | "major_contract_award"
  | "framework_award"
  | "tender_selection"
  | "bid_notice"
  | "program_award"
  | "supplier_selection"
  | "contract_extension"
  | "partner_award"
  | "other_procurement_event"
  // Regulatory pool signals
  | "material_event"
  | "acquisition_disclosure"
  | "major_contract_disclosure"
  | "executive_change"
  | "regulatory_investigation"
  | "product_approval"
  | "risk_disclosure"
  | "financial_disclosure"
  | "compliance_event"
  | "other_regulatory_event"
  | "regulatory_event";  // Legacy alias

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
    regulatory: 8.0,    // SEC, FINRA, compliance events are critical (balanced from 10.0)
    investor: 5.0,      // Capital raises and earnings matter
    product: 3.0,       // Product updates moderate importance
    newsroom: 2.5,      // Standard newswire visibility
    careers: 2.0,       // Hiring matters but less than compliance
    procurement: 1.5,   // Government contracts less common
    media: 1.3,         // Sector narratives (narrowed range from 1.0)
  },

  signalWeights: {
    // Regulatory pool (critical)
    regulatory_investigation: 2.5,  // Investigations highest severity
    regulatory_event: 2.0,          // General regulatory signals
    compliance_event: 1.8,          // Compliance updates important
    material_event: 1.7,            // Material disclosures significant
    risk_disclosure: 1.6,           // Risk updates matter
    financial_disclosure: 1.5,      // Financial transparency
    // Investor pool (high)
    acquisition: 1.8,               // M&A activity highly significant
    capital_raise: 1.7,             // Funding rounds critical
    earnings_release: 1.6,          // Financial disclosure important
    major_contract: 1.5,            // Contract wins matter
    strategic_investment: 1.4,      // Investment activity visible
    partnership: 1.3,               // Strategic partnerships
    // Product pool (moderate)
    security_update: 1.3,           // Security patches important in fintech
    product_update: 1.0,            // Product changes standard weight
    major_release: 1.2,             // Major releases significant
    // Page diff signals (moderate)
    price_point_change: 1.2,        // Pricing changes visible
    feature_launch: 1.0,            // Feature updates standard
    tier_change: 1.1,               // Tier changes matter
    // Careers pool (lower priority)
    hiring_spike: 0.8,              // Hiring less critical than compliance
    new_function: 0.7,              // New departments moderate
    new_region: 0.7,                // Geographic expansion
  },

  confidenceBonuses: {
    regulatory_investigation: 0.10,  // Investigations are authoritative (capped)
    regulatory_event: 0.10,          // Regulatory filings authoritative (reduced from 0.15)
    earnings_release: 0.08,          // SEC filings clear (reduced from 0.12)
    acquisition: 0.08,               // M&A disclosures well-documented (reduced from 0.10)
    material_event: 0.08,            // Material events documented
    security_update: 0.07,           // Security updates clear
  },

  patternThresholds: {
    hiringVelocity: 5,          // 5 roles/week = hiring_spike (appropriate for fintech)
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
    product: 8.0,       // Product releases and features are critical (balanced from 10.0)
    newsroom: 4.0,      // Product announcements matter
    careers: 3.0,       // Hiring signals growth
    investor: 2.5,      // Funding rounds moderate importance
    regulatory: 1.5,    // Compliance less critical than fintech
    media: 1.5,         // Sector narratives valuable
    procurement: 1.3,   // Government contracts uncommon (narrowed from 1.0)
  },

  signalWeights: {
    // Product pool (critical)
    major_release: 2.2,         // Major releases highest priority
    feature_launch: 2.0,        // Feature velocity is primary signal
    integration_release: 1.9,   // Integrations highly significant
    api_change: 1.7,            // API changes impact customers
    feature_update: 1.5,        // Feature updates important
    security_update: 1.4,       // Security patches matter
    product_update: 1.3,        // Regular updates expected
    deprecation: 1.6,           // Deprecations significant
    // Page diff signals (high)
    price_point_change: 1.8,    // Pricing changes highly significant
    tier_change: 1.6,           // Tier repositioning matters
    positioning_shift: 1.5,     // Messaging shifts important
    content_change: 1.2,        // Content updates visible
    // Careers pool (moderate)
    hiring_spike: 1.2,          // Hiring signals scale
    new_function: 1.1,          // New departments signal growth
    new_region: 1.0,            // Geographic expansion
    role_cluster: 1.1,          // Hiring patterns meaningful
    // Investor pool (moderate)
    capital_raise: 1.4,         // Funding rounds important
    acquisition: 1.3,           // M&A activity matters
    earnings_release: 1.2,      // Public company disclosures
    partnership: 1.2,           // Strategic partnerships
    // Newsroom (moderate)
    feed_press_release: 1.2,    // Press releases visible
    feed_newsroom_post: 1.1,    // Company updates
  },

  confidenceBonuses: {
    major_release: 0.10,        // Major releases well-documented (capped)
    price_point_change: 0.10,   // Pricing pages authoritative (reduced from 0.15)
    feature_launch: 0.08,       // Changelog evidence clear (reduced from 0.12)
    tier_change: 0.08,          // Tier changes documented (reduced from 0.10)
    integration_release: 0.08,  // Integrations clear
    api_change: 0.07,           // API changes documented
  },

  patternThresholds: {
    hiringVelocity: 12,         // 12 roles/week = hiring_spike (realistic, reduced from 20)
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
    procurement: 8.0,   // Government contracts critical (balanced from 10.0)
    newsroom: 5.0,      // Program announcements matter
    regulatory: 4.0,    // Compliance and disclosures important
    investor: 3.0,      // Earnings and guidance matter
    careers: 2.0,       // Hiring less visible than contracts
    product: 1.5,       // Capability updates moderate
    media: 1.3,         // Sector narratives (narrowed from 1.0)
  },

  signalWeights: {
    // Procurement pool (critical)
    major_contract_award: 2.5,  // Contract awards highest priority
    major_contract: 2.5,        // Legacy contract signals
    framework_award: 2.3,       // Framework contracts significant
    program_award: 2.2,         // Program wins critical
    contract_extension: 2.0,    // Extensions show stability
    tender_selection: 1.9,      // Tender wins important
    supplier_selection: 1.7,    // Supply chain positioning
    // Investor pool (high)
    acquisition: 2.0,           // M&A highly significant
    earnings_release: 1.8,      // Financial disclosure important
    major_contract_disclosure: 1.7, // Contract disclosures
    divestiture: 1.6,           // Asset sales significant
    guidance_update: 1.5,       // Financial guidance matters
    // Regulatory pool (moderate-high)
    regulatory_event: 1.8,      // Compliance events matter
    material_event: 1.6,        // Material disclosures
    executive_change: 1.4,      // Leadership changes visible
    // Product pool (moderate)
    product_update: 1.0,        // Capability announcements standard
    // Careers pool (lower)
    hiring_spike: 1.2,          // Security clearance hiring visible
    new_region: 1.1,            // Geographic expansion
    new_function: 1.0,          // New capabilities
  },

  confidenceBonuses: {
    major_contract_award: 0.10,  // Contract awards public record (capped from 0.20)
    framework_award: 0.10,       // Framework contracts documented
    acquisition: 0.08,           // M&A heavily documented (reduced from 0.15)
    regulatory_event: 0.08,      // Filings authoritative (reduced from 0.12)
    program_award: 0.08,         // Program wins documented
  },

  patternThresholds: {
    hiringVelocity: 6,          // 6 roles/week = hiring_spike (reduced from 8)
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
    media: 1.3,         // Sector narratives (narrowed from 1.0)
  },

  signalWeights: {
    // Investor pool (critical)
    earnings_release: 2.2,        // Financial performance primary signal
    guidance_update: 2.0,         // Guidance critical for capital-intensive sector
    acquisition: 1.9,             // M&A activity matters
    divestiture: 1.7,             // Asset sales significant
    major_contract_disclosure: 1.6, // Project contract disclosures
    material_event: 1.5,          // Material events significant
    // Regulatory pool (high)
    regulatory_event: 1.8,        // Environmental compliance important
    compliance_event: 1.6,        // Safety and operational compliance
    regulatory_investigation: 1.5, // Investigations significant
    // Procurement pool (moderate-high)
    major_contract_award: 2.0,    // Project awards significant
    major_contract: 1.9,          // Legacy contract signals
    framework_award: 1.7,         // Framework contracts matter
    program_award: 1.6,           // Energy program awards
    // Product pool (moderate)
    product_update: 1.3,          // Technology shifts visible
    major_release: 1.2,           // Tech platform updates
    // Newsroom pool (moderate)
    feed_press_release: 1.4,      // Project announcements matter
    feed_newsroom_post: 1.2,      // Company news updates
    // Careers pool (lower)
    hiring_spike: 1.1,            // Large hiring visible
    new_region: 1.2,              // Geographic expansion matters
    new_function: 1.0,            // New capabilities
    // Page diff signals
    price_point_change: 1.3,      // Service pricing shifts
    positioning_shift: 1.0,       // Positioning changes
  },

  confidenceBonuses: {
    earnings_release: 0.10,       // Investor relations authoritative (capped from 0.15)
    major_contract_award: 0.10,   // Project awards well-documented (capped from 0.12)
    regulatory_event: 0.10,       // Compliance filings clear
    guidance_update: 0.08,        // Guidance statements documented
    acquisition: 0.08,            // M&A heavily documented
  },

  patternThresholds: {
    hiringVelocity: 8,            // 8 roles/week = hiring_spike (reduced from 10)
    signalDensity: 3,             // 3 signals/7d = pattern
    anomalyMultiplier: 2.5,       // 2.5x sector baseline = anomaly
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

// ── Cybersecurity Configuration ───────────────────────────────────────────────

const CYBERSECURITY_CONFIG: ComprehensiveSectorConfig = {
  id: "cybersecurity",
  label: "Cybersecurity",
  description: "Security software, threat intelligence, and compliance",

  poolWeights: {
    product: 8.0,       // Threat detection and features critical (balanced from 9.0)
    newsroom: 6.0,      // Vulnerability and breach announcements matter
    regulatory: 5.0,    // Compliance certifications important
    investor: 3.0,      // Funding and M&A moderate
    careers: 2.5,       // Security hiring visible
    procurement: 2.0,   // Government contracts moderate
    media: 1.5,         // Sector narratives valuable
  },

  signalWeights: {
    // Product pool (critical)
    feature_launch: 2.3,        // Security features primary signal
    major_release: 2.2,         // Platform releases significant
    product_update: 2.0,        // Threat intelligence updates important
    integration_release: 1.8,   // Security integrations matter
    api_change: 1.6,            // API security changes visible
    // Regulatory pool (high)
    regulatory_event: 2.0,      // Compliance updates critical
    compliance_event: 1.9,      // Certification updates important
    product_approval: 1.8,      // Regulatory certifications/approvals significant
    regulatory_investigation: 1.6, // Investigations matter
    // Investor pool (moderate-high)
    acquisition: 1.7,           // M&A significant in consolidating sector
    earnings_release: 1.5,      // Financial performance matters
    guidance_update: 1.4,       // Growth guidance important
    // Procurement pool (moderate)
    major_contract_award: 1.5,  // Enterprise deals matter
    major_contract: 1.4,        // Contract awards visible
    // Careers pool (moderate)
    hiring_spike: 1.4,          // Security talent hiring visible
    new_function: 1.2,          // New security capabilities
    role_cluster: 1.1,          // Security team expansion
    // Newsroom pool (moderate-high)
    feed_press_release: 1.6,    // Threat intel announcements
    feed_newsroom_post: 1.4,    // Security advisories
    // Page diff signals
    price_point_change: 1.5,    // Pricing strategy shifts
    positioning_shift: 1.2,     // Security positioning changes
  },

  confidenceBonuses: {
    feature_launch: 0.10,       // Security features well-documented (capped from 0.15)
    regulatory_event: 0.10,     // Compliance certs authoritative (capped from 0.12)
    product_update: 0.10,       // Threat intel updates clear
    acquisition: 0.08,          // M&A heavily reported
  },

  patternThresholds: {
    hiringVelocity: 10,         // 10 roles/week = hiring_spike (reduced from 12)
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
