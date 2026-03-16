// Investor / IR feed URL discovery.
//
// Three strategies run in parallel and independently:
//   A. Path probing        — common investor-relations RSS/Atom URL patterns
//   B. IR platform probing — known IR hosting providers (Q4, q4cdn) with derived slug
//   C. Alternate-link      — <link rel="alternate"> in investor relations page HTML
//
// The prompt requirement: "Path probing must run even if HTML fetch fails."
// Achieved by Promise.all across all three strategies.
//
// Preference order when multiple strategies succeed:
//   1. Alternate-link  (site explicitly advertised the feed URL)
//   2. IR platform     (known hosting pattern, high reliability)
//   3. Path probe      (generic)

const PROBE_TIMEOUT_MS   = 3_000;
const HTML_TIMEOUT_MS    = 5_000;
const PLATFORM_TIMEOUT_MS = 4_000;

const USER_AGENT = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

// Investor-relations-specific feed path patterns, ordered by prevalence.
const INVESTOR_PROBE_PATHS = [
  "/investors/rss",
  "/investors/feed",
  "/investors/news/rss",
  "/investor-relations/rss",
  "/investor-relations/feed",
  "/investor-relations/news/rss",
  "/ir/rss",
  "/ir/feed",
  "/ir/news/rss",
  "/press-releases/rss",
  "/press-releases/feed",
  "/news/rss",
  "/news/feed",
  "/feed",
  "/rss",
  "/atom.xml",
  "/?feed=rss2",
];

export type InvestorFeedDiscoveryResult =
  | { found: true;  url: string; source_type: "investor_rss" | "investor_atom"; method: "probe" | "ir_platform" | "alternate_link" }
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

function detectSourceType(ct: string | null, url: string): "investor_rss" | "investor_atom" {
  if (ct?.includes("atom") || url.includes("atom")) return "investor_atom";
  return "investor_rss";
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

// ── Single URL probe ───────────────────────────────────────────────────────────

async function probeOne(
  candidate: string,
  method: "probe" | "ir_platform"
): Promise<InvestorFeedDiscoveryResult & { found: true }> {
  // HEAD first
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
      return { found: true, url: candidate, source_type: detectSourceType(headCt, candidate), method };
    }
  } catch {
    throw new Error("network_error");
  }

  // GET fallback when HEAD returns 405 or mismatched content-type
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
        return { found: true, url: candidate, source_type: detectSourceType(getCt, candidate), method };
      }

      // Body-sniff: detect XML when content-type is wrong
      const reader = getRes.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        void reader.cancel();
        if (value) {
          const prefix = new TextDecoder().decode(value.slice(0, 256)).trimStart();
          if (prefix.startsWith("<?xml") || prefix.startsWith("<rss") || prefix.startsWith("<feed")) {
            return { found: true, url: candidate, source_type: detectSourceType(getCt, candidate), method };
          }
        }
      }
    } catch {
      // GET also failed
    }
  }

  throw new Error("not_a_feed");
}

// ── Strategy A: investor path probing ─────────────────────────────────────────

async function probeInvestorPaths(baseUrl: string): Promise<InvestorFeedDiscoveryResult> {
  const base   = baseUrl.replace(/\/$/, "");
  const probes = INVESTOR_PROBE_PATHS.map((path) => probeOne(base + path, "probe"));
  try {
    return await firstFulfilled(probes);
  } catch {
    return { found: false, reason: "no_feed_at_investor_paths" };
  }
}

// ── Strategy B: IR platform probing ───────────────────────────────────────────
// Known IR hosting providers: Q4 Web (q4web.com, q4cdn.com)
// Slug derived from the company domain (e.g., "acme.com" → "acme").

const STRIP_SUFFIXES = [
  "inc", "corp", "co", "ltd", "llc", "hq", "global", "group",
  "technologies", "technology", "tech", "solutions", "software",
  "systems", "labs", "ai", "io",
];

function deriveSlug(domain: string): string {
  const base = domain
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "")
    .toLowerCase();

  for (const suffix of STRIP_SUFFIXES) {
    const stripped = base.replace(new RegExp(`[-_]?${suffix}$`, "i"), "");
    if (stripped && stripped !== base && stripped.length >= 2) return stripped;
  }
  return base;
}

