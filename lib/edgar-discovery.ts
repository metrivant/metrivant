// SEC EDGAR feed discovery for US public companies.
//
// Strategy:
//   1. Search EDGAR company database by competitor name.
//   2. Extract CIK from the Atom response.
//   3. Construct and verify the EDGAR company filing Atom feed URL.
//
// SEC rate compliance:
//   - Maximum 10 requests per second.
//   - No parallel EDGAR requests — all calls in this module are sequential.
//   - User-Agent: Metrivant Regulatory Monitor (research@metrivant.com)
//
// Returns found=false when:
//   - No matching company found in EDGAR (common for private companies).
//   - CIK cannot be extracted from the response.
//   - The constructed feed returns no entries (company has no SEC filings).
//   - Any network or HTTP error.

const EDGAR_USER_AGENT  = "Metrivant Regulatory Monitor (research@metrivant.com)";
const EDGAR_SEARCH_BASE = "https://www.sec.gov/cgi-bin/browse-edgar";
const FETCH_TIMEOUT_MS  = 12_000;

// Minimum gap between sequential EDGAR requests: 110ms ≈ 9 req/sec.
// Conservative margin below the 10 req/sec hard limit.
const EDGAR_REQUEST_GAP_MS = 110;

let lastEdgarRequestAt = 0;

export interface EdgarDiscoveryResult {
  found:       boolean;
  feedUrl:     string | null;
  cik:         string | null;
  source_type: "sec_feed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEdgar(url: string): Promise<string> {
  // Enforce SEC rate limit between sequential requests.
  const gapMs = Date.now() - lastEdgarRequestAt;
  if (gapMs < EDGAR_REQUEST_GAP_MS) {
    await sleep(EDGAR_REQUEST_GAP_MS - gapMs);
  }
  lastEdgarRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:   "GET",
      headers:  { "User-Agent": EDGAR_USER_AGENT },
      signal:   controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`edgar_http_${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Extract a CIK from an EDGAR Atom/XML response body.
// Tries two patterns:
//   1. <cik>NNNNNNNNNN</cik> — direct XML element in company search Atom
//   2. CIK=NNNNNNNN           — URL parameter in entry link hrefs
function extractCikFromXml(xml: string): string | null {
  // Direct XML element (most reliable)
  const tagMatch = xml.match(/<cik>\s*(\d+)\s*<\/cik>/i);
  if (tagMatch) {
    const cik = tagMatch[1].replace(/^0+/, "") || "0";
    return cik !== "0" ? cik : null;
  }

  // CIK= URL parameter in link hrefs within entry elements
  const paramMatch = xml.match(/[&?]CIK=(\d+)/i);
  if (paramMatch) {
    const cik = paramMatch[1].replace(/^0+/, "") || "0";
    return cik !== "0" ? cik : null;
  }

  return null;
}

// Construct the EDGAR company filing Atom feed URL for a given CIK.
// type= is left empty so all filing types are returned; filtered at ingest.
function buildEdgarFeedUrl(cik: string): string {
  const padded = cik.padStart(10, "0");
  return (
    `${EDGAR_SEARCH_BASE}?action=getcompany` +
    `&CIK=${padded}` +
    `&type=` +
    `&dateb=` +
    `&owner=include` +
    `&count=40` +
    `&output=atom`
  );
}

// Discover the SEC EDGAR Atom filing feed for a US public company.
// _domain is reserved for future ticker-based lookup; not used today.
export async function discoverEdgarFeed(
  companyName: string,
  _domain:     string
): Promise<EdgarDiscoveryResult> {
  const NOT_FOUND: EdgarDiscoveryResult = {
    found:       false,
    feedUrl:     null,
    cik:         null,
    source_type: "sec_feed",
  };

  try {
    // Step 1: Search EDGAR company database by name.
    const encoded   = encodeURIComponent(companyName.trim());
    const searchUrl =
      `${EDGAR_SEARCH_BASE}?company=${encoded}` +
      `&CIK=&type=&dateb=&owner=include&count=5&search_text=&action=getcompany&output=atom`;

    const searchXml = await fetchEdgar(searchUrl);

    // Step 2: Extract CIK from the response.
    const cik = extractCikFromXml(searchXml);
    if (!cik) return NOT_FOUND;

    // Step 3: Construct and verify the filing feed.
    // A second EDGAR request is made — rate gap enforced by fetchEdgar.
    const feedUrl = buildEdgarFeedUrl(cik);
    const feedXml = await fetchEdgar(feedUrl);

    // A valid non-empty EDGAR Atom feed contains at least one <entry>.
    if (!feedXml.includes("<entry>") && !feedXml.includes("<entry ")) {
      return NOT_FOUND;
    }

    return { found: true, feedUrl, cik, source_type: "sec_feed" };
  } catch {
    // Network errors, timeouts, non-200s — all treated as not found.
    // Caller will mark regulatory_feed_unavailable.
    return NOT_FOUND;
  }
}
