#!/usr/bin/env tsx

/**
 * Generate Runtime Sector Weights from UI Configuration
 *
 * Eliminates configuration duplication by generating lib/sector-weights.ts
 * from radar-ui/lib/sector-config.ts at build time.
 *
 * Run: npx tsx scripts/generate-sector-weights.ts
 * Or: npm run generate-sector-weights (add to package.json scripts)
 */

import { writeFileSync } from "fs";
import { join } from "path";

// Import UI configuration (source of truth)
// Note: This uses a relative path that works when script runs from repo root
const sectorConfigPath = join(process.cwd(), "radar-ui/lib/sector-config.ts");

// We'll extract the config manually since importing across surfaces is complex
// Instead, we'll read and parse the TypeScript file

const fs = require("fs");

const configContent = fs.readFileSync(sectorConfigPath, "utf-8");

// Extract sector configurations using regex (robust enough for our structured config)
function extractSectorConfig(content: string, sectorName: string) {
  const regex = new RegExp(
    `const ${sectorName.toUpperCase()}_CONFIG: ComprehensiveSectorConfig = \\{([\\s\\S]*?)\\};\\s*(?:\\/\\/|const|export)`,
    "m"
  );
  const match = content.match(regex);
  if (!match) return null;

  const configBlock = match[1];

  // Extract pool weights
  const poolWeightsMatch = configBlock.match(/poolWeights:\s*\{([\s\S]*?)\},?\s*(?:signalWeights|confidenceBonuses)/);
  const poolWeights: Record<string, number> = {};
  if (poolWeightsMatch) {
    const lines = poolWeightsMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([a-z_]+):\s*([0-9.]+),?\s*(?:\/\/.*)?$/);
      if (match) {
        poolWeights[match[1]] = parseFloat(match[2]);
      }
    }
  }

  // Extract signal weights
  const signalWeightsMatch = configBlock.match(/signalWeights:\s*\{([\s\S]*?)\},?\s*(?:confidenceBonuses|patternThresholds)/);
  const signalWeights: Record<string, number> = {};
  if (signalWeightsMatch) {
    const lines = signalWeightsMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([a-z_]+):\s*([0-9.]+),?\s*(?:\/\/.*)?$/);
      if (match) {
        signalWeights[match[1]] = parseFloat(match[2]);
      }
    }
  }

  // Extract confidence bonuses
  const confidenceBonusesMatch = configBlock.match(/confidenceBonuses:\s*\{([\s\S]*?)\},?\s*(?:patternThresholds|onboarding)/);
  const confidenceBonuses: Record<string, number> = {};
  if (confidenceBonusesMatch) {
    const lines = confidenceBonusesMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([a-z_]+):\s*([0-9.]+),?\s*(?:\/\/.*)?$/);
      if (match) {
        confidenceBonuses[match[1]] = parseFloat(match[2]);
      }
    }
  }

  return { signalWeights, poolWeights, confidenceBonuses };
}

const sectors = ["saas", "fintech", "cybersecurity", "defense", "energy", "custom"];
const configs: Record<string, any> = {};

for (const sector of sectors) {
  const config = extractSectorConfig(configContent, sector);
  if (config) {
    configs[sector] = config;
  }
}

// Generate TypeScript file
const output = `/**
 * Sector Weights for Runtime Pipeline
 *
 * AUTO-GENERATED from radar-ui/lib/sector-config.ts
 * DO NOT EDIT MANUALLY - Run: npx tsx scripts/generate-sector-weights.ts
 *
 * Generated: ${new Date().toISOString()}
 */

export type SectorId = "saas" | "fintech" | "cybersecurity" | "defense" | "energy" | "custom";
export type PoolType = "newsroom" | "careers" | "investor" | "product" | "procurement" | "regulatory" | "media";

/**
 * Get signal severity multiplier for a given sector and signal type.
 * Returns 1.0 if signal type not configured for sector (neutral weight).
 */
export function getSectorSignalWeight(sector: SectorId | null, signalType: string): number {
  if (!sector || sector === "custom") return 1.0;

  const weights: Record<SectorId, Record<string, number>> = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(configs).map(([sector, config]) => [sector, config.signalWeights])
    ),
    null,
    2
  )};

  return weights[sector]?.[signalType] ?? 1.0;
}

/**
 * Get pool weight multiplier for a given sector and pool type.
 * Used for ambient activity pressure contribution.
 * Returns 1.0 if pool not configured for sector.
 */
export function getSectorPoolWeight(sector: SectorId | null, poolType: PoolType): number {
  if (!sector || sector === "custom") return 1.0;

  const weights: Record<SectorId, Record<PoolType, number>> = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(configs).map(([sector, config]) => [sector, config.poolWeights])
    ),
    null,
    2
  )};

  return weights[sector]?.[poolType] ?? 1.0;
}

/**
 * Get confidence bonus for a given sector and signal type.
 * Added to base confidence score in detect-signals.
 * Returns 0.0 if signal type not configured for sector.
 */
export function getSectorConfidenceBonus(sector: SectorId | null, signalType: string): number {
  if (!sector || sector === "custom") return 0.0;

  const bonuses: Record<SectorId, Record<string, number>> = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(configs).map(([sector, config]) => [sector, config.confidenceBonuses])
    ),
    null,
    2
  )};

  return bonuses[sector]?.[signalType] ?? 0.0;
}
`;

// Write to lib/sector-weights.ts
const outputPath = join(process.cwd(), "lib/sector-weights.ts");
writeFileSync(outputPath, output, "utf-8");

console.log("✓ Generated lib/sector-weights.ts from radar-ui/lib/sector-config.ts");
console.log(`  Sectors processed: ${Object.keys(configs).length}`);
console.log(`  Output: ${outputPath}`);
