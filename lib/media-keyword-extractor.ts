// Deterministic keyword extraction for media article titles.
//
// Pipeline:
//   1. Lowercase + strip punctuation
//   2. Tokenize on whitespace
//   3. Remove stopwords
//   4. Filter: keep tokens that match the sector allowlist OR appear in a
//      bigram that contains an allowlist term
//   5. Deduplicate and return sorted array
//
// Multi-word allowlist terms (e.g., "zero trust") are matched as bigrams/trigrams
// in the token stream. When matched, the full phrase is returned as a single
// element (spaces → underscore for storage uniformity).

import { getAllowlistForSector } from "./sector-keyword-allowlists";

// Common English stopwords — not exhaustive, tuned for news article titles.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "as", "is", "was", "are", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can",
  "not", "no", "nor", "so", "yet", "both", "either", "whether",
  "this", "that", "these", "those", "it", "its", "its", "which", "who",
  "whom", "whose", "what", "when", "where", "why", "how",
  "over", "under", "again", "further", "then", "once", "here", "there",
  "all", "any", "both", "each", "few", "more", "most", "other",
  "some", "such", "than", "too", "very", "just", "now", "only",
  "also", "into", "through", "during", "before", "after", "above",
  "below", "between", "out", "off", "about", "against", "along",
  "amid", "among", "around", "behind", "beyond", "despite",
  "following", "inside", "near", "outside", "since", "toward",
  "upon", "within", "without",
  // Common news title noise words
  "new", "says", "said", "report", "reports", "reportedly", "according",
  "latest", "update", "updates", "first", "last", "next", "one",
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "us", "uk", "eu", "un", "big", "key", "top", "high", "low",
  "set", "gets", "get", "use", "used", "using", "make", "making",
  "take", "taking", "give", "giving", "look", "looking", "show",
  "shows", "want", "wants", "need", "needs", "call", "calls",
]);

// Normalize a raw term from the allowlist to the same form used in token matching.
// Multi-word phrases become space-separated lowercase strings.
function normalizeAllowlistTerm(term: string): string {
  return term.toLowerCase().trim();
}

// Normalize a title for tokenization: lowercase, collapse whitespace,
// strip characters that are not alphanumeric, space, or hyphen.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokenize a normalized title string into individual tokens.
function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 1);
}

// Build all n-grams (n=1,2,3) from a token array as space-joined strings.
function buildNgrams(tokens: string[], maxN: number): string[] {
  const ngrams: string[] = [];
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(" "));
    }
  }
  return ngrams;
}

export interface KeywordExtractionResult {
  keywords: string[];
}

/**
 * Extract keywords from an article title for a given sector.
 *
 * Returns only terms that appear in the sector's allowlist (unigrams or
 * multi-word phrases). Multi-word matches are normalized to underscore-joined
 * strings (e.g., "zero_trust") for consistent array storage.
 *
 * Returns an empty array if no allowlist terms match (article is excluded
 * from cluster detection for this sector).
 */
export function extractKeywords(
  title: string,
  sector: string,
): KeywordExtractionResult {
  const allowlist = getAllowlistForSector(sector);
  if (allowlist.length === 0) {
    return { keywords: [] };
  }

  // Build a set of normalized allowlist terms for O(1) lookup.
  // Track max phrase length to limit n-gram window.
  let maxPhraseWords = 1;
  const allowlistSet = new Set<string>();
  for (const term of allowlist) {
    const normalized = normalizeAllowlistTerm(term);
    allowlistSet.add(normalized);
    const wordCount = normalized.split(" ").length;
    if (wordCount > maxPhraseWords) maxPhraseWords = wordCount;
  }

  const normalized = normalizeTitle(title);
  const tokens = tokenize(normalized);
  const ngrams = buildNgrams(tokens, Math.min(maxPhraseWords, 4));

  const matched = new Set<string>();

  for (const ngram of ngrams) {
    if (allowlistSet.has(ngram)) {
      // Convert spaces to underscores for storage (prevents splitting on spaces
      // when reading from TEXT[] column).
      matched.add(ngram.replace(/ /g, "_"));
    }
  }

  // Also include non-stopword unigrams that are in the allowlist
  // (already handled by the n-gram loop for n=1, but be explicit).

  return {
    keywords: [...matched].sort(),
  };
}

/**
 * Compute a dedup fingerprint for a media observation.
 * sha256(sector:source_name:title) truncated to 40 hex chars.
 *
 * This is a synchronous HMAC-free hash — just for dedup, not security.
 * Uses the Web Crypto API available in the Vercel edge runtime.
 */
export async function computeContentHash(
  sector: string,
  sourceName: string,
  title: string,
): Promise<string> {
  const raw = `${sector}:${sourceName}:${title}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 40);
}
