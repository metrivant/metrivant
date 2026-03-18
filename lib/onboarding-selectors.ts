import * as cheerio from "cheerio";
import { validateProposedSelector } from "./selector-repair";

// ── Static fallback rules (one per page type) ──────────────────────────────────
// These are the baseline selectors used when LLM seeding fails or is unavailable.
// Identical to what onboard-competitor.ts used to compute inline via rulesForPage().

const STATIC_RULES: Record<string, Array<{ section_type: string; selector: string }>> = {
  homepage: [
    { section_type: "hero",             selector: "h1"   },
    { section_type: "headline",         selector: "h2"   },
    { section_type: "product_mentions", selector: "main" },
  ],
  pricing: [
    { section_type: "pricing_plans",      selector: "main" },
    { section_type: "pricing_references", selector: "main" },
  ],
  changelog: [
    { section_type: "release_feed", selector: "main" },
    { section_type: "headline",     selector: "h1"   },
  ],
  blog: [
    { section_type: "release_feed", selector: "main" },
    { section_type: "headline",     selector: "h1"   },
  ],
  features: [
    { section_type: "features_overview", selector: "main" },
    { section_type: "headline",          selector: "h1"   },
  ],
  newsroom: [
    { section_type: "announcements", selector: "main" },
    { section_type: "headline",      selector: "h1"   },
  ],
  careers: [
    { section_type: "careers_feed", selector: "main" },
  ],
};

export function getStaticRules(
  pageType: string
): Array<{ section_type: string; selector: string }> {
  return STATIC_RULES[pageType] ?? [];
}

// ── LLM seeding ────────────────────────────────────────────────────────────────

const HTML_SNIPPET_MAX_CHARS = 3000;

// Candidate selectors per section type — used for focused HTML neighborhood extraction
const SECTION_SEED_SELECTORS: Record<string, string[]> = {
  hero:               ["[class*='hero']", "header", "section:first-of-type"],
  headline:           ["h1", "[class*='headline']"],
  product_mentions:   ["[class*='product']", "[class*='feature']", "main section:first-of-type"],
  pricing_plans:      ["[class*='pricing']", "[class*='plan']", "[id*='pricing']"],
  pricing_references: ["[class*='pricing']", "[class*='price']"],
  features_overview:  ["[class*='feature']", "[class*='benefit']", "[class*='capability']"],
  release_feed:       ["[class*='changelog']", "[class*='release']", "[class*='update']"],
  careers_feed:       ["[class*='career']", "[class*='job']", "[class*='opening']"],
  announcements:      ["[class*='announcement']", "[class*='news']", "[class*='press']"],
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero:               "main hero message and value proposition above the fold",
  headline:           "primary page headline (h1 or equivalent)",
  product_mentions:   "product descriptions, feature highlights, and benefit statements",
  pricing_plans:      "pricing plan cards with plan names and prices",
  pricing_references: "pricing detail tables, feature comparisons, and plan limits",
  features_overview:  "product features, capabilities, and benefits sections",
  release_feed:       "changelog entries, release notes, and blog post list items",
  careers_feed:       "job listing items, open positions, and role links",
  announcements:      "press releases, news items, and announcement posts",
};

function extractSnippet($: cheerio.CheerioAPI, sectionType: string): string {
  for (const sel of SECTION_SEED_SELECTORS[sectionType] ?? []) {
    try {
      const el = $(sel);
      if (el.length) {
        const html = $.html(el.first()) ?? "";
        if (html) return html.slice(0, HTML_SNIPPET_MAX_CHARS);
      }
    } catch { /* ignore invalid selectors */ }
  }
  // Last-resort: first main, then body
  const main = $("main");
  if (main.length) return ($.html(main.first()) ?? "").slice(0, HTML_SNIPPET_MAX_CHARS);
  return ($("body").html() ?? "").slice(0, HTML_SNIPPET_MAX_CHARS);
}

async function proposeInitialSelector(
  sectionType: string,
  htmlSnippet: string,
  pageType:    string,
  openaiKey:   string
): Promise<{ proposed_selector: string; confidence: number } | null> {
  const description = SECTION_DESCRIPTIONS[sectionType] ?? sectionType;

  const prompt = `You are a web scraping expert configuring a competitive intelligence system to monitor a competitor's ${pageType} page.

Propose a CSS selector to extract "${sectionType}" content — ${description}.

HTML snippet:
\`\`\`html
${htmlSnippet}
\`\`\`

Rules:
- Prefer class-based or attribute selectors over positional (nth-child) ones
- Avoid broad selectors: body, div, main, article, html
- Must be valid CSS
- Output ONLY valid JSON

Return exactly: {"proposed_selector": "...", "confidence": 0.0-1.0}`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 12_000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model:           "gpt-4o-mini",
        messages:        [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens:      60,
        temperature:     0,
      }),
    });

    if (!res.ok) return null;

    const data    = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as { proposed_selector?: string; confidence?: number };
    if (!parsed.proposed_selector || typeof parsed.confidence !== "number") return null;

    return {
      proposed_selector: parsed.proposed_selector,
      confidence:        Math.min(1, Math.max(0, parsed.confidence)),
    };
  } catch {
    return null;
  }
}

export interface SmartRule {
  section_type: string;
  selector:     string;
  llm_seeded:   boolean;
}

/**
 * Fetch the live page HTML once, then propose targeted CSS selectors for all
 * section_types relevant to the page_type — in parallel.
 *
 * Each proposal is validated (must match at least one node, must not cover
 * >80% of the page body). Falls back to the static broad selector wherever
 * the LLM fails, confidence < 0.50, or validation rejects the proposal.
 *
 * Never throws. Always returns at least the static fallback rules.
 */
export async function seedSmartRules(
  pageUrl:   string,
  pageType:  string,
  openaiKey: string
): Promise<SmartRule[]> {
  const staticRules = getStaticRules(pageType);

  if (!openaiKey || staticRules.length === 0) {
    return staticRules.map((r) => ({ ...r, llm_seeded: false }));
  }

  // Fetch live HTML once for all section proposals
  let fullHtml = "";
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(pageUrl, {
      signal:  controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Metrivant-Onboard/1.0)" },
    });
    if (res.ok) fullHtml = await res.text();
  } catch { /* fall through to static rules */ }

  if (!fullHtml) return staticRules.map((r) => ({ ...r, llm_seeded: false }));

  const $ = cheerio.load(fullHtml);

  // All section proposals run in parallel — one LLM call per section_type
  const results = await Promise.all(
    staticRules.map(async (rule) => {
      const snippet = extractSnippet($, rule.section_type);
      if (!snippet) return { ...rule, llm_seeded: false };

      const proposal = await proposeInitialSelector(
        rule.section_type, snippet, pageType, openaiKey
      ).catch(() => null);

      if (!proposal || proposal.confidence < 0.50) {
        return { ...rule, llm_seeded: false };
      }

      const validation = validateProposedSelector(fullHtml, proposal.proposed_selector, null);
      if (!validation.valid) return { ...rule, llm_seeded: false };

      return {
        section_type: rule.section_type,
        selector:     proposal.proposed_selector,
        llm_seeded:   true,
      };
    })
  );

  return results;
}
