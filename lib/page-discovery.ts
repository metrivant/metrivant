// Discovers new monitored pages for a competitor beyond the 7-type fixed catalog.
//
// The 7-type catalog (homepage, pricing, changelog, blog, features, newsroom, careers)
// covers the highest-signal pages. This module finds additional pages with competitive
// intelligence value that the catalog does not map to.
//
// Flow:
//   1. discoverCandidates — fetch sitemap + homepage nav links
//   2. Filter against existing monitored_pages (skip already-monitored URLs)
//   3. Filter against catalog-scoring (skip URLs strongly matching known types)
//   4. Classify remaining with gpt-4o-mini → beyond-catalog page types
//   5. Return candidates with confidence >= CONFIDENCE_THRESHOLD
//
// No new dependencies. Uses existing lib/url-discovery, lib/url-scorer, supabase.

import { discoverCandidates } from "./url-discovery";
import { scoreAndRank } from "./url-scorer";
import { supabase } from "./supabase";

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.65;

// Minimum score for a candidate to be considered well-matched to a known
// catalog category. Candidates above this threshold are skipped here (they
// belong to gap-fill, not beyond-catalog discovery).
const CATALOG_SCORE_CUTOFF = 4;

// GPT call timeout
const GPT_TIMEOUT_MS = 10_000;

// Cap candidates sent to GPT to control token usage
const MAX_CANDIDATES_FOR_GPT = 20;

// ── Beyond-catalog taxonomy ───────────────────────────────────────────────────
// Four page types with clear competitive intelligence value that the fixed
// catalog does not cover. Conservative set — avoids generic marketing pages.

interface BeyondCatalogType {
  name:       string;
  page_class: "high_value" | "standard" | "ambient";
  description: string;
}

const BEYOND_CATALOG_TYPES: BeyondCatalogType[] = [
  {
    name:        "solutions",
    page_class:  "standard",
    description: "Solutions, use-cases, or industries page showing how the product applies to specific customer segments",
  },
  {
    name:        "integrations",
    page_class:  "standard",
    description: "Integrations, app marketplace, or ecosystem page listing third-party integrations and technology partners",
  },
  {
    name:        "developer",
    page_class:  "standard",
    description: "Developer hub, API documentation, or technical platform page signalling a developer-first go-to-market",
  },
  {
    name:        "about",
    page_class:  "ambient",
    description: "Company about page including leadership team, mission, values, or investors",
  },
];

const BEYOND_CATALOG_CLASS = new Map<string, "high_value" | "standard" | "ambient">(
  BEYOND_CATALOG_TYPES.map(t => [t.name, t.page_class])
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredPage {
  url:        string;
  page_type:  string;
  page_class: "high_value" | "standard" | "ambient";
  confidence: number;
  rationale:  string;
}

// ── GPT classification ────────────────────────────────────────────────────────

async function classifyBeyondCatalog(
  candidates:     { url: string; anchorText: string }[],
  competitorName: string,
  openaiKey:      string
): Promise<DiscoveredPage[]> {
  if (candidates.length === 0) return [];

  const typeList = BEYOND_CATALOG_TYPES
    .map(t => `- ${t.name}: ${t.description}`)
    .join("\n");

  const candidateList = candidates.slice(0, MAX_CANDIDATES_FOR_GPT)
    .map((c, i) => `${i}: ${c.url}${c.anchorText ? ` [${c.anchorText}]` : ""}`)
    .join("\n");

  const prompt = `You are classifying URLs for a competitive intelligence system.
Company: ${competitorName}

For each URL, classify it as one of the page types below, or "irrelevant".
Page types:
${typeList}
- irrelevant: does not fit any category above

URLs:
${candidateList}

Return only valid JSON array — no markdown, no explanation:
[
  {"index": 0, "page_type": "solutions", "confidence": 0.85, "rationale": "..."},
  {"index": 1, "page_type": "irrelevant", "confidence": 0.0, "rationale": "not competitive intelligence"}
]
Rules:
- Only include entries where page_type is NOT "irrelevant" and confidence >= 0.65
- Omit irrelevant results entirely`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), GPT_TIMEOUT_MS);

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
        max_tokens:  600,
        temperature: 0,
      }),
    });

    if (!response.ok) return [];

    const data    = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const cleaned = content
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const results = JSON.parse(cleaned) as Array<{
      index:      number;
      page_type:  string;
      confidence: number;
      rationale:  string;
    }>;

    return results
      .filter(r =>
        r.confidence >= CONFIDENCE_THRESHOLD &&
        BEYOND_CATALOG_CLASS.has(r.page_type) &&
        typeof r.index === "number" &&
        candidates[r.index]?.url
      )
      .map(r => ({
        url:        candidates[r.index].url,
        page_type:  r.page_type,
        page_class: BEYOND_CATALOG_CLASS.get(r.page_type) ?? "standard",
        confidence: r.confidence,
        rationale:  r.rationale ?? "",
      }));
  } catch {
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function discoverNewPages(
  competitorId: string,
  websiteUrl:   string,
  openaiKey:    string
): Promise<DiscoveredPage[]> {
  // 1. Discover candidate URLs from sitemap + homepage nav/footer
  const candidates = await discoverCandidates(websiteUrl).catch(() => []);
  if (candidates.length === 0) return [];

  // 2. Load existing monitored pages (URLs + types) for this competitor
  const { data: existingRows } = await supabase
    .from("monitored_pages")
    .select("url, page_type")
    .eq("competitor_id", competitorId)
    .eq("active", true);

  const existingUrls  = new Set(
    ((existingRows ?? []) as { url: string; page_type: string }[])
      .map(r => r.url.replace(/\/$/, "").toLowerCase())
  );
  const existingTypes = new Set(
    ((existingRows ?? []) as { url: string; page_type: string }[])
      .map(r => r.page_type)
  );

  // 3. Pre-filter: skip already-monitored URLs; skip candidates strongly
  //    matched to a known catalog type (gap-fill owns those)
  const scored         = scoreAndRank(candidates, "saas");
  const catalogMatched = new Set<string>();
  for (const entries of Object.values(scored)) {
    for (const entry of entries) {
      if (entry.score >= CATALOG_SCORE_CUTOFF) {
        catalogMatched.add(entry.url.replace(/\/$/, "").toLowerCase());
      }
    }
  }

  const filtered = candidates.filter(c => {
    const norm = c.url.replace(/\/$/, "").toLowerCase();
    return !existingUrls.has(norm) && !catalogMatched.has(norm);
  });

  if (filtered.length === 0) return [];

  // 4. GPT classification for beyond-catalog page types
  const classified = await classifyBeyondCatalog(filtered, "", openaiKey);

  // 5. Return only types not already monitored for this competitor
  return classified.filter(p => !existingTypes.has(p.page_type));
}
