// Deterministic scoring of discovered URL candidates against content categories.
// Produces a ranked shortlist per category for LLM refinement or direct use.

import type { DiscoveredLink } from "./url-discovery";

export type Category =
  | "newsroom"
  | "capabilities_or_features"
  | "careers"
  | "blog_or_articles"
  | "pricing";

export type ScoredCandidate = {
  url:        string;
  anchorText: string;
  score:      number;
  source:     string;
};

export type ScoredCategories = Record<Category, ScoredCandidate[]>;

// ── Vocabulary per category ────────────────────────────────────────────────────

const CATEGORY_VOCAB: Record<Category, string[]> = {
  newsroom: [
    "news", "newsroom", "media", "press", "press-releases",
    "press_releases", "updates", "announcements", "media-center",
  ],
  capabilities_or_features: [
    "capabilities", "what-we-do", "what_we_do", "solutions", "products",
    "platforms", "features", "offerings", "services", "programs", "technology",
  ],
  careers: [
    "careers", "jobs", "join-us", "join_us", "work-with-us",
    "hiring", "opportunities", "talent", "working-here",
  ],
  blog_or_articles: [
    "blog", "articles", "insights", "stories", "perspectives",
    "editorial", "thought-leadership", "resources",
  ],
  pricing: [
    "pricing", "plans", "subscriptions", "packages", "buy",
    "get-started", "tiers",
  ],
};

// ── Sector-specific boosts ─────────────────────────────────────────────────────

const SECTOR_BOOSTS: Partial<Record<string, Partial<Record<Category, string[]>>>> = {
  defense: {
    capabilities_or_features: ["capabilities", "programs", "what-we-do"],
    newsroom:                  ["news", "press", "media"],
  },
  aerospace: {
    capabilities_or_features: ["capabilities", "missions", "programs"],
    newsroom:                  ["news", "press"],
  },
  healthcare: {
    capabilities_or_features: ["solutions", "products", "services"],
    blog_or_articles:          ["insights", "resources"],
  },
  energy: {
    capabilities_or_features: ["solutions", "what-we-do", "services"],
    newsroom:                  ["news", "media"],
  },
  finance: {
    blog_or_articles:          ["insights", "research", "perspectives"],
    capabilities_or_features:  ["solutions"],
  },
  saas: {
    pricing:          ["pricing", "plans"],
    blog_or_articles: ["blog", "changelog"],
  },
};

// ── Scoring helpers ────────────────────────────────────────────────────────────

function tokenizePath(path: string): string[] {
  return path
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .split(/[^a-z0-9-]/)
    .filter(Boolean);
}

function matchesAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some(t => lower.includes(t));
}

function scoreCandidate(link: DiscoveredLink, category: Category, sector: string): number {
  let score = 0;

  let pathname = "";
  let subdomain = "";
  try {
    const u  = new URL(link.url);
    pathname  = u.pathname;
    subdomain = u.hostname.split(".")[0].toLowerCase();
  } catch {
    return 0;
  }

  const vocab       = CATEGORY_VOCAB[category];
  const sectorBoost = SECTOR_BOOSTS[sector]?.[category] ?? [];
  const tokens      = tokenizePath(pathname);

  // Path keyword match
  if (tokens.some(t => vocab.includes(t)))       score += 3;
  if (tokens.some(t => sectorBoost.includes(t))) score += 1;

  // Anchor text match
  if (link.anchorText && matchesAny(link.anchorText, vocab))       score += 2;
  if (link.anchorText && matchesAny(link.anchorText, sectorBoost)) score += 1;

  // Source bonus — nav links are the most authoritative
  if (link.source === "nav")     score += 2;
  else if (link.source === "footer") score += 1;

  // Shallow path bonus (top-level pages are hubs, not articles)
  const depth = pathname.split("/").filter(Boolean).length;
  if (depth === 1) score += 1;
  if (depth === 0) return 0; // homepage itself — never matches a category

  // Subdomain match (e.g., news.northropgrumman.com for newsroom)
  if (vocab.includes(subdomain) || sectorBoost.includes(subdomain)) score += 2;

  return score;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function scoreAndRank(candidates: DiscoveredLink[], sector: string): ScoredCategories {
  const categories: Category[] = [
    "newsroom",
    "capabilities_or_features",
    "careers",
    "blog_or_articles",
    "pricing",
  ];

  const result = {} as ScoredCategories;

  for (const category of categories) {
    result[category] = candidates
      .map(link => ({
        url:        link.url,
        anchorText: link.anchorText,
        score:      scoreCandidate(link, category, sector),
        source:     link.source,
      }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  return result;
}
