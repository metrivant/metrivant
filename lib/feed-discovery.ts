// Feed URL discovery for competitor newsroom / press release feeds.
//
// Two strategies run in parallel and independently:
//   A. Path probing     — test common RSS/Atom URL patterns against the base domain
//   B. Alternate-link   — parse <link rel="alternate"> tags from the newsroom page HTML
//
// The prompt requirement: "Path probing must still run even if newsroom HTML fetch fails."
// Achieved by Promise.all: both strategies always run, results merged at the end.
//
// First valid feed wins. Alternate-link is preferred when both succeed (it is
// more explicit — the site is advertising the feed URL directly in its HTML).

// Timeout per individual probe attempt. 5s matches spec; HTML fetch gets same limit.
// Redirect chains are bounded by timeout rather than count: the Node.js Fetch API
// does not expose a per-request redirect-count cap without manual redirect following.
// A 5s timeout aborts pathological redirect chains before they cause trouble.
const PROBE_TIMEOUT_MS = 5_000;
const HTML_TIMEOUT_MS  = 5_000;

// Maximum redirects the feed probe will follow before treating the response as invalid.
// Enforced manually in probeOne() by detecting HTML responses at terminal URLs
// (a redirect chain that lands on HTML is not a feed regardless of hop count).
// Node fetch itself caps at 20 redirects; this constant documents the intent.
const MAX_PROBE_REDIRECTS = 3;

// Common feed path patterns ordered by observed prevalence across
// SaaS, enterprise (energy, defense, healthcare), and media-heavy sectors.
const PROBE_PATHS = [
  "/feed",
  "/rss",
  "/atom.xml",
  "/feed.xml",
  "/rss.xml",
  "/feeds/news",
  "/news/feed",
  "/news/rss",
  "/newsroom/rss",
  "/newsroom/feed",
  "/press/feed",
  "/press/rss",
  "/press-releases/feed",
  "/media/rss",
  "/media/feed",
  "/blog/feed",
  "/blog/rss",
  "/?feed=rss2",
];

export type FeedDiscoveryResult =
  | { found: true;  url: string; source_type: "rss" | "atom"; method: "probe" | "alternate_link" }
  | { found: false; reason: string };

function isFeedContentType(ct: string | null): boolean {
  if (!ct) return false;
  return (
    ct.includes("application/rss+xml") ||
    ct.includes("application/atom+xml") ||
    ct.includes("application/xml") ||
    ct.includes("text/xml")
  );
}

function detectSourceType(ct: string | null, url: string): "rss" | "atom" {
  if (ct?.includes("atom") || url.includes("atom")) return "atom";
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

// Equivalent to Promise.any — resolves with first non-rejected promise.
// Used instead of Promise.any because the project targets ES2020 (lib excludes ES2021).
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

// Probe a single candidate URL. Throws if the URL is not a valid feed.
// Allows firstFulfilled() to resolve on the first success across all probe attempts.
//
// Redirect cap: implemented by using redirect:"manual" and following manually up to
// MAX_PROBE_REDIRECTS hops. If the chain exceeds the cap, or if the terminal URL
// returns HTML (not a feed content-type), the probe throws "not_a_feed".
async function probeOne(candidate: string): Promise<FeedDiscoveryResult & { found: true }> {
  const userAgent = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

  // ── Manual redirect following with hop cap ──────────────────────────────────
  // Follows Location headers up to MAX_PROBE_REDIRECTS times.
  // Stops and throws if: hop limit exceeded, no Location on 3xx, or non-2xx at terminal.
  async function fetchFollowingRedirects(url: string, method: "HEAD" | "GET"): Promise<Response> {
    let current = url;
    let hops = 0;

    while (hops <= MAX_PROBE_REDIRECTS) {
      const res = await withTimeout(
        fetch(current, {
          method,
          headers: { "User-Agent": userAgent },
          redirect: "manual",
        }),
        PROBE_TIMEOUT_MS
      );

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("redirect_no_location");
        // Resolve relative redirects.
        current = location.startsWith("http") ? location : new URL(location, current).href;
        hops++;
        continue;
      }

      return res;
    }

    throw new Error("redirect_limit_exceeded");
  }

  // Try HEAD first — cheap, respects server bandwidth.
  let headStatus = 0;
  let headCt: string | null = null;
  try {
    const headRes = await fetchFollowingRedirects(candidate, "HEAD");
    headStatus = headRes.status;
    headCt = headRes.headers.get("content-type");

    if (headRes.ok && isFeedContentType(headCt)) {
      return {
        found: true,
        url: candidate,
        source_type: detectSourceType(headCt, candidate),
        method: "probe",
      };
    }
  } catch {
    throw new Error("network_error");
  }

  // Fall back to GET when HEAD returns 405 or the content-type check failed
  // (some servers misconfigure HEAD responses for feed endpoints).
  if (headStatus === 405 || (headStatus === 200 && !isFeedContentType(headCt))) {
    try {
      const getRes = await fetchFollowingRedirects(candidate, "GET");
      if (!getRes.ok) throw new Error(`http_${getRes.status}`);

      const getCt = getRes.headers.get("content-type");
      if (isFeedContentType(getCt)) {
        return {
          found: true,
          url: candidate,
          source_type: detectSourceType(getCt, candidate),
          method: "probe",
        };
      }

      // Body-sniff: read first 256 bytes to detect XML when content-type is wrong.
      // Some enterprise servers serve feeds with text/html or application/octet-stream.
      const reader = getRes.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        void reader.cancel();
        if (value) {
          const prefix = new TextDecoder().decode(value.slice(0, 256)).trimStart();
          if (prefix.startsWith("<?xml") || prefix.startsWith("<rss") || prefix.startsWith("<feed")) {
            return {
              found: true,
              url: candidate,
              source_type: detectSourceType(getCt, candidate),
              method: "probe",
            };
          }
        }
      }
    } catch {
      // GET also failed — not a feed
    }
  }

  throw new Error("not_a_feed");
}

