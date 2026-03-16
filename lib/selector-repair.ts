import * as cheerio from "cheerio";
import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairCandidate {
  monitored_page_id: string;
  section_type:      string;
  previous_selector: string;
  snapshot_id:       string;
  page_url:          string;
  last_valid_content: string | null;
}

export interface SelectorProposal {
  proposed_selector: string;
  confidence:        number;
  rationale:         string;
}

export interface ValidationResult {
  valid:                   boolean;
  test_extraction_content: string;
  rejection_reason?:       string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLUSTER_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
const CLUSTER_SIZE      = 3;

// Section-type semantic fallbacks for HTML neighborhood extraction
const SECTION_FALLBACKS: Record<string, string[]> = {
  hero:              ["[class*='hero']", "header", "section:first-of-type"],
  headline:          ["h1", "[class*='headline']", "[class*='banner']"],
  pricing_plans:     ["[class*='pricing']", "[class*='plan']", "[id*='pricing']"],
  pricing_references:["[class*='pricing']", "[class*='price']"],
  features_overview: ["[class*='feature']", "[class*='benefit']", "[class*='capability']"],
  release_feed:      ["[class*='changelog']", "[class*='release']", "[class*='update']"],
  careers_feed:      ["[class*='career']", "[class*='job']", "[class*='opening']"],
  announcements:     ["[class*='announcement']", "[class*='news']", "[class*='press']"],
  product_mentions:  ["[class*='product']", "main section:first-of-type"],
};

// Selectors too broad to be useful
const BROAD_SELECTORS = new Set(["main", "body", "article", "#content", ".content", "html", "div"]);

const HTML_SNIPPET_MAX_CHARS = 3000;
const TEST_CONTENT_MAX_CHARS = 500;

// ── 1. Clustered suspect detection ────────────────────────────────────────────

/**
 * Returns candidates where the last CLUSTER_SIZE page_sections rows for a
 * (monitored_page_id, section_type) pair are all 'suspect' and span ≤72h.
 * Skips pairs that already have a pending or accepted proposal.
 */
export async function detectClusteredSuspects(): Promise<RepairCandidate[]> {
  const cutoff = new Date(Date.now() - CLUSTER_WINDOW_MS).toISOString();

  // Distinct (page, section_type) pairs with any suspect in the window
  const { data: suspectRows, error } = await supabase
    .from("page_sections")
    .select("monitored_page_id, section_type")
    .eq("validation_status", "suspect")
    .gte("created_at", cutoff);

  if (error) throw error;

  const pairs = new Map<string, { monitored_page_id: string; section_type: string }>();
  for (const r of (suspectRows ?? []) as { monitored_page_id: string; section_type: string }[]) {
    pairs.set(`${r.monitored_page_id}:${r.section_type}`, r);
  }

  if (pairs.size === 0) return [];

  // Filter out pairs already covered by a pending or accepted proposal
  const pageIds = [...new Set([...pairs.values()].map((p) => p.monitored_page_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existingProposals } = await sb
    .from("selector_repair_suggestions")
    .select("monitored_page_id, section_type")
    .in("monitored_page_id", pageIds)
    .in("status", ["pending", "accepted"]);

  const alreadyProposed = new Set<string>(
    ((existingProposals ?? []) as unknown as { monitored_page_id: string; section_type: string }[])
      .map((p) => `${p.monitored_page_id}:${p.section_type}`)
  );

  const candidates: RepairCandidate[] = [];

  for (const pair of pairs.values()) {
    const key = `${pair.monitored_page_id}:${pair.section_type}`;
    if (alreadyProposed.has(key)) continue;

    // Verify last CLUSTER_SIZE rows are all suspect within the time window
    const { data: recent } = await supabase
      .from("page_sections")
      .select("snapshot_id, validation_status, created_at")
      .eq("monitored_page_id", pair.monitored_page_id)
      .eq("section_type", pair.section_type)
      .order("created_at", { ascending: false })
      .limit(CLUSTER_SIZE);

    if (!recent || recent.length < CLUSTER_SIZE) continue;

    const rows = recent as { snapshot_id: string; validation_status: string; created_at: string }[];

    if (!rows.every((r) => r.validation_status === "suspect")) continue;

    const newestMs = new Date(rows[0].created_at).getTime();
    const oldestMs = new Date(rows[CLUSTER_SIZE - 1].created_at).getTime();
    if (newestMs - oldestMs > CLUSTER_WINDOW_MS) continue;

    // Get active extraction rule selector
    const { data: ruleRows } = await supabase
      .from("extraction_rules")
      .select("selector")
      .eq("monitored_page_id", pair.monitored_page_id)
      .eq("section_type", pair.section_type)
      .eq("active", true)
      .limit(1);

    const rule = (ruleRows as { selector: string }[] | null)?.[0];
    if (!rule) continue;

    // Get monitored page URL
    const { data: pageRow } = await supabase
      .from("monitored_pages")
      .select("url")
      .eq("id", pair.monitored_page_id)
      .single();

    const pageUrl = (pageRow as { url: string } | null)?.url;
    if (!pageUrl) continue;

    // Get last valid extraction content for length similarity check
    const { data: validRows } = await supabase
      .from("page_sections")
      .select("section_text")
      .eq("monitored_page_id", pair.monitored_page_id)
      .eq("section_type", pair.section_type)
      .eq("validation_status", "valid")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastValidContent = (validRows as { section_text: string }[] | null)?.[0]?.section_text ?? null;

    candidates.push({
      monitored_page_id:  pair.monitored_page_id,
      section_type:       pair.section_type,
      previous_selector:  rule.selector,
      snapshot_id:        rows[0].snapshot_id,
      page_url:           pageUrl,
      last_valid_content: lastValidContent,
    });
  }

  return candidates;
}

// ── 2. Live HTML fetch and neighborhood extraction ────────────────────────────

interface HtmlContext {
  snippet:  string;
  fullHtml: string;
}

/**
 * Re-fetches the live page and extracts a focused HTML neighborhood for the
 * LLM to reason about. Returns both snippet (for prompt) and fullHtml (for
 * deterministic validation).
 */
export async function fetchHtmlContext(
  pageUrl:          string,
  previousSelector: string,
  sectionType:      string
): Promise<HtmlContext | null> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(pageUrl, {
      signal:  controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Metrivant-Repair/1.0)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const fullHtml = await res.text();

    const $       = cheerio.load(fullHtml);
    let   snippet = "";

    // Try old selector first — even if suspect it may return some structural context
    try {
      const el = $(previousSelector);
      if (el.length) {
        const parent  = el.parent();
        const context = parent.length ? parent : el;
        snippet       = $.html(context) ?? "";
      }
    } catch { /* invalid selector — fall through */ }

    // Semantic fallbacks if old selector matched nothing
    if (!snippet) {
      for (const sel of SECTION_FALLBACKS[sectionType] ?? []) {
        try {
          const el = $(sel);
          if (el.length) {
            snippet = $.html(el.first()) ?? "";
            if (snippet) break;
          }
        } catch { /* ignore invalid fallback selectors */ }
      }
    }

    if (snippet.length > HTML_SNIPPET_MAX_CHARS) {
      snippet = snippet.slice(0, HTML_SNIPPET_MAX_CHARS) + "…";
    }

    return { snippet, fullHtml };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ── 3. LLM selector proposal ──────────────────────────────────────────────────

/**
 * Calls gpt-4o-mini to propose a CSS selector that extracts the same content
 * type from the updated HTML structure.
 */
export async function proposeSelector(
  candidate:   RepairCandidate,
  htmlSnippet: string,
  openaiKey:   string
): Promise<SelectorProposal | null> {
  const prevContentNote = candidate.last_valid_content
    ? `Previously extracted content (first 300 chars): ${candidate.last_valid_content.slice(0, 300)}\n`
    : "";

  const prompt = `You are a web scraping expert. A CSS selector used to extract content from a website has stopped working because the site's HTML structure changed.

Section type: ${candidate.section_type}
Previous selector: ${candidate.previous_selector}
${prevContentNote}
Current HTML snippet (the DOM neighborhood where the content should appear):
\`\`\`html
${htmlSnippet}
\`\`\`

Propose a CSS selector that will extract the same type of content from this current HTML.
Rules:
- Prefer class-based or attribute selectors over positional (nth-child) ones
- Avoid overly broad selectors (body, div alone, main, article alone)
- The selector must be valid CSS
- Output ONLY valid JSON — no markdown, no explanation outside the JSON

Return exactly:
{"proposed_selector": "...", "confidence": 0.0-1.0, "rationale": "one sentence"}`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15_000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model:           "gpt-4o-mini",
        messages:        [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens:      150,
        temperature:     0,
      }),
    });

    if (!res.ok) return null;

    const data    = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<SelectorProposal>;
    if (!parsed.proposed_selector || typeof parsed.confidence !== "number") return null;

    return {
      proposed_selector: parsed.proposed_selector,
      confidence:        Math.min(1, Math.max(0, parsed.confidence)),
      rationale:         parsed.rationale ?? "",
    };
  } catch {
    return null;
  }
}

