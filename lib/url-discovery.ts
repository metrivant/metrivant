// Discovers candidate URLs from a competitor's website.
// Strategy: robots.txt → sitemap links + homepage nav/footer link extraction.
// One-hop only — no deep crawling, no new dependencies.

const FETCH_TIMEOUT_MS = 4000;

export type DiscoveredLink = {
  url:        string;
  anchorText: string;
  source:     "sitemap" | "nav" | "footer" | "body";
};

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractSitemapUrls(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)];
  return matches.map(m => m[1].trim()).slice(0, 150);
}

function isSameOrRelatedDomain(url: string, baseHostname: string): boolean {
  try {
    const h    = new URL(url).hostname.toLowerCase();
    const base = baseHostname.toLowerCase().replace(/^www\./, "");
    const norm = h.replace(/^www\./, "");
    if (norm === base) return true;
    // Accept approved subdomains: news., blog., press., media., careers., ir., jobs.
    const approvedPrefixes = ["news", "blog", "press", "media", "careers", "ir", "investor", "jobs"];
    if (approvedPrefixes.some(p => h === `${p}.${base}`)) return true;
    return false;
  } catch {
    return false;
  }
}

function extractLinksFromHtml(
  html: string,
  baseHostname: string
): Pick<DiscoveredLink, "url" | "anchorText" | "source">[] {
  const results: Pick<DiscoveredLink, "url" | "anchorText" | "source">[] = [];
  const seen    = new Set<string>();

  const sections: { html: string; source: "nav" | "footer" | "body" }[] = [];

  // Extract structural blocks first for priority source tagging
  const navMatches    = [...html.matchAll(/<(?:nav|header)[\s>][\s\S]*?<\/(?:nav|header)>/gi)];
  const footerMatches = [...html.matchAll(/<footer[\s>][\s\S]*?<\/footer>/gi)];

  for (const m of navMatches)    sections.push({ html: m[0], source: "nav" });
  for (const m of footerMatches) sections.push({ html: m[0], source: "footer" });
  sections.push({ html, source: "body" }); // full page as fallback

  for (const section of sections) {
    const linkMatches = [
      ...section.html.matchAll(/<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi),
    ];
    for (const match of linkMatches) {
      const rawHref = match[1].trim();
      const rawText = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ").slice(0, 120);

      if (
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) continue;

      let resolved: string;
      try {
        resolved = rawHref.startsWith("http")
          ? rawHref
          : new URL(rawHref, `https://${baseHostname}`).href;
      } catch {
        continue;
      }

      if (!isSameOrRelatedDomain(resolved, baseHostname)) continue;

      // Dedup key: strip query, hash, trailing slash
      const key = resolved.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({ url: resolved, anchorText: rawText, source: section.source });
    }
  }

  return results;
}

export async function discoverCandidates(baseUrl: string): Promise<DiscoveredLink[]> {
  const baseHostname = new URL(baseUrl).hostname.toLowerCase();
  const links: DiscoveredLink[] = [];
  const seen  = new Set<string>();

  function add(link: Pick<DiscoveredLink, "url" | "anchorText" | "source">) {
    const key = link.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      links.push(link as DiscoveredLink);
    }
  }

  // 1 — robots.txt → sitemap entries
  const robotsTxt = await fetchWithTimeout(`${baseUrl}/robots.txt`, 3000);
  if (robotsTxt) {
    const sitemapUrls = robotsTxt
      .split("\n")
      .filter(l => l.toLowerCase().startsWith("sitemap:"))
      .map(l => l.replace(/^sitemap:\s*/i, "").trim())
      .filter(u => u.startsWith("http"))
      .slice(0, 3);

    for (const sitemapUrl of sitemapUrls) {
      const xml = await fetchWithTimeout(sitemapUrl, 4000);
      if (!xml) continue;
      for (const loc of extractSitemapUrls(xml)) {
        if (isSameOrRelatedDomain(loc, baseHostname)) {
          add({ url: loc, anchorText: "", source: "sitemap" });
        }
      }
    }
  }

  // 2 — Homepage nav / footer links
  const homepageHtml = await fetchWithTimeout(baseUrl, 5000);
  if (homepageHtml) {
    for (const link of extractLinksFromHtml(homepageHtml, baseHostname)) {
      add(link);
    }
  }

  return links;
}
