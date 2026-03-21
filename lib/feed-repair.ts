// Feed URL auto-repair for broken/stale competitor_feeds.
//
// When check-feed-health marks a feed as blocked/stale/unreachable,
// this module attempts to discover a working alternative feed URL
// from the competitor's website.
//
// Discovery methods:
//   1. Try common RSS path patterns on the competitor's domain
//   2. Fetch the page and look for <link rel="alternate" type="application/rss+xml">
//   3. Check /sitemap.xml for feed URLs
//
// No AI — pure heuristic discovery. Fast and deterministic.

import { parseFeed } from "./feed-parser";

const FETCH_TIMEOUT_MS = 8_000;

// Common RSS/Atom path patterns by pool type
const FEED_PATTERNS: Record<string, string[]> = {
  newsroom: [
    "/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml",
    "/news/feed", "/newsroom/feed", "/press/feed", "/blog/feed",
    "/news/rss", "/newsroom/rss", "/press/rss",
    "/feed/rss", "/feed/atom",
  ],
  careers: [], // Careers use API endpoints (Greenhouse/Lever/Ashby), not RSS
  investor: [], // Investor feeds are SEC EDGAR URLs, not discoverable
  product: [
    "/feed", "/blog/feed", "/changelog/feed", "/updates/feed",
    "/rss", "/blog/rss", "/feed.xml", "/atom.xml",
    "/changelog.xml", "/releases/feed",
  ],
  regulatory: [], // Regulatory feeds are SEC EDGAR URLs
  media: [], // Media feeds are curated in SECTOR_MEDIA_SOURCES
};

interface FeedDiscoveryResult {
  found: boolean;
  feedUrl: string | null;
  method: string | null;
  entryCount: number;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Metrivant Feed Discovery (research@metrivant.com)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempt to discover a working feed URL for a competitor.
 */
export async function discoverFeedUrl(
  competitorDomain: string,
  poolType: string,
): Promise<FeedDiscoveryResult> {
  const patterns = FEED_PATTERNS[poolType] ?? FEED_PATTERNS.newsroom;
  if (patterns.length === 0) {
    return { found: false, feedUrl: null, method: null, entryCount: 0 };
  }

  // Extract base domain
  let base: string;
  try {
    const u = new URL(competitorDomain);
    base = u.protocol + "//" + u.hostname;
  } catch {
    return { found: false, feedUrl: null, method: null, entryCount: 0 };
  }

  // ── Method 1: Try common path patterns ────────────────────────────────
  for (const pattern of patterns) {
    const candidateUrl = base + pattern;
    try {
      const res = await fetchWithTimeout(candidateUrl);
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      const isXml = contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom");

      const body = await res.text();

      // Quick sanity check: must contain RSS/Atom markers
      if (!isXml && !body.includes("<rss") && !body.includes("<feed") && !body.includes("<channel")) {
        continue;
      }

      const entries = parseFeed(body);
      if (entries.length > 0) {
        return { found: true, feedUrl: candidateUrl, method: "path_pattern", entryCount: entries.length };
      }
    } catch {
      continue;
    }
  }

  // ── Method 2: Check homepage for RSS link tags ────────────────────────
  try {
    const res = await fetchWithTimeout(base);
    if (res.ok) {
      const html = await res.text();
      // Look for <link rel="alternate" type="application/rss+xml" href="...">
      const rssLinkMatch = html.match(
        /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i
      );
      if (rssLinkMatch) {
        let feedUrl = rssLinkMatch[2];
        // Resolve relative URLs
        if (feedUrl.startsWith("/")) feedUrl = base + feedUrl;
        try {
          const feedRes = await fetchWithTimeout(feedUrl);
          if (feedRes.ok) {
            const feedBody = await feedRes.text();
            const entries = parseFeed(feedBody);
            if (entries.length > 0) {
              return { found: true, feedUrl, method: "html_link_tag", entryCount: entries.length };
            }
          }
        } catch { /* continue to next method */ }
      }
    }
  } catch { /* continue */ }

  return { found: false, feedUrl: null, method: null, entryCount: 0 };
}
