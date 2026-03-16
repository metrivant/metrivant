// Product / changelog / release feed URL discovery.
//
// Three strategies run in parallel and independently:
//   A. Path probing        — common changelog / release RSS/Atom URL patterns
//   B. Alternate-link      — <link rel="alternate"> in changelog/releases page HTML
//   C. GitHub releases     — discover GitHub org from website HTML, then probe
//                            primary repo for a valid releases.atom feed
//
// Preference order when multiple strategies succeed:
//   1. Alternate-link  (site explicitly declared the feed URL)
//   2. GitHub releases (predictable structured source)
//   3. Path probe      (generic fallback)
//
// Constraint: one primary GitHub repository per competitor.
//   Prefer the repo whose name most closely matches the company domain slug.
//   Do NOT ingest from every repo in an org.

const PROBE_TIMEOUT_MS  = 3_000;
const HTML_TIMEOUT_MS   = 5_000;
const GITHUB_TIMEOUT_MS = 4_000;

// Max GitHub repo candidates to probe before giving up.
const MAX_GITHUB_CANDIDATES = 5;

const USER_AGENT = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

// Product / changelog feed path patterns ordered by prevalence.
const PRODUCT_PROBE_PATHS = [
  "/changelog/rss",
  "/changelog/feed",
  "/changelog.rss",
  "/changelog.xml",
  "/releases.atom",
  "/releases/feed",
  "/releases/rss",
  "/product-updates/feed",
  "/product-updates/rss",
  "/release-notes/feed",
  "/release-notes/rss",
  "/updates/feed",
  "/updates/rss",
  "/feed",
  "/rss",
  "/atom.xml",
  "/?feed=rss2",
];

export type ProductFeedSourceType =
  | "changelog_feed"
  | "release_feed"
  | "github_release"
  | "rss"
  | "atom";

export type ProductFeedDiscoveryResult =
  | { found: true;  url: string; source_type: ProductFeedSourceType; method: "probe" | "alternate_link" | "github" }
  | { found: false; reason: string };

// ── Utility ────────────────────────────────────────────────────────────────────

function isFeedContentType(ct: string | null): boolean {
  if (!ct) return false;
  return (
    ct.includes("application/rss+xml")  ||
    ct.includes("application/atom+xml") ||
    ct.includes("application/xml")      ||
    ct.includes("text/xml")
  );
}

function detectSourceType(ct: string | null, url: string): "rss" | "atom" | "changelog_feed" | "release_feed" {
  if (ct?.includes("atom") || url.includes("atom") || url.includes("releases.atom")) return "release_feed";
  if (url.includes("changelog")) return "changelog_feed";
  return "rss";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

// ES2020-compatible Promise.any substitute
function firstFulfilled<T>(promises: Array<Promise<T>>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pending = promises.length;
    if (pending === 0) { reject(new Error("empty")); return; }
    for (const p of promises) {
      p.then(
        (v) => resolve(v),
        () => { pending -= 1; if (pending === 0) reject(new Error("all_rejected")); }
      );
    }
  });
}

// ── Strategy A: product path probing ──────────────────────────────────────────

async function probeOne(
  candidate: string
): Promise<ProductFeedDiscoveryResult & { found: true }> {
  let headStatus = 0;
  let headCt: string | null = null;
  try {
    const headRes = await withTimeout(
      fetch(candidate, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      }),
      PROBE_TIMEOUT_MS
    );
    headStatus = headRes.status;
    headCt     = headRes.headers.get("content-type");

    if (headRes.ok && isFeedContentType(headCt)) {
      return {
        found:       true,
        url:         candidate,
        source_type: detectSourceType(headCt, candidate),
        method:      "probe",
      };
    }
  } catch {
    throw new Error("network_error");
  }

  if (headStatus === 405 || (headStatus === 200 && !isFeedContentType(headCt))) {
    try {
      const getRes = await withTimeout(
        fetch(candidate, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT },
          redirect: "follow",
        }),
        PROBE_TIMEOUT_MS
      );
      if (!getRes.ok) throw new Error(`http_${getRes.status}`);

      const getCt = getRes.headers.get("content-type");
      if (isFeedContentType(getCt)) {
        return {
          found:       true,
          url:         candidate,
          source_type: detectSourceType(getCt, candidate),
          method:      "probe",
        };
      }

      const reader = getRes.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        void reader.cancel();
        if (value) {
          const prefix = new TextDecoder().decode(value.slice(0, 256)).trimStart();
          if (prefix.startsWith("<?xml") || prefix.startsWith("<rss") || prefix.startsWith("<feed")) {
            return {
              found:       true,
              url:         candidate,
              source_type: detectSourceType(getCt, candidate),
              method:      "probe",
            };
          }
        }
      }
    } catch {
      // fall through
    }
  }

  throw new Error("not_a_feed");
}

