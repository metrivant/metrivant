// ── URL category guard ────────────────────────────────────────────────────────
//
// Semantic rejection layer applied after HTTP validation passes, before a URL
// is committed to monitored_pages.
//
// Catches category-invalid URLs that return HTTP 200 but are the wrong kind
// of page: sitemaps, legal pages, product tools, single posts, locale homepages,
// API endpoints, and ATS-domain allowlisting for careers.
//
// Pure string matching — no extra HTTP calls.

export type RejectReason =
  | "invalid_url"
  | "file_extension"
  | "legal_page"
  | "single_post"
  | "deep_link"
  | "query_url"
  | "locale_only"
  | "non_content_slug"
  | "subdomain_mismatch"
  | "too_short"
  | "api_or_data";

export type GuardResult =
  | { reject: false }
  | { reject: true; reason: RejectReason };

// ── ATS domain allowlist ───────────────────────────────────────────────────────
// URLs on these domains are always valid career page candidates regardless of
// path structure. Extensible — add new ATS platforms here as needed.

const ATS_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "ashbyhq.com",
  "bamboohr.com",
  "icims.com",
  "smartrecruiters.com",
  "myworkdayjobs.com",
];

function isAtsDomain(hostname: string): boolean {
  return (
    ATS_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d)) ||
    /^(jobs|careers)\./.test(hostname)
  );
}

// ── Blocked terminal slugs for content pages ───────────────────────────────────
// Final path segment ONLY. These indicate non-content destinations.

const NON_CONTENT_SLUGS = new Set([
  "demo", "signup", "login", "register",
  "pricing", "contact", "support", "help",
  "docs", "developers", "partners",
  "about", "team",
  "free-tools", "tools", "calculator",
  "compare", "alternatives", "vc-database",
]);

// ── Blocked subdomain prefixes for content pages ───────────────────────────────

const BLOCKED_SUBDOMAIN_PREFIXES = ["support", "status", "docs", "api"];

// ── URL shortener domains ──────────────────────────────────────────────────────

const SHORTENER_DOMAINS = new Set(["bit.ly", "t.co", "ow.ly"]);

// ── Legal path segments (exact segment match) ──────────────────────────────────

const LEGAL_SEGMENTS = new Set(["privacy", "terms", "legal", "cookie", "gdpr", "compliance"]);

// ── Categories that require content-page rules ─────────────────────────────────

const CONTENT_CATEGORIES = new Set(["newsroom", "blog_or_articles", "changelog"]);

// ── Main guard ─────────────────────────────────────────────────────────────────

export function rejectPageUrl(rawUrl: string, category: string): GuardResult {
  // ── Parse guard ─────────────────────────────────────────────────────────────
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { reject: true, reason: "invalid_url" };
  }

  const hostname = u.hostname.toLowerCase();
  const segments = u.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  const terminal = segments[segments.length - 1] ?? "";

  // ── Generic rules (all categories) ─────────────────────────────────────────

  // URL shorteners
  if (SHORTENER_DOMAINS.has(hostname)) {
    return { reject: true, reason: "invalid_url" };
  }

  // File extensions (.xml, .json)
  if (/\.(xml|json)(\?.*)?$/i.test(rawUrl)) {
    return { reject: true, reason: "file_extension" };
  }

  // API / data endpoints
  if (/\/(api|graphql)(\/|$)/i.test(u.pathname) || /\.json(\?|$)/.test(u.pathname)) {
    return { reject: true, reason: "api_or_data" };
  }

  // Legal path segments — exact match OR hyphenated variant (privacy-policy, terms-of-service, etc.)
  if (segments.some((s) => {
    const lower = s.toLowerCase();
    return LEGAL_SEGMENTS.has(lower) || Array.from(LEGAL_SEGMENTS).some((l) => lower.startsWith(l + "-"));
  })) {
    return { reject: true, reason: "legal_page" };
  }

  // Query strings — dynamic pages are unreliable for change detection
  if (u.search) {
    return { reject: true, reason: "query_url" };
  }

  // ── Careers category ────────────────────────────────────────────────────────
  // ATS domains are always valid. Non-ATS careers URLs pass generic rules only.
  if (category === "careers") {
    if (isAtsDomain(hostname)) return { reject: false };
    // Non-ATS careers URLs: generic rules already passed above — allow.
    return { reject: false };
  }

  // ── Content categories (newsroom, blog_or_articles, changelog) ──────────────
  if (CONTENT_CATEGORIES.has(category)) {
    // Blocked subdomains (support.*, status.*, docs.*, api.*)
    const subdomain = hostname.split(".")[0] ?? "";
    if (BLOCKED_SUBDOMAIN_PREFIXES.some((p) => subdomain.startsWith(p))) {
      return { reject: true, reason: "subdomain_mismatch" };
    }

    // Empty path (root domain committed as content page)
    if (segments.length === 0) {
      return { reject: true, reason: "too_short" };
    }

    // Locale-only path: /us/ /uk/ /en/ /en-us/ — homepage variant, not press
    if (segments.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])) {
      return { reject: true, reason: "locale_only" };
    }

    // Year-in-path → dated single article
    if (segments.some((s) => /^\d{4}$/.test(s))) {
      return { reject: true, reason: "single_post" };
    }

    // Final segment with >5 hyphens → long article slug
    if (terminal.split("-").length > 6) {
      return { reject: true, reason: "single_post" };
    }

    // Deep blog path — 3+ segments → specific article, not section index
    // e.g. /business/blog/rush-order-tees-affirm (3 segments) → rejected
    // e.g. /business/blog (2 segments)             → allowed
    if (category === "blog_or_articles" && segments.length >= 3) {
      return { reject: true, reason: "deep_link" };
    }

    // Non-content terminal slugs — final segment only
    if (NON_CONTENT_SLUGS.has(terminal.toLowerCase())) {
      return { reject: true, reason: "non_content_slug" };
    }
  }

  return { reject: false };
}
