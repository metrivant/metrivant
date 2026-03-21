import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { isPrivateUrl } from "../lib/url-safety";

const FETCH_TIMEOUT_MS          = 6500;
const GLOBAL_CONCURRENCY        = 8;
const DOMAIN_CONCURRENCY        = 1;
const INVOCATION_BUDGET_MS      = 25000;
const JITTER_MIN_MS             = 100;
const JITTER_MAX_MS             = 400;
const DOMAIN_COOLDOWN_THRESHOLD = 2;
const DOMAIN_MIN_DELAY_MS       = 800;   // Task 3: minimum gap between requests to the same domain
const MAX_HTML_SIZE             = 1024 * 1024;
const CONSECUTIVE_BAD_THRESHOLD = 5;

// ── Task 4: Browser-like User-Agent pool ──────────────────────────────────────
// Rotates across realistic browser UAs to avoid presenting a bare Node.js
// fingerprint. Not intended to deceive WAFs — only to avoid trivial bot blocks.

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function getBrowserHeaders(): Record<string, string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    "User-Agent":                ua,
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language":           "en-US,en;q=0.9",
    "Cache-Control":             "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site":            "none",
    "Sec-Fetch-Mode":            "navigate",
    "Sec-Fetch-Dest":            "document",
  };
}

// ── Task 2: Fetch failure classification ──────────────────────────────────────

type FetchFailureClass =
  | "http_403"
  | "http_429"
  | "http_5xx"
  | "timeout"
  | "redirect_loop"
  | "challenge_page"
  | "empty_body"
  | "soft_login_or_soft_404"
  | "stale_content"
  | "ssrf_blocked"
  | "unknown_fetch_failure";

type FetchOutcome =
  | { ok: true;  html: string; httpStatus: 200 }
  | { ok: false; httpStatus: number; failureClass: FetchFailureClass };

// Task 1: Page health state set by the fetch stage
type PageHealthState = "healthy" | "blocked" | "challenge" | "unresolved";

// ── Challenge / soft-failure detection ────────────────────────────────────────
// Scan response body for known WAF and bot-challenge signatures.

const CHALLENGE_SIGNATURES = [
  "cf-browser-verification",
  "challenge-platform",
  "cf_chl_opt",
  "checking your browser",
  "verify you are human",
  "captcha",
  "akamai",
  "_akat",
];

const LOGIN_SIGNATURES = [
  "sign in to continue",
  "log in to view",
  "please log in",
  "login required",
  "you must be signed in",
];

function detectChallengePage(html: string): boolean {
  const lower = html.toLowerCase();
  return CHALLENGE_SIGNATURES.some((s) => lower.includes(s));
}

function detectSoftLoginOrSoft404(html: string, visibleLength: number): boolean {
  if (visibleLength < 300) {
    const lower = html.toLowerCase();
    return LOGIN_SIGNATURES.some((s) => lower.includes(s));
  }
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonitoredPage {
  id: string;
  url: string;
  health_state?: string;
}

interface MonitoredPageRow {
  id: string;
  url: string;
  health_state?: string;
}

interface UrlResult {
  succeeded: boolean;
  failed: boolean;
  inserted: number;
  skippedDuplicates: number;
  skippedBudget: boolean;
  skippedCooldown: boolean;
  triggeredCooldown: boolean;
  nonFullPageIds: string[];
  healthStateUpdates: Array<{ pageId: string; healthState: PageHealthState }>;
  lastFetchedPageIds: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createSemaphore(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return function acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        running++;
        fn().then(
          (value) => { running--; drain(); resolve(value); },
          (err)   => { running--; drain(); reject(err);   }
        );
      };
      const drain = () => { if (queue.length > 0) queue.shift()!(); };
      if (running < max) run();
      else queue.push(run);
    });
  };
}

function getVisibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

// ── Task 2 + Task 4: Classified fetch with browser-like headers ───────────────

