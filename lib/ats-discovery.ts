// ATS endpoint discovery for competitor careers feeds.
//
// Two strategies run in parallel and independently:
//   A. Slug probing   — derive slug from domain name, test known ATS API endpoints
//   B. HTML signatures — fetch careers page HTML, look for ATS embed/source patterns
//
// Supported ATS platforms:
//   Greenhouse: boards-api.greenhouse.io/v1/boards/{slug}/jobs
//   Lever:      api.lever.co/v0/postings/{slug}?mode=json
//   Ashby:      api.ashbyhq.com/posting-api/job-board/{slug}
//   Workday:    myworkdayjobs.com domains (discovery-only; no structured API)
//
// Slug derivation: domain → strip TLD + common suffixes → try as-is and
// lowercased variants. HTML discovery may yield a different slug (e.g.,
// "acme-corp" on Greenhouse while domain is "acmecorp.com").
//
// The HTML strategy is allowed here: it reads embed signatures, not job content.
// ATS parser handles all structured data extraction.

const PROBE_TIMEOUT_MS = 4_000;
const HTML_TIMEOUT_MS  = 5_000;

const USER_AGENT = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

export type AtsType = "greenhouse" | "lever" | "ashby" | "workday";

export type AtsDiscoveryResult =
  | { found: true;  atsType: AtsType; endpointUrl: string; slug: string; method: "probe" | "html_embed" }
  | { found: false; reason: string };

// ── Slug derivation ────────────────────────────────────────────────────────────

// Common suffix words that appear in company domains but not in ATS slugs.
const STRIP_SUFFIXES = [
  "inc", "corp", "co", "ltd", "llc", "hq", "global", "group",
  "technologies", "technology", "tech", "solutions", "software",
  "systems", "labs", "ai", "io",
];

// Derive candidate slugs from a base domain (e.g., "acmecorp.com").
// Returns an ordered list of slug candidates to try.
function deriveSlugs(domain: string): string[] {
  // Strip www prefix and TLD
  const base = domain
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "") // strip .com, .io, .co.uk, etc.
    .toLowerCase();

  const slugs: string[] = [base];

  // Try with hyphens replacing dots (e.g., "acme.systems" → "acme-systems")
  const hyphenated = base.replace(/\./g, "-");
  if (hyphenated !== base) slugs.push(hyphenated);

  // Try stripping known suffix words
  for (const suffix of STRIP_SUFFIXES) {
    const stripped = base
      .replace(new RegExp(`[-_]?${suffix}$`, "i"), "")
      .replace(new RegExp(`^${suffix}[-_]?`, "i"), "");
    if (stripped && stripped !== base && stripped.length >= 2) {
      slugs.push(stripped);
    }
  }

  // Deduplicate while preserving order
  return [...new Set(slugs)].filter(Boolean);
}

// ── ATS endpoint builders ──────────────────────────────────────────────────────

function greenhouseUrl(slug: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
}

function leverUrl(slug: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
}

function ashbyUrl(slug: string): string {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
}

// ── Single ATS endpoint probe ──────────────────────────────────────────────────

// Returns true if the endpoint responds with valid JSON and a non-empty jobs array.
// Each ATS has a slightly different response shape.
async function probeEndpoint(url: string, atsType: AtsType): Promise<boolean> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
    redirect: "follow",
  });

  if (!res.ok) return false;

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json") && !ct.includes("text/json")) {
    // Some ATS serve JSON without correct content-type; try to parse anyway
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return false;
  }

  // Validate response shape per ATS
  if (atsType === "greenhouse") {
    // { "jobs": [...], "meta": { "total": N } }
    return (
      typeof json === "object" &&
      json !== null &&
      "jobs" in json &&
      Array.isArray((json as Record<string, unknown>).jobs)
    );
  }

  if (atsType === "lever") {
    // Direct array of postings
    return Array.isArray(json);
  }

  if (atsType === "ashby") {
    // { "jobPostings": [...] } or { "jobs": [...] }
    if (typeof json !== "object" || json === null) return false;
    const j = json as Record<string, unknown>;
    return Array.isArray(j.jobPostings) || Array.isArray(j.jobs);
  }

  return false;
}

// ── Strategy A: slug probing ───────────────────────────────────────────────────

type AtsProbeAttempt = {
  atsType:     AtsType;
  slug:        string;
  endpointUrl: string;
};

async function probeSlug(attempt: AtsProbeAttempt): Promise<AtsDiscoveryResult & { found: true }> {
  const valid = await probeEndpoint(attempt.endpointUrl, attempt.atsType);
  if (!valid) throw new Error("not_an_ats_endpoint");
  return {
    found:       true,
    atsType:     attempt.atsType,
    endpointUrl: attempt.endpointUrl,
    slug:        attempt.slug,
    method:      "probe",
  };
}

// Equivalent to Promise.any (ES2020-compatible)
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

async function probeSlugs(domain: string): Promise<AtsDiscoveryResult> {
  const slugs = deriveSlugs(domain);

  // Build all (atsType × slug) combinations
  const attempts: AtsProbeAttempt[] = [];
  for (const slug of slugs) {
    attempts.push({ atsType: "greenhouse", slug, endpointUrl: greenhouseUrl(slug) });
    attempts.push({ atsType: "lever",      slug, endpointUrl: leverUrl(slug)      });
    attempts.push({ atsType: "ashby",      slug, endpointUrl: ashbyUrl(slug)      });
  }

  const probes = attempts.map((a) =>
    withTimeout(probeSlug(a), PROBE_TIMEOUT_MS)
  );

  try {
    return await firstFulfilled(probes);
  } catch {
    return { found: false, reason: "no_ats_endpoint_at_derived_slugs" };
  }
}

