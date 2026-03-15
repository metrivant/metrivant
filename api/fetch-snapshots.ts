import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";

// ── Concurrency / timing constants ───────────────────────────────────────────
// global: max simultaneous in-flight fetches across all domains.
// domain: max simultaneous fetches against the same hostname (CDN-safe).
// budget: stop launching new work after this many ms of wall-clock elapsed.
//         Keeps the Vercel function well inside its 10s ceiling.
// jitter: random pre-fetch delay per URL to avoid CDN burst patterns.
// cooldown: after this many consecutive 403/429/timeout failures from the same
//           domain, skip remaining URLs on that domain for this invocation.

const FETCH_TIMEOUT_MS         = 6500;    // per-URL hard abort
const GLOBAL_CONCURRENCY       = 8;       // total parallel fetches
const DOMAIN_CONCURRENCY       = 1;       // per-hostname concurrency
const INVOCATION_BUDGET_MS     = 6000;    // wall-clock ceiling for new work
const JITTER_MIN_MS            = 100;
const JITTER_MAX_MS            = 400;
const DOMAIN_COOLDOWN_THRESHOLD = 2;      // failures before domain is skipped
const MAX_HTML_SIZE            = 1024 * 1024; // 1 MB

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonitoredPage {
  id: string;
  url: string;
  competitor_name: string | null;
}

interface MonitoredPageRow {
  id: string;
  url: string;
  competitors: { name: string } | null;
}

interface LatestSnapshot {
  content_hash: string;
}