async function probeProductPaths(baseUrl: string): Promise<ProductFeedDiscoveryResult> {
  const base   = baseUrl.replace(/\/$/, "");
  const probes = PRODUCT_PROBE_PATHS.map((path) => probeOne(base + path));
  try {
    return await firstFulfilled(probes);
  } catch {
    return { found: false, reason: "no_feed_at_product_paths" };
  }
}

// ── Strategy B: HTML alternate-link on changelog / product pages ───────────────

// Common product / changelog page paths to search for alternate-link tags.
const CHANGELOG_PAGE_PATHS = ["/changelog", "/releases", "/product-updates", "/release-notes", "/updates"];

async function discoverFromHtml(baseUrl: string, productPageUrl?: string): Promise<ProductFeedDiscoveryResult> {
  const base = baseUrl.replace(/\/$/, "");

  // If an explicit product page URL is provided, use it.
  // Otherwise, probe common changelog page paths.
  const candidates: string[] = productPageUrl
    ? [productPageUrl]
    : CHANGELOG_PAGE_PATHS.map((p) => base + p);

  for (const pageUrl of candidates) {
    try {
      const res = await withTimeout(
        fetch(pageUrl, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
          redirect: "follow",
        }),
        HTML_TIMEOUT_MS
      );
      if (!res.ok) continue;

      const html = await res.text();
      const linkTagMatches = [...html.matchAll(/<link\s[^>]*>/gi)];

      for (const match of linkTagMatches) {
        const tag = match[0];
        if (!/rel\s*=\s*["']alternate["']/i.test(tag)) continue;

        const isRss  = /type\s*=\s*["']application\/rss\+xml["']/i.test(tag);
        const isAtom = /type\s*=\s*["']application\/atom\+xml["']/i.test(tag);
        if (!isRss && !isAtom) continue;

        const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (!hrefMatch) continue;

        let href = hrefMatch[1];
        if (href.startsWith("/")) {
          const u = new URL(pageUrl);
          href = `${u.protocol}//${u.hostname}${href}`;
        } else if (!href.startsWith("http")) {
          href = new URL(href, pageUrl).href;
        }

        return {
          found:       true,
          url:         href,
          source_type: isAtom ? "release_feed" : "changelog_feed",
          method:      "alternate_link",
        };
      }
    } catch {
      continue;
    }
  }

  return { found: false, reason: "no_alternate_link_on_product_pages" };
}

// ── Strategy C: GitHub releases Atom feed ─────────────────────────────────────

// Org exclusion list: GitHub accounts that are github infrastructure, not company orgs.
const GITHUB_EXCLUDED_ORGS = new Set([
  "features", "actions", "marketplace", "apps", "enterprise",
  "organizations", "topics", "explore", "trending", "collections",
  "sponsors", "contact", "about", "pricing", "login", "join",
  "new", "settings", "notifications", "issues", "pulls",
]);

// Strip TLD and common suffixes to get a slug for repo name guessing.
const STRIP_SUFFIXES_REPO = [
  "inc", "corp", "co", "ltd", "llc", "hq", "global", "group",
  "technologies", "technology", "tech", "solutions", "software",
  "systems", "labs", "ai", "io",
];

function deriveSlug(domain: string): string {
  const base = domain
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "")
    .toLowerCase();

  for (const suffix of STRIP_SUFFIXES_REPO) {
    const stripped = base.replace(new RegExp(`[-_]?${suffix}$`, "i"), "");
    if (stripped && stripped !== base && stripped.length >= 2) return stripped;
  }
  return base;
}

// Extract GitHub org names from website HTML.
// Returns unique org names, most-frequent first (likely the company's own org).
function extractGithubOrgs(html: string): string[] {
  const orgCounts = new Map<string, number>();

  // Match href="https://github.com/{org}" and href="https://github.com/{org}/{repo}"
  const matches = [...html.matchAll(/href\s*=\s*["']https:\/\/github\.com\/([a-zA-Z0-9_-]+)/gi)];
  for (const m of matches) {
    const org = m[1].toLowerCase();
    if (GITHUB_EXCLUDED_ORGS.has(org)) continue;
    orgCounts.set(org, (orgCounts.get(org) ?? 0) + 1);
  }

  return [...orgCounts.entries()]
    .sort((a, b) => b[1] - a[1]) // most frequent first
    .map(([org]) => org);
}

// Check if a GitHub releases.atom URL contains at least one entry (non-empty feed).
// An empty releases.atom is technically valid XML but has no releases.
async function isValidReleaseFeed(url: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, "Accept": "application/atom+xml, */*" },
        redirect: "follow",
      }),
      GITHUB_TIMEOUT_MS
    );
    if (!res.ok) return false;

    // Read first 2KB to check for at least one <entry> tag
    const reader = res.body?.getReader();
    if (!reader) return false;

    let buffer = "";
    let bytesRead = 0;
    const MAX_BYTES = 2048;

    try {
      while (bytesRead < MAX_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        bytesRead += value?.length ?? 0;
        if (buffer.includes("<entry")) {
          void reader.cancel();
          return true;
        }
      }
    } finally {
      void reader.cancel();
    }

    return false;
  } catch {
    return false;
  }
}

