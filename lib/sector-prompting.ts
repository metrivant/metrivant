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

/**
 * Build sector-specific validation guidance for quality checking interpretations.
 * Returns red flags and quality checks specific to each sector's critical signal types.
 * Used in validation to catch sector-contextually wrong interpretations.
 */
export function buildSectorValidationGuidance(sector: SectorId | null): string {
  if (!sector || sector === "custom") return "";

  const guidance: Record<SectorId, string> = {
    saas: `Sector validation rules (SaaS):
- Pricing page changes are NOT product expansion — they're pricing strategy shifts
- Changelog entries are NOT major releases unless they indicate new product lines
- Integration additions are partnership signals, not core product changes
- Feature page updates should be classified as feature_launch only if entirely new capability
- Marketing copy changes are messaging updates, not strategic pivots`,

    fintech: `Sector validation rules (Fintech):
- Regulatory disclosures (10-K, 8-K) are compliance signals, NOT product launches
- "Launching new features" in compliance context = regulatory-mandated disclosure, not expansion
- Investor relations updates are financial signals, not product signals
- Compliance page changes indicate regulatory positioning, not operational changes
- Security/trust page updates are assurance signals, not capability expansion`,

    cybersecurity: `Sector validation rules (Cybersecurity):
- Compliance certifications (SOC2, ISO) are assurance signals, not product features
- Threat intelligence updates are content signals, not capability changes
- Security incidents disclosed are transparency signals, not weaknesses (unless exploit confirmed)
- Product security features are capability signals only if new detection/response mechanisms
- Partner integrations are ecosystem signals, not core product expansion`,

    defense: `Sector validation rules (Defense):
- Contract awards are procurement signals with dollar values — verify value mentioned
- "Capabilities" page updates are marketing unless tied to specific program wins
- Clearance requirements are operational details, not strategic shifts
- Framework awards are positioning signals, not revenue events (until task orders)
- Program updates are milestones, not new contract wins unless explicitly stated`,

    energy: `Sector validation rules (Energy):
- Earnings releases are financial signals — distinguish from operational project updates
- Project awards are material events — verify contract value and timeline mentioned
- Regulatory filings are compliance signals, not operational changes
- "Sustainability" updates are positioning signals unless tied to specific capital allocation
- Guidance updates are financial signals, not operational strategy shifts`,

    custom: "",
  };

  const text = guidance[sector] ?? "";
  return text ? `\n\n${text}` : "";
}