// Strategy A: probe all common paths in parallel.
// Returns the first valid feed found, or { found: false } if none match.
async function probePaths(baseUrl: string): Promise<FeedDiscoveryResult> {
  const base = baseUrl.replace(/\/$/, "");
  const probes = PROBE_PATHS.map((path) => probeOne(base + path));
  try {
    return await firstFulfilled(probes);
  } catch {
    return { found: false, reason: "no_feed_at_common_paths" };
  }
}

// Strategy B: parse the newsroom page HTML for <link rel="alternate"> feed tags.
// Handles any attribute ordering; resolves relative hrefs against the newsroom URL.
async function discoverFromHtml(newsroomUrl: string): Promise<FeedDiscoveryResult> {
  try {
    const res = await withTimeout(
      fetch(newsroomUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      }),
      HTML_TIMEOUT_MS
    );
    if (!res.ok) return { found: false, reason: `newsroom_http_${res.status}` };

    const html = await res.text();

    // Find all <link ...> tags and inspect attributes.
    const linkTagMatches = [...html.matchAll(/<link\s[^>]*>/gi)];
    for (const match of linkTagMatches) {
      const tag = match[0];

      // Must declare rel="alternate" (case-insensitive, either quote style).
      if (!/rel\s*=\s*["']alternate["']/i.test(tag)) continue;

      const isRss  = /type\s*=\s*["']application\/rss\+xml["']/i.test(tag);
      const isAtom = /type\s*=\s*["']application\/atom\+xml["']/i.test(tag);
      if (!isRss && !isAtom) continue;

      const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!hrefMatch) continue;

      let href = hrefMatch[1];
      // Resolve relative hrefs.
      if (href.startsWith("/")) {
        const u = new URL(newsroomUrl);
        href = `${u.protocol}//${u.hostname}${href}`;
      } else if (!href.startsWith("http")) {
        href = new URL(href, newsroomUrl).href;
      }

      return {
        found: true,
        url: href,
        source_type: isAtom ? "atom" : "rss",
        method: "alternate_link",
      };
    }

    return { found: false, reason: "no_alternate_link_in_html" };
  } catch {
    return { found: false, reason: "newsroom_fetch_failed" };
  }
}

// Main entry point.
// Both strategies always run in parallel (path probing does not depend on HTML discovery).
// Alternate-link is preferred when both succeed — it is an explicit feed advertisement.
export async function discoverFeed(
  baseUrl:      string,
  newsroomUrl?: string
): Promise<FeedDiscoveryResult> {
  const htmlDiscovery: Promise<FeedDiscoveryResult> = newsroomUrl
    ? discoverFromHtml(newsroomUrl)
    : Promise.resolve({ found: false, reason: "no_newsroom_url" });

  const [probeResult, htmlResult] = await Promise.all([
    probePaths(baseUrl),
    htmlDiscovery,
  ]);

  // Prefer alternate-link (site explicitly advertised the feed URL).
  if (htmlResult.found) return htmlResult;
  if (probeResult.found) return probeResult;

  const probeReason = !probeResult.found ? probeResult.reason : "ok";
  const htmlReason  = !htmlResult.found  ? htmlResult.reason  : "ok";
  return { found: false, reason: `probe:${probeReason} html:${htmlReason}` };
}