// ── 4. Deterministic selector validation ──────────────────────────────────────

/**
 * Tests the proposed selector against the full live HTML.
 * Rejects proposals that: match nothing, match the entire page, or produce
 * content whose length is wildly different from the last valid extraction.
 */
export function validateProposedSelector(
  fullHtml:         string,
  proposedSelector: string,
  lastValidContent: string | null
): ValidationResult {
  const trimmed = proposedSelector.toLowerCase().trim();
  if (BROAD_SELECTORS.has(trimmed)) {
    return { valid: false, test_extraction_content: "", rejection_reason: "selector_too_broad" };
  }

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(fullHtml);
  } catch {
    return { valid: false, test_extraction_content: "", rejection_reason: "html_parse_error" };
  }

  let nodes: ReturnType<cheerio.CheerioAPI>;
  try {
    nodes = $(proposedSelector);
  } catch {
    return { valid: false, test_extraction_content: "", rejection_reason: "invalid_selector" };
  }

  if (!nodes.length) {
    return { valid: false, test_extraction_content: "", rejection_reason: "no_nodes_matched" };
  }

  const extractedText = nodes.text().replace(/\s+/g, " ").trim();
  if (!extractedText) {
    return { valid: false, test_extraction_content: "", rejection_reason: "empty_content" };
  }

  // Reject if extraction covers >80% of the full body text (too broad)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length > 0 && extractedText.length / bodyText.length > 0.8) {
    return {
      valid:                   false,
      test_extraction_content: extractedText.slice(0, TEST_CONTENT_MAX_CHARS),
      rejection_reason:        "extracts_entire_page",
    };
  }

  // Reject if content length deviates >10× from last known valid extraction
  if (lastValidContent && lastValidContent.length > 0) {
    const ratio = extractedText.length / lastValidContent.length;
    if (ratio < 0.1 || ratio > 10) {
      return {
        valid:                   false,
        test_extraction_content: extractedText.slice(0, TEST_CONTENT_MAX_CHARS),
        rejection_reason:        "length_too_different",
      };
    }
  }

  return {
    valid:                   true,
    test_extraction_content: extractedText.slice(0, TEST_CONTENT_MAX_CHARS),
  };
}