async function fetchWithClassification(url: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: getBrowserHeaders(),
      redirect: "follow",
    });

    if (!response.ok) {
      const s = response.status;
      const failureClass: FetchFailureClass =
        s === 403 ? "http_403" :
        s === 429 ? "http_429" :
        s >= 500  ? "http_5xx" :
        "unknown_fetch_failure";
      return { ok: false, httpStatus: s, failureClass };
    }

    let html = await response.text();

    if (!html || html.trim().length === 0) {
      return { ok: false, httpStatus: 200, failureClass: "empty_body" };
    }

    if (html.length > MAX_HTML_SIZE) {
      html = html.slice(0, MAX_HTML_SIZE);
    }

    if (detectChallengePage(html)) {
      return { ok: false, httpStatus: 200, failureClass: "challenge_page" };
    }

    const visibleLength = getVisibleTextLength(html);
    if (detectSoftLoginOrSoft404(html, visibleLength)) {
      return { ok: false, httpStatus: 200, failureClass: "soft_login_or_soft_404" };
    }

    // ── Stale-content heuristic ────────────────────────────────────────────
    // CDN-cached or archived content can generate false diffs. When freshness
    // headers indicate content is >7 days old, classify as stale.
    const STALE_THRESHOLD_SEC = 7 * 24 * 60 * 60;
    const ageHeader = response.headers.get("age");
    if (ageHeader) {
      const ageSec = parseInt(ageHeader, 10);
      if (!isNaN(ageSec) && ageSec > STALE_THRESHOLD_SEC) {
        return { ok: false, httpStatus: 200, failureClass: "stale_content" };
      }
    }
    const lastModified = response.headers.get("last-modified");
    if (lastModified) {
      const lmTime = new Date(lastModified).getTime();
      if (!isNaN(lmTime) && (Date.now() - lmTime) > STALE_THRESHOLD_SEC * 1000) {
        return { ok: false, httpStatus: 200, failureClass: "stale_content" };
      }
    }

    return { ok: true, html, httpStatus: 200 };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failureClass: FetchFailureClass =
      msg.includes("AbortError") || msg.includes("This operation was aborted") ? "timeout" :
      msg.includes("redirect count exceeded") ? "redirect_loop" :
      "unknown_fetch_failure";
    return { ok: false, httpStatus: 0, failureClass };
  } finally {
    clearTimeout(timeout);
  }
}

// ── ScrapingBee fallback (challenge-page bypass via premium proxy) ─────────────

async function fetchWithScrapingBee(url: string): Promise<FetchOutcome> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return { ok: false, httpStatus: 0, failureClass: "unknown_fetch_failure" };
  try {
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&render_js=false&premium_proxy=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(sbUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, httpStatus: res.status, failureClass: "unknown_fetch_failure" };
    let html = await res.text();
    if (html.length > MAX_HTML_SIZE) html = html.slice(0, MAX_HTML_SIZE);
    if (detectChallengePage(html)) return { ok: false, httpStatus: 200, failureClass: "challenge_page" };
    return { ok: true, html, httpStatus: 200 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, httpStatus: 0, failureClass: msg.includes("AbortError") ? "timeout" : "unknown_fetch_failure" };
  }
}

// ── Per-URL processor ─────────────────────────────────────────────────────────

