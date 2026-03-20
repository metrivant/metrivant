// GPT-powered narrative enrichment for sector_narratives.
//
// Called by the promote-media-signals cron handler.
// Takes a sector_narratives row (deterministic cluster from ingest-media-feeds)
// and generates a 2-3 sentence analyst narrative describing what the cluster
// represents and why it matters.
//
// Model: gpt-4o-mini (fast, cheap, sufficient for summarization).
// Temperature: 0.15 (low — factual summarization, not creative writing).

import { openai } from "./openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NarrativeCluster {
  id:                  string;
  sector:              string;
  theme_label:         string;
  keywords:            string[];
  source_count:        number;
  article_count:       number;
  representative_urls: string[];
  first_detected_at:   string;
  last_detected_at:    string;
  confidence_score:    number;
}

export interface ObservationForContext {
  title:        string;
  source_name:  string;
  published_at: string | null;
  url:          string | null;
}

export interface NarrativeEnrichmentResult {
  narrative_summary: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a competitive intelligence analyst writing narrative summaries for sector media clusters.

Given a cluster of related media articles from a specific sector, write a concise 2-3 sentence narrative summary that:
1. Describes what the cluster represents (the emerging trend, event, or theme)
2. Explains why it matters to competitors in this sector
3. Notes the breadth of coverage (sources, timeframe)

Rules:
- Be factual. Only reference what the article titles and metadata show.
- Do not speculate beyond the evidence.
- Write in present tense, analyst voice.
- Do not use bullet points or markdown.
- Maximum 3 sentences.
- Do not include phrases like "this cluster" or "these articles" — write as if describing the trend directly.`;

// ── Enrichment ────────────────────────────────────────────────────────────────

/**
 * Generate a narrative summary for a sector_narratives cluster using gpt-4o-mini.
 *
 * Accepts the cluster metadata + up to 10 recent observation titles for context.
 * Returns a 2-3 sentence narrative summary.
 */
export async function enrichClusterNarrative(
  cluster: NarrativeCluster,
  observations: ObservationForContext[],
): Promise<NarrativeEnrichmentResult> {
  const articleList = observations
    .slice(0, 10)
    .map((o, i) => {
      const source = o.source_name;
      const date = o.published_at ? new Date(o.published_at).toISOString().slice(0, 10) : "unknown date";
      return `${i + 1}. "${o.title}" — ${source}, ${date}`;
    })
    .join("\n");

  const durationDays = Math.max(
    1,
    Math.round(
      (new Date(cluster.last_detected_at).getTime() - new Date(cluster.first_detected_at).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );

  const userPrompt = `Sector: ${cluster.sector}
Theme: ${cluster.theme_label}
Keywords: ${cluster.keywords.join(", ")}
Articles: ${cluster.article_count} from ${cluster.source_count} sources over ${durationDays} days
Confidence: ${cluster.confidence_score.toFixed(2)}

Recent article titles:
${articleList}

Write a 2-3 sentence narrative summary.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.15,
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const narrative = response.choices[0]?.message?.content?.trim() ?? "";

  if (!narrative) {
    // Deterministic fallback — no LLM output.
    const fallback = `${cluster.theme_label} is an active theme in the ${cluster.sector} sector, appearing in ${cluster.article_count} articles from ${cluster.source_count} sources over the past ${durationDays} days.`;
    return { narrative_summary: fallback };
  }

  return { narrative_summary: narrative };
}
