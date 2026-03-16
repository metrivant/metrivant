// Sector Intelligence Layer — cross-competitor pattern analysis via GPT-4o.
//
// Analyzes signals across all competitors tracked by an org to detect:
//   • messaging convergence (same theme appearing across competitors)
//   • emerging sector positioning trends
//   • strategic divergence by outlier competitors
//
// AI only synthesizes meaning from evidence already produced by the deterministic pipeline.

import { openai } from "./openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignalForSector {
  signal_id:               string;
  competitor_id:           string;
  competitor_name:         string;
  section_type:            string;
  page_class:              string;   // high_value | standard | ambient
  summary:                 string | null;
  changed_content_snippet: string | null;
  detected_at:             string;
}

export interface SectorCompetitorSlot {
  competitor_name: string;
  signals:         SignalForSector[];
}

export interface SectionGroup {
  section_type: string;
  competitors:  SectorCompetitorSlot[];
}

export interface SectorTrend {
  theme:                string;
  direction:            string;
  competitors_involved: string[];
  evidence:             string;
  evidence_signal_ids?: string[];
}

export interface SectorDivergence {
  competitor:            string;
  difference:            string;
  potential_significance: string;
  evidence_signal_ids?:  string[];
}

export interface SectorIntelligenceResult {
  sector_trends: SectorTrend[];
  divergences:   SectorDivergence[];
  summary:       string;
}

// ── Signal selection ──────────────────────────────────────────────────────────

const PAGE_CLASS_RANK: Record<string, number> = {
  high_value: 1,
  standard:   2,
  ambient:    3,
};

const MAX_SIGNALS_PER_COMPETITOR = 10;

/**
 * Selects up to MAX_SIGNALS_PER_COMPETITOR signals per competitor using:
 *   1. Page class priority (high_value before standard before ambient)
 *   2. Section diversity (at least one per distinct section_type if available)
 *   3. Recency fill for remaining slots
 *
 * Signals must be pre-sorted by (page_class_rank ASC, detected_at DESC)
 * before calling this function.
 */
export function selectSignalsForCompetitor(signals: SignalForSector[]): SignalForSector[] {
  if (signals.length <= MAX_SIGNALS_PER_COMPETITOR) return signals;

  // Sort: page class priority first, then newest within tier
  const sorted = [...signals].sort((a, b) => {
    const ra = PAGE_CLASS_RANK[a.page_class] ?? 4;
    const rb = PAGE_CLASS_RANK[b.page_class] ?? 4;
    if (ra !== rb) return ra - rb;
    return b.detected_at.localeCompare(a.detected_at);
  });

  const selected: SignalForSector[] = [];
  const usedIds   = new Set<string>();
  const usedTypes = new Set<string>();

  // Step 2: one per section_type (take best/earliest in priority order)
  for (const s of sorted) {
    if (selected.length >= MAX_SIGNALS_PER_COMPETITOR) break;
    if (!usedTypes.has(s.section_type)) {
      selected.push(s);
      usedIds.add(s.signal_id);
      usedTypes.add(s.section_type);
    }
  }

  // Step 3: fill remaining slots by recency (already sorted)
  for (const s of sorted) {
    if (selected.length >= MAX_SIGNALS_PER_COMPETITOR) break;
    if (!usedIds.has(s.signal_id)) {
      selected.push(s);
      usedIds.add(s.signal_id);
    }
  }

  return selected;
}

// ── Section pivot ─────────────────────────────────────────────────────────────

/**
 * Pivots a flat signal list into section-grouped structure.
 * Each section lists all tracked competitors (with signals or "no signals").
 * Sections are ordered by total signal count descending (most active first).
 */
export function buildSectionPivot(
  signals:         SignalForSector[],
  competitorNames: string[]
): SectionGroup[] {
  // Build: sectionType → competitorName → signals[]
  const bySection = new Map<string, Map<string, SignalForSector[]>>();

  for (const s of signals) {
    if (!bySection.has(s.section_type)) {
      bySection.set(s.section_type, new Map());
    }
    const compMap = bySection.get(s.section_type)!;
    const arr = compMap.get(s.competitor_name) ?? [];
    arr.push(s);
    compMap.set(s.competitor_name, arr);
  }

  const sections: SectionGroup[] = [...bySection.entries()].map(([section_type, compMap]) => ({
    section_type,
    competitors: competitorNames.map((name) => ({
      competitor_name: name,
      signals:         compMap.get(name) ?? [],
    })),
  }));

  // Sort sections by total signal count descending (most activity first)
  sections.sort((a, b) => {
    const countA = a.competitors.reduce((n, c) => n + c.signals.length, 0);
    const countB = b.competitors.reduce((n, c) => n + c.signals.length, 0);
    return countB - countA;
  });

  // Cap at top 8 sections to keep prompt size bounded
  return sections.slice(0, 8);
}

// ── Types: narrative context ──────────────────────────────────────────────────