async function processUrl(
  url: string,
  hostname: string,
  groupedPages: MonitoredPage[],
  invocationStart: number,
  domainFailureCounts: Map<string, number>,
  lastFetchTimeByDomain: Map<string, number>,   // Task 3: domain pacing
  latestHashMap: Map<string, string>,
  runId: string,
): Promise<UrlResult> {
  const empty: UrlResult = {
    succeeded: false, failed: false, inserted: 0, skippedDuplicates: 0,
    skippedBudget: false, skippedCooldown: false, triggeredCooldown: false,
    nonFullPageIds: [], healthStateUpdates: [], lastFetchedPageIds: [],
  };

  if (Date.now() - invocationStart > INVOCATION_BUDGET_MS) {
    for (const page of groupedPages) {
      void recordEvent({ run_id: runId, stage: "snapshot", status: "skipped", monitored_page_id: page.id, duration_ms: 0, metadata: { skip_reason: "budget_exhausted" } });
    }
    return { ...empty, skippedBudget: true };
  }

  if ((domainFailureCounts.get(hostname) ?? 0) >= DOMAIN_COOLDOWN_THRESHOLD) {
    return {
      ...empty,
      skippedCooldown: true,
      healthStateUpdates: groupedPages.map((page) => ({ pageId: page.id, healthState: "blocked" as PageHealthState })),
    };
  }

  // ── Task 3: Domain minimum delay ───────────────────────────────────────────
  // The domain semaphore ensures this runs serially per domain, so the check
  // is race-free. Enforce at least DOMAIN_MIN_DELAY_MS between fetches.
  const lastFetch = lastFetchTimeByDomain.get(hostname) ?? 0;
  const sinceLastFetch = Date.now() - lastFetch;
  if (sinceLastFetch < DOMAIN_MIN_DELAY_MS) {
    await sleep(DOMAIN_MIN_DELAY_MS - sinceLastFetch);
  }

  await sleep(randomInt(JITTER_MIN_MS, JITTER_MAX_MS));

  // SSRF guard: block private/internal URLs before making any HTTP request.
  if (isPrivateUrl(url)) {
    for (const page of groupedPages) {
      void recordEvent({ run_id: runId, stage: "snapshot", status: "failure", monitored_page_id: page.id, duration_ms: 0, metadata: { failure_class: "ssrf_blocked" } });
    }
    return { ...empty, failed: true, healthStateUpdates: groupedPages.map((p) => ({ pageId: p.id, healthState: "blocked" as PageHealthState })) };
  }

  const elapsed = startTimer();
  let outcome = await fetchWithClassification(url);

  // Record when we fetched this domain for the next request's delay check.
  lastFetchTimeByDomain.set(hostname, Date.now());

  // ScrapingBee fallback: retry challenge-blocked pages via premium proxy.
  // Only fires when key is present — safe no-op without it.
  if (!outcome.ok && outcome.failureClass === "challenge_page" && process.env.SCRAPINGBEE_API_KEY) {
    outcome = await fetchWithScrapingBee(url);
  }

  // ── Failure path ───────────────────────────────────────────────────────────
  if (!outcome.ok) {
    const { failureClass, httpStatus } = outcome;

    const triggersCooldown =
      failureClass === "http_403" ||
      failureClass === "http_429" ||
      failureClass === "challenge_page" ||
      failureClass === "timeout";

    if (triggersCooldown) {
      domainFailureCounts.set(hostname, (domainFailureCounts.get(hostname) ?? 0) + 1);
    }

    // Task 1: map failure class to health state
    const healthState: PageHealthState =
      failureClass === "http_403" || failureClass === "http_429" ? "blocked" :
      failureClass === "challenge_page" ? "challenge" :
      "unresolved";

    const healthStateUpdates = groupedPages.map((page) => ({ pageId: page.id, healthState }));

    for (const page of groupedPages) {
      void recordEvent({
        run_id: runId, stage: "snapshot", status: "failure",
        monitored_page_id: page.id, duration_ms: elapsed(),
        metadata: { http_status: httpStatus, failure_class: failureClass },
      });
    }

    const isExpectedFailure =
      failureClass !== "unknown_fetch_failure";

    if (!isExpectedFailure) {
      Sentry.captureMessage("unexpected_fetch_failure", {
        level: "warning",
        extra: { url, failureClass, httpStatus },
      });
    }

    return { ...empty, failed: true, triggeredCooldown: triggersCooldown, healthStateUpdates };
  }

  // ── Success path ───────────────────────────────────────────────────────────
  const { html: rawHtml } = outcome;

  const textElementCount =
    (rawHtml.match(/<\/p>/gi)?.length ?? 0) +
    (rawHtml.match(/<\/h1>/gi)?.length ?? 0) +
    (rawHtml.match(/<\/h2>/gi)?.length ?? 0) +
    (rawHtml.match(/<\/li>/gi)?.length ?? 0);

  const fetchQuality: "full" | "shell" | "js_rendered" =
    textElementCount < 3                ? "shell" :
    getVisibleTextLength(rawHtml) < 500 ? "js_rendered" :
    "full";

  if (fetchQuality !== "full") {
    Sentry.captureMessage(
      fetchQuality === "shell" ? "fetch_shell_detected" : "fetch_js_rendered_detected",
      {
        level: "warning",
        extra: {
          url,
          fetch_quality: fetchQuality,
          text_element_count: textElementCount,
          visible_text_length: fetchQuality === "js_rendered"
            ? getVisibleTextLength(rawHtml)
            : undefined,
        },
      }
    );
  }

  const contentHash = hashContent(rawHtml);
  const fetchedAt   = new Date().toISOString();

  let inserted = 0;
  let skippedDuplicates = 0;
  const nonFullPageIds: string[] = [];
  const healthStateUpdates: Array<{ pageId: string; healthState: PageHealthState }> = [];
  const lastFetchedPageIds: string[] = [];

  for (const page of groupedPages) {
    const isDuplicate = latestHashMap.get(page.id) === contentHash;

    if (isDuplicate) {
      skippedDuplicates += 1;
      lastFetchedPageIds.push(page.id);
      // Don't update health_state for unchanged pages — preserve their current state.
      // Exception: if the page is stuck in "unresolved" (e.g. a prior health update was
      // lost), a successful fetch proves it's reachable — heal it now.
      if (page.health_state === "unresolved") {
        healthStateUpdates.push({ pageId: page.id, healthState: "healthy" });
      }
      void recordEvent({ run_id: runId, stage: "snapshot", status: "skipped", monitored_page_id: page.id, duration_ms: elapsed(), metadata: { http_status: 200, content_length: rawHtml.length } });
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await supabase
      .from("snapshots")
      .insert({
        monitored_page_id: page.id,
        fetched_at: fetchedAt,
        raw_html: rawHtml,
        extracted_text: null,
        content_hash: contentHash,
        status: "fetched",
        sections_extracted: false,
        is_duplicate: false,
        fetch_quality: fetchQuality,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        skippedDuplicates += 1;
        void recordEvent({ run_id: runId, stage: "snapshot", status: "skipped", monitored_page_id: page.id, duration_ms: elapsed(), metadata: { http_status: 200, content_length: rawHtml.length } });
        continue;
      }
      throw insertError;
    }

    inserted += 1;
    lastFetchedPageIds.push(page.id);
    if (fetchQuality !== "full") nonFullPageIds.push(page.id);
    // Task 1: fetch succeeded → optimistically mark healthy (extraction may downgrade later)
    healthStateUpdates.push({ pageId: page.id, healthState: "healthy" });
    void recordEvent({ run_id: runId, stage: "snapshot", status: "success", monitored_page_id: page.id, duration_ms: elapsed(), metadata: { http_status: 200, content_length: rawHtml.length, fetch_quality: fetchQuality } });
  }

  return { ...empty, succeeded: true, inserted, skippedDuplicates, nonFullPageIds, healthStateUpdates, lastFetchedPageIds };
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const pageClass =
    typeof req.query?.page_class === "string" ? req.query.page_class : null;

  const monitorSlug = pageClass
    ? `fetch-snapshots-${pageClass.replace(/_/g, "-")}`
    : "fetch-snapshots";

  const checkInId = Sentry.captureCheckIn({ monitorSlug, status: "in_progress" });

  try {
    let pageQuery = supabase
      .from("monitored_pages")
      .select("id, url, health_state")
      .eq("active", true);

    if (pageClass) {
      pageQuery = pageQuery.eq("page_class", pageClass);
    }

    const { data: monitoredPages, error: monitoredPagesError } = await pageQuery;
    if (monitoredPagesError) throw monitoredPagesError;

    const pages: MonitoredPage[] = ((monitoredPages ?? []) as unknown as MonitoredPageRow[]).map((r) => ({
      id: r.id,
      url: r.url,
      health_state: r.health_state,
    }));

    const pagesByUrl = new Map<string, MonitoredPage[]>();
    for (const page of pages) {
      const existing = pagesByUrl.get(page.url) ?? [];
      existing.push(page);
      pagesByUrl.set(page.url, existing);
    }

    const rowsClaimed = pagesByUrl.size;

    // ── Pre-batch duplicate check ──────────────────────────────────────────────
    const allPageIds = pages.map((p) => p.id);
    const latestHashMap = new Map<string, string>();

    if (allPageIds.length > 0) {
      const { data: recentSnapshots } = await supabase
        .from("snapshots")
        .select("monitored_page_id, content_hash")
        .in("monitored_page_id", allPageIds)
        .order("fetched_at", { ascending: false })
        .limit(allPageIds.length * 5);

      for (const row of (recentSnapshots ?? []) as { monitored_page_id: string; content_hash: string }[]) {
        if (!latestHashMap.has(row.monitored_page_id)) {
          latestHashMap.set(row.monitored_page_id, row.content_hash);
        }
      }
    }

    // ── Concurrent fetch execution ─────────────────────────────────────────────
    const globalSem = createSemaphore(GLOBAL_CONCURRENCY);
    const domainSems = new Map<string, ReturnType<typeof createSemaphore>>();
    const domainFailureCounts = new Map<string, number>();
    // Task 3: shared across all processUrl calls — domain semaphore ensures serial access per domain
    const lastFetchTimeByDomain = new Map<string, number>();

    const getDomainSem = (hostname: string) => {
      if (!domainSems.has(hostname)) {
        domainSems.set(hostname, createSemaphore(DOMAIN_CONCURRENCY));
      }
      return domainSems.get(hostname)!;
    };

    const urlEntries = [...pagesByUrl.entries()];
    // Shuffle so that budget exhaustion doesn't always starve the same pages.
    for (let i = urlEntries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urlEntries[i], urlEntries[j]] = [urlEntries[j], urlEntries[i]];
    }

    const settled = await Promise.allSettled(
      urlEntries.map(([url, groupedPages]) => {
        let hostname: string;
        try {
          hostname = new URL(url).hostname;
        } catch {
          hostname = url;
        }
        const domainSem = getDomainSem(hostname);

        return globalSem(() =>
          domainSem(() =>
            processUrl(url, hostname, groupedPages, startedAt, domainFailureCounts, lastFetchTimeByDomain, latestHashMap, runId)
          )
        );
      })
    );

    // ── Aggregate metrics ──────────────────────────────────────────────────────
    let rowsProcessed         = 0;
    let rowsSucceeded         = 0;
    let rowsFailed            = 0;
    let rowsInserted          = 0;
    let rowsSkippedDuplicates = 0;
    let rowsSkippedBudget     = 0;
    let rowsSkippedCooldown   = 0;
    const allNonFullPageIds: string[] = [];
    const allHealthUpdates: Array<{ pageId: string; healthState: PageHealthState }> = [];
    const allLastFetchedPageIds: string[] = [];

    for (const result of settled) {
      if (result.status === "rejected") {
        rowsFailed += 1;
        Sentry.captureException(result.reason);
        continue;
      }

      const r = result.value;
      if (r.skippedBudget)   { rowsSkippedBudget   += 1; continue; }
      if (r.skippedCooldown) { rowsSkippedCooldown += 1; continue; }

      rowsProcessed         += 1;
      rowsInserted          += r.inserted;
      rowsSkippedDuplicates += r.skippedDuplicates;
      allNonFullPageIds.push(...r.nonFullPageIds);
      allHealthUpdates.push(...r.healthStateUpdates);
      allLastFetchedPageIds.push(...r.lastFetchedPageIds);
      if (r.succeeded) rowsSucceeded += 1;
      if (r.failed)    rowsFailed    += 1;
    }

    // ── Task 1: Batch health state updates ────────────────────────────────────
    // Group page IDs by target state; one UPDATE per state bucket.
    // Non-fatal — must never block pipeline output.
    let pagesHealthUpdated = 0;
    if (allHealthUpdates.length > 0) {
      try {
        const byState = new Map<PageHealthState, string[]>();
        for (const { pageId, healthState } of allHealthUpdates) {
          const arr = byState.get(healthState) ?? [];
          arr.push(pageId);
          byState.set(healthState, arr);
        }

        for (const [healthState, pageIds] of byState) {
          const { error: hsError } = await supabase
            .from("monitored_pages")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ health_state: healthState } as any)
            .in("id", pageIds);
          if (hsError) throw hsError;
          pagesHealthUpdated += pageIds.length;
        }
      } catch (hsError) {
        // Non-fatal
        Sentry.captureException(hsError);
      }
    }

    // ── Batch update last_fetched_at ──────────────────────────────────────────
    // Non-fatal. Stamped on every page whose URL was successfully fetched,
    // regardless of whether content changed, enabling freshness queries without
    // a full join through snapshots.
    if (allLastFetchedPageIds.length > 0) {
      try {
        const uniqueIds = [...new Set(allLastFetchedPageIds)];
        const { error: lfError } = await supabase
          .from("monitored_pages")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ last_fetched_at: new Date().toISOString() } as any)
          .in("id", uniqueIds);
        if (lfError) Sentry.captureException(lfError);
      } catch (lfError) {
        Sentry.captureException(lfError);
      }
    }

    // ── Budget exhaustion warning ──────────────────────────────────────────────
    if (rowsSkippedBudget > 0) {
      Sentry.captureMessage("fetch_budget_exhausted", {
        level: "warning",
        extra: { rowsSkippedBudget, pageClass: pageClass ?? "all", totalPages: rowsClaimed },
      });
    }

    // ── Domain cooldown warning ────────────────────────────────────────────────
    if (rowsSkippedCooldown > 0) {
      const cooledDomains = [...domainFailureCounts.entries()]
        .filter(([, count]) => count >= DOMAIN_COOLDOWN_THRESHOLD)
        .map(([domain]) => domain);
      Sentry.captureMessage("fetch_domain_cooldown", {
        level: "info",
        extra: { rowsSkippedCooldown, cooledDomains },
      });
    }

    // ── Auto-deactivation: consecutive bad-quality pages ──────────────────────
    let pagesAutoDeactivated = 0;
    if (allNonFullPageIds.length > 0) {
      try {
        const uniqueNonFullIds = [...new Set(allNonFullPageIds)];

        const { data: recentQuality } = await supabase
          .from("snapshots")
          .select("monitored_page_id, fetch_quality")
          .in("monitored_page_id", uniqueNonFullIds)
          .order("fetched_at", { ascending: false })
          .limit(uniqueNonFullIds.length * CONSECUTIVE_BAD_THRESHOLD);

        const qualityByPage = new Map<string, string[]>();
        for (const row of (recentQuality ?? []) as unknown as { monitored_page_id: string; fetch_quality: string }[]) {
          const arr = qualityByPage.get(row.monitored_page_id) ?? [];
          arr.push(row.fetch_quality);
          qualityByPage.set(row.monitored_page_id, arr);
        }

        for (const pageId of uniqueNonFullIds) {
          const qualities = qualityByPage.get(pageId) ?? [];
          if (qualities.length < CONSECUTIVE_BAD_THRESHOLD) continue;
          const lastN = qualities.slice(0, CONSECUTIVE_BAD_THRESHOLD);
          if (!lastN.every((q) => q !== "full")) continue;

          const { error: deactivateError } = await supabase
            .from("monitored_pages")
            .update({ active: false })
            .eq("id", pageId)
            .eq("active", true);

          if (deactivateError) {
            Sentry.captureException(deactivateError);
          } else {
            pagesAutoDeactivated += 1;
            Sentry.captureMessage("page_auto_deactivated", {
              level: "warning",
              extra: {
                monitored_page_id: pageId,
                consecutive_non_full: CONSECUTIVE_BAD_THRESHOLD,
                last_qualities: lastN,
              },
            });
          }
        }
      } catch (deactivateError) {
        Sentry.captureException(deactivateError);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:           "fetch-snapshots",
      batch_size:           rowsClaimed,
      pageClass:            pageClass ?? "all",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsInserted,
      rowsSkippedDuplicates,
      rowsSkippedBudget,
      rowsSkippedCooldown,
      pagesAutoDeactivated,
      pagesHealthUpdated,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug, status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "fetch-snapshots",
      pageClass:            pageClass ?? "all",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsInserted,
      rowsSkippedDuplicates,
      rowsSkippedBudget,
      rowsSkippedCooldown,
      pagesAutoDeactivated,
      pagesHealthUpdated,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug, status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("fetch-snapshots", handler);
