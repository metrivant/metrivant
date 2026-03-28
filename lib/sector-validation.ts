/**
 * Sector Validation
 *
 * Runtime validation for sector values. Ensures type safety and prevents
 * silent fallback to default sector when invalid values are encountered.
 */

import type { SectorId } from "./sector-prompting";

const VALID_SECTORS: readonly SectorId[] = [
  "saas",
  "fintech",
  "cybersecurity",
  "defense",
  "energy",
  "custom",
] as const;

/**
 * Validate sector string against allowed values.
 * Returns validated SectorId or null if invalid.
 *
 * Use this before applying sector-specific logic to ensure the value is valid.
 */
export function validateSector(sector: string | null | undefined): SectorId | null {
  if (!sector) return null;
  return VALID_SECTORS.includes(sector as SectorId) ? (sector as SectorId) : null;
}

/**
 * Validate sector with fallback to default.
 * Always returns a valid SectorId (never null).
 *
 * Use this when you need a guaranteed valid sector (e.g., for UI rendering).
 */
export function validateSectorWithFallback(
  sector: string | null | undefined,
  fallback: SectorId = "saas"
): SectorId {
  return validateSector(sector) ?? fallback;
}

/**
 * Check if a string is a valid sector.
 * Type guard for TypeScript narrowing.
 */
export function isSectorId(value: string | null | undefined): value is SectorId {
  if (!value) return false;
  return VALID_SECTORS.includes(value as SectorId);
}

/**
 * Get all valid sector IDs.
 * Useful for dropdowns, validation rules, etc.
 */
export function getValidSectors(): readonly SectorId[] {
  return VALID_SECTORS;
}