// ── Strategy B: HTML embed signature detection ─────────────────────────────────

// Signatures indicating a specific ATS is embedded in the careers page.
// We look for script src patterns and data attributes — not job content.

const ATS_SIGNATURES: Array<{ atsType: AtsType; patterns: RegExp[] }> = [
  {
    atsType: "greenhouse",
    patterns: [
      /boards\.greenhouse\.io\/embed\/job_board\/for\?([^"'&\s]+)/i,
      /greenhouse\.io\/embed/i,
      /"([a-z0-9_-]{2,64})"[^>]*greenhouse/i,
      /Grnhse\.Iframe\.load\(\s*['"]([^'"]+)['"]/i,
    ],
  },
  {
    atsType: "lever",
    patterns: [
      /jobs\.lever\.co\/([a-z0-9_-]{2,64})/i,
      /lever\.co\/embed\/([a-z0-9_-]{2,64})/i,
    ],
  },
  {
    atsType: "ashby",
    patterns: [
      /jobs\.ashbyhq\.com\/([a-z0-9_-]{2,64})/i,
      /ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_-]{2,64})/i,
    ],
  },
  {
    atsType: "workday",
    patterns: [
      /([a-z0-9]+)\.myworkdayjobs\.com/i,
      /myworkdayjobs\.com/i,
    ],
  },
];

// Greenhouse embed slugs may appear as query parameters
function extractGreenhouseSlug(html: string): string | null {
  // boards.greenhouse.io/embed/job_board/for?for=SLUG
  const forMatch = html.match(/boards\.greenhouse\.io\/embed\/job_board\/for\?(?:[^"']*&)?for=([a-z0-9_-]+)/i);
  if (forMatch) return forMatch[1];

  // boards.greenhouse.io/SLUG
  const boardMatch = html.match(/boards\.greenhouse\.io\/([a-z0-9_-]{2,64})/i);
  if (boardMatch) return boardMatch[1];

  // Grnhse.Iframe.load('SLUG')
  const loadMatch = html.match(/Grnhse\.Iframe\.load\(\s*['"]([a-z0-9_-]+)['"]/i);
  if (loadMatch) return loadMatch[1];

  return null;
}

function extractLeverSlug(html: string): string | null {
  const m = html.match(/(?:jobs\.lever\.co|lever\.co\/embed)\/([a-z0-9_-]{2,64})/i);
  return m ? m[1] : null;
}

function extractAshbySlug(html: string): string | null {
  const m = html.match(/(?:jobs\.ashbyhq\.com|ashbyhq\.com\/posting-api\/job-board)\/([a-z0-9_-]{2,64})/i);
  return m ? m[1] : null;
}

function extractWorkdaySlug(html: string): string | null {
  const m = html.match(/([a-z0-9]+)\.myworkdayjobs\.com/i);
  return m ? m[1] : null;
}

async function discoverFromHtml(careersUrl: string): Promise<AtsDiscoveryResult> {
  let html: string;
  try {
    const res = await withTimeout(
      fetch(careersUrl, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      }),
      HTML_TIMEOUT_MS
    );
    if (!res.ok) return { found: false, reason: `careers_page_http_${res.status}` };
    html = await res.text();
  } catch {
    return { found: false, reason: "careers_page_fetch_failed" };
  }

  // Check each ATS signature in priority order
  for (const { atsType } of ATS_SIGNATURES) {
    let slug: string | null = null;

    if (atsType === "greenhouse") slug = extractGreenhouseSlug(html);
    else if (atsType === "lever")  slug = extractLeverSlug(html);
    else if (atsType === "ashby")  slug = extractAshbySlug(html);
    else if (atsType === "workday") slug = extractWorkdaySlug(html);

    if (!slug) continue;

    // For Workday, we can't verify via JSON API — return discovery-only result
    if (atsType === "workday") {
      return {
        found:       true,
        atsType:     "workday",
        endpointUrl: `https://${slug}.myworkdayjobs.com/`,
        slug,
        method:      "html_embed",
      };
    }

    // For structured ATS, verify the discovered slug via the API
    let endpointUrl: string;
    if (atsType === "greenhouse") endpointUrl = greenhouseUrl(slug);
    else if (atsType === "lever") endpointUrl = leverUrl(slug);
    else                          endpointUrl = ashbyUrl(slug);

    try {
      const valid = await withTimeout(
        probeEndpoint(endpointUrl, atsType),
        PROBE_TIMEOUT_MS
      );
      if (valid) {
        return { found: true, atsType, endpointUrl, slug, method: "html_embed" };
      }
    } catch {
      // Probe timed out or failed — continue to next signature
    }
  }

  return { found: false, reason: "no_ats_embed_in_html" };
}

// ── Main entry point ───────────────────────────────────────────────────────────
//
// Both strategies always run in parallel.
// HTML embed is preferred when both succeed — it yields an exact slug the
// company intentionally configured, which is more reliable than derivation.

export async function discoverAts(
  domain:     string,
  careersUrl?: string
): Promise<AtsDiscoveryResult> {
  const htmlDiscovery: Promise<AtsDiscoveryResult> = careersUrl
    ? discoverFromHtml(careersUrl)
    : Promise.resolve({ found: false, reason: "no_careers_url" });

  const [probeResult, htmlResult] = await Promise.all([
    probeSlugs(domain),
    htmlDiscovery,
  ]);

  // Prefer HTML embed (explicitly configured slug)
  if (htmlResult.found) return htmlResult;
  if (probeResult.found) return probeResult;

  const probeReason = !probeResult.found ? probeResult.reason : "ok";
  const htmlReason  = !htmlResult.found  ? htmlResult.reason  : "ok";
  return { found: false, reason: `probe:${probeReason} html:${htmlReason}` };
}
