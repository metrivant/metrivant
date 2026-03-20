// ── Sector system ─────────────────────────────────────────────────────────────
//
// Metrivant runs one unified intelligence pipeline.
// Sectors are presentation and terminology layers over canonical backend data.
// The pipeline (signals, movements, momentum) is sector-agnostic.
// Only display language, catalog curation, and visual framing change per sector.

import type { CatalogCategory } from "./catalog";

export const SECTORS = ["saas", "defense", "energy"] as const;
export type Sector = (typeof SECTORS)[number];

export interface SectorConfig {
  id: Sector;
  label: string;
  description: string;
  /** Which catalog categories belong to this sector */
  catalogCategories: CatalogCategory[];
  /** Canonical movement_type → sector-specific display label */
  movementLabels: Record<string, string>;
  /** Canonical signal_type → sector-specific display label */
  signalLabels: Record<string, string>;
  /** Canonical pattern_type → sector-specific display label */
  patternLabels: Record<string, string>;
  /** Page types most relevant to this sector (for future monitored-page emphasis) */
  pageEmphasis: string[];
}

// ── SaaS ──────────────────────────────────────────────────────────────────────

const SAAS_CONFIG: SectorConfig = {
  id: "saas",
  label: "Software & AI",
  description: "Track competitors across software, AI models, and developer tools",
  catalogCategories: [
    "project-management",
    "developer-tools",
    "analytics",
    "crm",
    "ai-tools",
    "design-tools",
  ],
  movementLabels: {
    pricing_strategy_shift: "Pricing Shift",
    product_expansion:      "Product Expansion",
    market_reposition:      "Market Reposition",
    enterprise_push:        "Enterprise Push",
    ecosystem_expansion:    "Ecosystem Expansion",
  },
  signalLabels: {
    price_point_change: "Pricing change",
    tier_change:        "Tier change",
    feature_launch:     "Feature launch",
    positioning_shift:  "Positioning shift",
    content_strategy:   "Content strategy",
    audience_targeting: "Audience targeting",
  },
  patternLabels: {
    feature_convergence:  "Feature Convergence",
    pricing_competition:  "Pricing Competition",
    category_expansion:   "Category Expansion",
    enterprise_shift:     "Enterprise Shift",
    product_bundling:     "Product Bundling",
    market_repositioning: "Market Repositioning",
  },
  pageEmphasis: ["pricing", "features", "changelog", "blog"],
};

// ── Defense ───────────────────────────────────────────────────────────────────

const DEFENSE_CONFIG: SectorConfig = {
  id: "defense",
  label: "Defense & Aerospace",
  description: "Track defense contractors, aerospace firms, and government suppliers",
  catalogCategories: [
    "defense-primes",
    "aerospace",
    "cyber-intel",
    "defense-services",
  ],
  movementLabels: {
    pricing_strategy_shift: "Contract Repositioning",
    product_expansion:      "Capability Expansion",
    market_reposition:      "Program Pivot",
    enterprise_push:        "Federal Push",
    ecosystem_expansion:    "Partnership Expansion",
  },
  signalLabels: {
    price_point_change: "Contract pricing update",
    tier_change:        "Program tier change",
    feature_launch:     "Capability announcement",
    positioning_shift:  "Positioning shift",
    content_strategy:   "Messaging update",
    audience_targeting: "Customer targeting",
  },
  patternLabels: {
    feature_convergence:  "Capability Convergence",
    pricing_competition:  "Contract Competition",
    category_expansion:   "Program Expansion",
    enterprise_shift:     "Federal Shift",
    product_bundling:     "Platform Bundling",
    market_repositioning: "Strategic Pivot",
  },
  pageEmphasis: ["programs", "contracts", "capabilities", "news"],
};

// ── Energy ────────────────────────────────────────────────────────────────────

const ENERGY_CONFIG: SectorConfig = {
  id: "energy",
  label: "Energy & Resources",
  description: "Track oil, gas, renewables, and energy sector competitors",
  catalogCategories: [
    "oil-gas",
    "renewables",
    "energy-services",
    "energy-tech",
  ],
  movementLabels: {
    pricing_strategy_shift: "Pricing Signal",
    product_expansion:      "Field Expansion",
    market_reposition:      "Market Shift",
    enterprise_push:        "Upstream Push",
    ecosystem_expansion:    "Regional Expansion",
  },
  signalLabels: {
    price_point_change: "Pricing update",
    tier_change:        "Tier change",
    feature_launch:     "Project announcement",
    positioning_shift:  "Positioning shift",
    content_strategy:   "Messaging update",
    audience_targeting: "Market targeting",
  },
  patternLabels: {
    feature_convergence:  "Technology Convergence",
    pricing_competition:  "Price Competition",
    category_expansion:   "Sector Expansion",
    enterprise_shift:     "Upstream Shift",
    product_bundling:     "Asset Bundling",
    market_repositioning: "Strategic Pivot",
  },
  pageEmphasis: ["projects", "investor-relations", "operations", "news"],
};

// ── Config map ────────────────────────────────────────────────────────────────

export const SECTOR_CONFIGS: Record<Sector, SectorConfig> = {
  saas:    SAAS_CONFIG,
  defense: DEFENSE_CONFIG,
  energy:  ENERGY_CONFIG,
};

export const DEFAULT_SECTOR: Sector = "saas";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSectorConfig(sector: string | null | undefined): SectorConfig {
  if (sector && SECTORS.includes(sector as Sector)) {
    return SECTOR_CONFIGS[sector as Sector];
  }
  return SECTOR_CONFIGS[DEFAULT_SECTOR];
}

/** Translate a canonical movement_type to sector-specific display label. */
export function translateMovementType(
  type: string | null,
  sector: string | null | undefined
): string {
  if (!type) return "Dormant";
  const config = getSectorConfig(sector);
  return (
    config.movementLabels[type] ??
    type.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
  );
}

/** Translate a canonical signal_type to sector-specific display label. */
export function translateSignalType(
  type: string,
  sector: string | null | undefined
): string {
  const config = getSectorConfig(sector);
  return config.signalLabels[type] ?? type.replace(/_/g, " ");
}

// Label map for all sectors including those without a full SectorConfig.
const SECTOR_LABELS: Record<string, string> = {
  saas:          "Software & AI",
  defense:       "Defense & Aerospace",
  energy:        "Energy & Resources",
  cybersecurity: "Cybersecurity",
  fintech:       "Fintech",
  custom:        "Custom",
};

/** Return the display label for any sector string. Falls back to capitalised slug. */
export function getSectorLabel(sector: string | null | undefined): string {
  if (!sector) return "Software";
  return (
    SECTOR_LABELS[sector] ??
    sector.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Translate a canonical pattern_type to sector-specific display label. */
export function translatePatternType(
  type: string,
  sector: string | null | undefined
): string {
  const config = getSectorConfig(sector);
  return (
    config.patternLabels[type] ??
    type.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
  );
}