async function probeIrPlatforms(domain: string): Promise<InvestorFeedDiscoveryResult> {
  const slug = deriveSlug(domain);

  // Q4 Web investor hosting
  const platformCandidates = [
    `https://${slug}.q4web.com/rss/`,
    `https://${slug}.q4web.com/feed/`,
    `https://${slug}.q4cdn.com/rss/`,
  ];

  const probes = platformCandidates.map((url) =>
    withTimeout(probeOne(url, "ir_platform"), PLATFORM_TIMEOUT_MS)
  );

  try {
    return await firstFulfilled(probes);
  } catch {
    return { found: false, reason: "no_feed_at_ir_platforms" };
  }
}

// ── Strategy C: HTML alternate-link ───────────────────────────────────────────
// Fetch the investor relations landing page and look for <link rel="alternate">.

async function discoverFromIrHtml(irPageUrl: string): Promise<InvestorFeedDiscoveryResult> {
  try {
    const res = await withTimeout(
      fetch(irPageUrl, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept":     "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      }),
      HTML_TIMEOUT_MS
    );
    if (!res.ok) return { found: false, reason: `ir_page_http_${res.status}` };

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
        const u = new URL(irPageUrl);
        href = `${u.protocol}//${u.hostname}${href}`;
      } else if (!href.startsWith("http")) {
        href = new URL(href, irPageUrl).href;
      }

      return {
        found:       true,
        url:         href,
        source_type: isAtom ? "investor_atom" : "investor_rss",
        method:      "alternate_link",
      };
    }

    return { found: false, reason: "no_alternate_link_in_ir_html" };
  } catch {
    return { found: false, reason: "ir_page_fetch_failed" };
  }
}

// ── IR page URL derivation ─────────────────────────────────────────────────────
// Try common investor relations page paths to discover the IR landing URL.
// Used when no explicit irPageUrl is provided at onboarding.

const IR_PAGE_PATHS = [
  "/investor-relations",
  "/investors",
  "/ir",
  "/investor",
];

async function findIrPageUrl(baseUrl: string): Promise<string | null> {
  const base = baseUrl.replace(/\/$/, "");
  for (const path of IR_PAGE_PATHS) {
    const candidate = base + path;
    try {
      const res = await withTimeout(
        fetch(candidate, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
          redirect: "follow",
        }),
        PROBE_TIMEOUT_MS
      );
      if (res.ok) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

// ── Main entry point ───────────────────────────────────────────────────────────
//
// All three strategies always run in parallel.
// Alternate-link is preferred → IR platform → path probe.
// HTML fetch failure does NOT block path probing or platform probing.

export async function discoverInvestorFeed(
  baseUrl:    string,
  domain:     string,
  irPageUrl?: string
): Promise<InvestorFeedDiscoveryResult> {
  // Resolve IR page URL if not explicitly provided
  const resolvedIrUrl: Promise<string | null> = irPageUrl
    ? Promise.resolve(irPageUrl)
    : findIrPageUrl(baseUrl);

  const htmlDiscovery: Promise<InvestorFeedDiscoveryResult> = resolvedIrUrl.then((url) =>
    url ? discoverFromIrHtml(url) : Promise.resolve({ found: false, reason: "no_ir_page_found" })
  );

  const [probeResult, platformResult, htmlResult] = await Promise.all([
    probeInvestorPaths(baseUrl),
    probeIrPlatforms(domain),
    htmlDiscovery,
  ]);

  // Preference: alternate-link > IR platform > path probe
  if (htmlResult.found)     return htmlResult;
  if (platformResult.found) return platformResult;
  if (probeResult.found)    return probeResult;

  const probeReason    = !probeResult.found    ? probeResult.reason    : "ok";
  const platformReason = !platformResult.found ? platformResult.reason : "ok";
  const htmlReason     = !htmlResult.found     ? htmlResult.reason     : "ok";
  return { found: false, reason: `probe:${probeReason} platform:${platformReason} html:${htmlReason}` };
}