export interface SectorNarrativeContext {
  theme_label:      string;
  keywords:         string[];
  source_count:     number;
  article_count:    number;
  confidence_score: number;
  last_detected_at: string;
}

// ── Prompt construction ───────────────────────────────────────────────────────

export function buildPromptInput(
  sector:      string,
  windowDays:  number,
  sections:    SectionGroup[],
  narratives?: SectorNarrativeContext[]
): string {
  const lines: string[] = [
    `Sector: ${sector}`,
    `Analysis Window: ${windowDays} days`,
    ``,
    `Signals grouped by section:`,
    ``,
  ];

  for (const section of sections) {
    lines.push(`Section: ${section.section_type}`);
    for (const comp of section.competitors) {
      if (comp.signals.length === 0) {
        lines.push(`- ${comp.competitor_name}: no signals`);
      } else {
        for (const s of comp.signals) {
          const date     = s.detected_at.slice(0, 10);
          const evidence = s.changed_content_snippet ?? s.summary ?? "";
          lines.push(`- ${comp.competitor_name}: ${evidence.slice(0, 150)} (${date})`);
        }
      }
    }
    lines.push(``);
  }

  // Inject active sector media narratives as background context (if provided).
  if (narratives && narratives.length > 0) {
    lines.push(`Active sector media narratives (${sector}, last 14 days):`);
    for (const n of narratives) {
      const date = n.last_detected_at.slice(0, 10);
      lines.push(
        `- "${n.theme_label}" — ${n.article_count} articles from ${n.source_count} sources` +
        ` (confidence ${n.confidence_score.toFixed(2)}, last seen ${date})` +
        ` [keywords: ${n.keywords.slice(0, 5).join(", ")}]`
      );
    }
    lines.push(``);
  }

  lines.push(`Analyze the sector activity and identify strategic patterns.`);
  return lines.join("\n");
}

// ── Evidence signal ID mapping ────────────────────────────────────────────────

/**
 * Attaches evidence_signal_ids to each trend and divergence deterministically.
 * Maps the competitor names returned by the LLM back to the input signal IDs.
 * This runs after the LLM call — no model is involved in ID selection.
 */
export function attachEvidenceSignalIds(
  result:    SectorIntelligenceResult,
  signals:   SignalForSector[]
): SectorIntelligenceResult {
  // Build: competitorName → signal_id[]
  const idsByCompetitor = new Map<string, string[]>();
  for (const s of signals) {
    const arr = idsByCompetitor.get(s.competitor_name) ?? [];
    arr.push(s.signal_id);
    idsByCompetitor.set(s.competitor_name, arr);
  }

  const enrichedTrends = result.sector_trends.map((trend) => {
    const ids = new Set<string>();
    for (const name of trend.competitors_involved ?? []) {
      for (const id of idsByCompetitor.get(name) ?? []) ids.add(id);
    }
    return { ...trend, evidence_signal_ids: [...ids] };
  });

  const enrichedDivergences = result.divergences.map((div) => {
    const ids = idsByCompetitor.get(div.competitor) ?? [];
    return { ...div, evidence_signal_ids: ids };
  });

  return {
    ...result,
    sector_trends: enrichedTrends,
    divergences:   enrichedDivergences,
  };
}

// ── GPT-4o call ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a competitive intelligence analyst analyzing activity across multiple competitors in a sector.

Your task is to identify patterns across competitors that suggest sector positioning shifts or strategic divergence.

Focus on detecting:
• messaging convergence across competitors
• emerging positioning themes
• competitors behaving differently from the sector

Your analysis must be grounded in the signals provided.
Do not speculate beyond the evidence.
Write the summary as if it will appear directly in an executive intelligence brief.
No preamble, no explanation of the analysis process.
Deliver the insight directly.

Return JSON with exactly:
- sector_trends: array of { theme, direction, competitors_involved, evidence } — max 4 items
- divergences: array of { competitor, difference, potential_significance } — max 3 items
- summary: executive brief paragraph (3-5 sentences, specific and evidence-grounded)

Return only valid JSON.`;

export async function generateSectorIntelligence(
  sector:     string,
  windowDays: number,
  sections:   SectionGroup[],
  signals:    SignalForSector[],
  narratives?: SectorNarrativeContext[]
): Promise<SectorIntelligenceResult | null> {
  if (signals.length === 0) return null;

  const userPrompt = buildPromptInput(sector, windowDays, sections, narratives);

  try {
    const response = await openai.chat.completions.create({
      model:           "gpt-4o",
      temperature:     0.15,
      max_tokens:      800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<SectorIntelligenceResult>;
    if (!parsed.summary) return null;

    const raw: SectorIntelligenceResult = {
      sector_trends: Array.isArray(parsed.sector_trends) ? parsed.sector_trends : [],
      divergences:   Array.isArray(parsed.divergences)   ? parsed.divergences   : [],
      summary:       parsed.summary,
    };

    // Attach evidence signal IDs deterministically (no LLM involvement)
    return attachEvidenceSignalIds(raw, signals);
  } catch {
    return null;
  }
}
