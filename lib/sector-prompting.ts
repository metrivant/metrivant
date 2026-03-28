/**
 * Sector-Aware Prompting
 *
 * Provides sector-specific guidance for LLM interpretation.
 * Fetches organization sector and injects tailored context into prompts.
 */

import { supabase } from "./supabase";

export type SectorId = "saas" | "fintech" | "cybersecurity" | "defense" | "energy" | "custom";

/**
 * Fetch sector for a given competitor by looking up their organization.
 * Returns sector ID or null if not found.
 */
export async function getSectorForCompetitor(competitorId: string): Promise<SectorId | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("tracked_competitors")
      .select("organizations(sector)")
      .eq("competitor_id", competitorId)
      .single();

    if (!data?.organizations?.sector) return null;
    return data.organizations.sector as SectorId;
  } catch {
    return null;
  }
}

/**
 * Build sector-specific prompt guidance to prepend to system prompt.
 * Returns formatted string with sector context or empty string if no sector.
 */
export function buildSectorPromptGuidance(sector: SectorId | null): string {
  if (!sector || sector === "custom") return "";

  const guidance: Record<SectorId, string> = {
    saas: `Sector context: SaaS & Software
Focus areas: product velocity, pricing strategy, feature releases, integrations, and GTM positioning.
Critical signals: major releases, pricing changes, tier restructures, enterprise features, API changes.
Interpret with attention to: product-market fit shifts, competitive feature parity, and PLG vs. sales-led motion.`,

    fintech: `Sector context: Fintech & Financial Services
Focus areas: regulatory compliance, capital raises, partnerships, product launches, and risk disclosures.
Critical signals: regulatory events, material disclosures, earnings releases, compliance updates, strategic investments.
Interpret with attention to: regulatory risk, capital efficiency, unit economics, and trust/security positioning.`,

    cybersecurity: `Sector context: Cybersecurity
Focus areas: threat detection capabilities, compliance certifications, security incidents, product releases, and M&A.
Critical signals: feature launches, regulatory certifications, product updates, security incidents, acquisitions.
Interpret with attention to: technical depth, compliance coverage, threat landscape positioning, and enterprise readiness.`,

    defense: `Sector context: Defense & Aerospace
Focus areas: contract awards, program wins, regulatory compliance, capability expansion, and government relationships.
Critical signals: major contracts, framework awards, program awards, acquisitions, regulatory events.
Interpret with attention to: contract value, clearance requirements, program timelines, and government budget cycles.`,

    energy: `Sector context: Energy & Resources
Focus areas: project awards, earnings, regulatory compliance, M&A, capital allocation, and operational updates.
Critical signals: earnings releases, major contracts, regulatory events, acquisitions, guidance updates.
Interpret with attention to: commodity exposure, capital intensity, regulatory risk, and project economics.`,

    custom: "",
  };

  const text = guidance[sector] ?? "";
  return text ? `\n\n${text}` : "";
}

/**
 * Build full sector-aware system prompt by appending sector guidance to base prompt.
 * Used in interpret-signals to inject sector context into LLM calls.
 */
export function buildSectorAwarePrompt(basePrompt: string, sector: SectorId | null): string {
  const sectorGuidance = buildSectorPromptGuidance(sector);
  return basePrompt + sectorGuidance;
}