// Per-URL result returned from the parallel worker function.
interface UrlResult {
  succeeded: boolean;
  failed: boolean;
  inserted: number;
  skippedDuplicates: number;
  skippedBudget: boolean;
  skippedCooldown: boolean;
  triggeredCooldown: boolean; // this URL's failure incremented the domain failure count
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

// Minimal semaphore — no external dependency.
// acquire(fn) waits for a slot, runs fn, releases the slot.
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

// Estimate visible text length by stripping script/style blocks and HTML tags.
// Used to distinguish JS-rendered shells (structural HTML, no text content)
// from real pages. No parse needed — regex is sufficient for a rough count.
function getVisibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "MetrivantBot/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    if (html.length > MAX_HTML_SIZE) {
      throw new Error(`HTML exceeds size limit for ${url}`);
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Per-URL processor ─────────────────────────────────────────────────────────
// Extracted from the loop so it can be called concurrently via Promise.allSettled.

async function processUrl(
  url: string,
  hostname: string,
  groupedPages: MonitoredPage[],
  invocationStart: number,
  domainFailureCounts: Map<string, number>
): Promise<UrlResult> {
  const empty: UrlResult = { succeeded: false, failed: false, inserted: 0, skippedDuplicates: 0, skippedBudget: false, skippedCooldown: false, triggeredCooldown: false };

  // Budget check: do not start new work if we are past the wall-clock ceiling.
  // Leaves time for the Supabase writes and Sentry flush before the function exits.
  if (Date.now() - invocationStart > INVOCATION_BUDGET_MS) {
    return { ...empty, skippedBudget: true };
  }

  // Domain cooldown check: if this hostname has already hit the failure threshold
  // during this invocation, skip without fetching. Per-domain semaphore ensures
  // requests are serialised per hostname, so this check is race-free.
  if ((domainFailureCounts.get(hostname) ?? 0) >= DOMAIN_COOLDOWN_THRESHOLD) {
    return { ...empty, skippedCooldown: true };
  }

  // Per-URL random jitter — staggers burst patterns against CDNs.
  await sleep(randomInt(JITTER_MIN_MS, JITTER_MAX_MS));

  try {
    const rawHtml = await fetchWithTimeout(url);
    const contentHash = hashContent(rawHtml);
    const fetchedAt = new Date().toISOString();

    // ── Fetch quality classification ──────────────────────────────────────
    // Three tiers — extract-sections only processes 'full' snapshots.
    //
    // 'shell'       — bot wall / anti-scrape response: < 3 text-bearing
    //                 structural elements. Site actively blocked the fetch.
    //
    // 'js_rendered' — SPA / client-side rendered page: structural elements
    //                 present but visible text < 500 chars. Content is loaded
    //                 by JavaScript which the static fetcher cannot execute.
    //
    // 'full'        — normal static or SSR page with extractable text content.
    //
    // Both non-full tiers are stored (for diagnostics and the auto-deactivation
    // trigger) but skipped by extract-sections.
    const textElementCount =
      (rawHtml.match(/<\/p>/gi)?.length ?? 0) +
      (rawHtml.match(/<\/h1>/gi)?.length ?? 0) +
      (rawHtml.match(/<\/h2>/gi)?.length ?? 0) +
      (rawHtml.match(/<\/li>/gi)?.length ?? 0);

    const fetchQuality: "full" | "shell" | "js_rendered" =
      textElementCount < 3           ? "shell" :
      getVisibleTextLength(rawHtml) < 500 ? "js_rendered" :
      "full";

    if (fetchQuality !== "full") {
      const representativeName = groupedPages[0]?.competitor_name ?? "unknown";
      Sentry.captureMessage(
        fetchQuality === "shell" ? "fetch_shell_detected" : "fetch_js_rendered_detected",
        {
          level: "warning",
          extra: {
            competitor_name: representativeName,
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

    let inserted = 0;
    let skippedDuplicates = 0;

    for (const page of groupedPages) {
      const { data: latestSnapshot, error: latestSnapshotError } = await supabase
        .from("snapshots")
        .select("content_hash")
        .eq("monitored_page_id", page.id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSnapshotError) {
        throw latestSnapshotError;
      }

      const latest = latestSnapshot as LatestSnapshot | null;
      const isDuplicate = latest?.content_hash === contentHash;

      if (isDuplicate) {
        skippedDuplicates += 1;
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
        // Concurrent run inserted the same hash first — safe to skip.
        if ((insertError as { code?: string }).code === "23505") {
          skippedDuplicates += 1;
          continue;
        }
        throw insertError;
      }

      inserted += 1;
    }

    return { ...empty, succeeded: true, inserted, skippedDuplicates };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code;

    const isExpectedFailure =
      // Any HTTP-level failure from a competitor site (4xx, 5xx) is expected.
      msg.startsWith("Fetch failed:") ||
      msg.includes("AbortError") ||
      msg.includes("This operation was aborted") ||
      msg.includes("redirect count exceeded") ||
      msg.includes("HTML exceeds size limit") ||
      // Node undici generic network error (DNS failure, connection reset, TLS error).
      (error instanceof TypeError && msg === "fetch failed") ||
      errCode === "23505"; // unique constraint violation — concurrent run race

    if (!isExpectedFailure) {
      Sentry.captureException(error);
    }

    // Domain cooldown: track 403/429 and timeouts. After DOMAIN_COOLDOWN_THRESHOLD
    // failures on the same hostname in one invocation, remaining URLs on that domain
    // are skipped. The per-domain semaphore (concurrency=1) ensures this is safe
    // to update without locks — only one request per domain runs at a time.
    const triggersCooldown =
      msg.includes("Fetch failed: 403") ||
      msg.includes("Fetch failed: 429") ||
      msg.includes("AbortError") ||
      msg.includes("This operation was aborted");

    if (triggersCooldown) {
      domainFailureCounts.set(hostname, (domainFailureCounts.get(hostname) ?? 0) + 1);
    }

    return { ...empty, failed: true, triggeredCooldown: triggersCooldown };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();

  // page_class filter — passed as query param by the three cron entries:
  //   ?page_class=ambient     → every 30 min (blog, careers, feeds)
  //   ?page_class=high_value  → every 60 min (pricing, changelog, newsroom)
  //   ?page_class=standard    → every 3 hours (homepage, features, solutions)
  // When absent (manual invocation), all active pages are fetched.
  const pageClass =
    typeof req.query?.page_class === "string" ? req.query.page_class : null;

  const monitorSlug = pageClass
    ? `fetch-snapshots-${pageClass.replace(/_/g, "-")}`
    : "fetch-snapshots";

  Sentry.captureCheckIn({ monitorSlug, status: "in_progress" });

  try {
    let pageQuery = supabase
      .from("monitored_pages")
      .select("id, url, competitors ( name )")
      .eq("active", true);

    if (pageClass) {
      pageQuery = pageQuery.eq("page_class", pageClass);
    }

    const { data: monitoredPages, error: monitoredPagesError } = await pageQuery;
    if (monitoredPagesError) throw monitoredPagesError;

    const pages: MonitoredPage[] = ((monitoredPages ?? []) as MonitoredPageRow[]).map((r) => ({
      id: r.id,
      url: r.url,
      competitor_name: r.competitors?.name ?? null,
    }));

    // Deduplicate URLs — multiple monitored_pages can share a URL.
    const pagesByUrl = new Map<string, MonitoredPage[]>();
    for (const page of pages) {
      const existing = pagesByUrl.get(page.url) ?? [];
      existing.push(page);
      pagesByUrl.set(page.url, existing);
    }

    const rowsClaimed = pagesByUrl.size;

    // ── Concurrent fetch execution ─────────────────────────────────────────
    // Global semaphore (8): total simultaneous in-flight HTTP fetches.
    // Per-domain semaphore (1): at most one concurrent fetch per hostname,
    //   preventing CDN burst patterns that trigger rate-limiting or blocks.
    // Budget guard: each URL checks wall-clock elapsed before starting;
    //   stops launching new work after INVOCATION_BUDGET_MS to leave headroom
    //   for Supabase writes and Sentry flush before the function ceiling.

    const globalSem = createSemaphore(GLOBAL_CONCURRENCY);
    const domainSems = new Map<string, ReturnType<typeof createSemaphore>>();
    // Shared mutable failure counter per hostname. Safe without locks because
    // per-domain semaphore (concurrency=1) serialises access per hostname.
    const domainFailureCounts = new Map<string, number>();

    const getDomainSem = (hostname: string) => {
      if (!domainSems.has(hostname)) {
        domainSems.set(hostname, createSemaphore(DOMAIN_CONCURRENCY));
      }
      return domainSems.get(hostname)!;
    };

    const urlEntries = [...pagesByUrl.entries()];

    const settled = await Promise.allSettled(
      urlEntries.map(([url, groupedPages]) => {
        let hostname: string;
        try {
          hostname = new URL(url).hostname;
        } catch {
          hostname = url; // malformed URL — use raw string as key
        }
        const domainSem = getDomainSem(hostname);

        return globalSem(() =>
          domainSem(() =>
            processUrl(url, hostname, groupedPages, startedAt, domainFailureCounts)
          )
        );
      })
    );

    // ── Aggregate metrics ──────────────────────────────────────────────────
    let rowsProcessed         = 0;
    let rowsSucceeded         = 0;
    let rowsFailed            = 0;
    let rowsInserted          = 0;
    let rowsSkippedDuplicates = 0;
    let rowsSkippedBudget     = 0;
    let rowsSkippedCooldown   = 0;

    for (const result of settled) {
      if (result.status === "rejected") {
        // Unexpected — processUrl has its own internal catch. Should never reach here.
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
      if (r.succeeded) rowsSucceeded += 1;
      if (r.failed)    rowsFailed    += 1;
    }

    // Emit a warning when domain cooldowns materially reduce coverage.
    // This indicates a CDN blocking pattern that warrants investigation.
    if (rowsSkippedCooldown > 0) {
      const cooledDomains = [...domainFailureCounts.entries()]
        .filter(([, count]) => count >= DOMAIN_COOLDOWN_THRESHOLD)
        .map(([domain]) => domain);
      Sentry.captureMessage("fetch_domain_cooldown", {
        level: "warning",
        extra: { rowsSkippedCooldown, cooledDomains },
      });
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
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug, status: "ok" });
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
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug, status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("fetch-snapshots", handler);