async function discoverGithubFeed(
  baseUrl: string,
  domain:  string
): Promise<ProductFeedDiscoveryResult> {
  // Fetch homepage HTML to extract GitHub org links.
  let html = "";
  try {
    const res = await withTimeout(
      fetch(baseUrl, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
        redirect: "follow",
      }),
      HTML_TIMEOUT_MS
    );
    if (res.ok) html = await res.text();
  } catch {
    return { found: false, reason: "homepage_fetch_failed" };
  }

  const orgs = extractGithubOrgs(html);
  if (orgs.length === 0) {
    return { found: false, reason: "no_github_org_in_homepage" };
  }

  // For the top org (most-linked), build candidate repo name slugs.
  const org      = orgs[0];
  const slug     = deriveSlug(domain);

  // Ordered candidate repo names: exact slug first, then org name, then common patterns.
  const repoCandidates = [
    slug,
    org,
    `${slug}-core`,
    `${slug}-api`,
    `${org}-platform`,
  ]
    .filter((r, i, arr) => arr.indexOf(r) === i) // deduplicate
    .slice(0, MAX_GITHUB_CANDIDATES);

  // Probe candidates in order (not in parallel — we need the first valid one).
  // Single primary repo constraint: stop at first non-empty releases.atom.
  for (const repo of repoCandidates) {
    const feedUrl = `https://github.com/${org}/${repo}/releases.atom`;
    try {
      const valid = await isValidReleaseFeed(feedUrl);
      if (valid) {
        return {
          found:       true,
          url:         feedUrl,
          source_type: "github_release",
          method:      "github",
        };
      }
    } catch {
      continue;
    }
  }

  return { found: false, reason: "no_github_releases_for_derived_repos" };
}

// ── Main entry point ───────────────────────────────────────────────────────────
//
// All three strategies always run in parallel.
// Preference: alternate-link > GitHub > path probe.

export async function discoverProductFeed(
  baseUrl:         string,
  domain:          string,
  productPageUrl?: string
): Promise<ProductFeedDiscoveryResult> {
  const [probeResult, htmlResult, githubResult] = await Promise.all([
    probeProductPaths(baseUrl),
    discoverFromHtml(baseUrl, productPageUrl),
    discoverGithubFeed(baseUrl, domain),
  ]);

  // Preference order
  if (htmlResult.found)   return htmlResult;
  if (githubResult.found) return githubResult;
  if (probeResult.found)  return probeResult;

  const probeReason  = !probeResult.found  ? probeResult.reason  : "ok";
  const htmlReason   = !htmlResult.found   ? htmlResult.reason   : "ok";
  const githubReason = !githubResult.found ? githubResult.reason : "ok";
  return { found: false, reason: `probe:${probeReason} html:${htmlReason} github:${githubReason}` };
}
