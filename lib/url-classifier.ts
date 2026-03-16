// LLM-assisted URL classification over pre-scored candidates.
// Uses gpt-4o-mini. Only called when scored candidates exist.
// Never invents URLs — must choose only from provided candidates.

import type { Category, ScoredCategories } from "./url-scorer";

export type ClassifiedResult = {
  url:        string | null;
  confidence: number;
  reason:     string;
};

export type ClassificationOutput = Record<Category, ClassifiedResult>;

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  newsroom:                 "Main hub for company news, press releases, and official announcements",
  capabilities_or_features: "Page describing what the company does — products, services, capabilities, or programs",
  careers:                  "Job listings hub or careers/join-us page",
  blog_or_articles:         "Editorial content, thought leadership, articles, or insights",
  pricing:                  "Pricing plans, packages, or subscription tiers",
};

export async function classifyWithLLM(
  scored:         ScoredCategories,
  competitorName: string,
  sector:         string,
  openaiKey:      string
): Promise<ClassificationOutput | null> {
  const categories = Object.keys(scored) as Category[];

  // Build compact candidate list — only categories that have candidates
  const candidatesByCategory: Record<string, { url: string; anchorText: string; score: number }[]> = {};
  let hasAnyCandidates = false;

  for (const cat of categories) {
    if (scored[cat].length > 0) {
      hasAnyCandidates = true;
      candidatesByCategory[cat] = scored[cat].slice(0, 5).map(c => ({
        url:        c.url,
        anchorText: c.anchorText || "(no anchor text)",
        score:      c.score,
      }));
    }
  }

  if (!hasAnyCandidates) return null;

  const categoryDescriptions = categories
    .map(c => `- ${c}: ${CATEGORY_DESCRIPTIONS[c]}`)
    .join("\n");

  const sectorHint = sector && sector !== "custom"
    ? `\nThis is a ${sector} sector company.`
    : "";

  const prompt = `You are classifying URLs for a competitive intelligence system.
Company: ${competitorName}${sectorHint}

For each category, pick the best URL from the provided candidates only.
Rules:
- Never invent URLs — choose only from the candidates provided
- Prefer canonical hub pages over individual articles or job postings
- Return null if no candidate is a strong fit

Categories:
${categoryDescriptions}

Candidates per category:
${JSON.stringify(candidatesByCategory, null, 2)}

Return only valid JSON — no markdown, no explanation:
{
  "newsroom": { "url": "...", "confidence": 0.0, "reason": "..." },
  "capabilities_or_features": { "url": "...", "confidence": 0.0, "reason": "..." },
  "careers": { "url": "...", "confidence": 0.0, "reason": "..." },
  "blog_or_articles": { "url": "...", "confidence": 0.0, "reason": "..." },
  "pricing": { "url": null, "confidence": 0.0, "reason": "No strong candidate" }
}`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        messages:    [{ role: "user", content: prompt }],
        max_tokens:  400,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;

    const data    = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Strip markdown fences if model wraps in ```json
    const cleaned = content
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return JSON.parse(cleaned) as ClassificationOutput;
  } catch {
    return null;
  }
}
