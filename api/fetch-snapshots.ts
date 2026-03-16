import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";

const FETCH_TIMEOUT_MS          = 6500;
const GLOBAL_CONCURRENCY        = 8;
const DOMAIN_CONCURRENCY        = 1;
const INVOCATION_BUDGET_MS      = 5000;   // lowered from 6000 — leaves 7.5s for DB writes + Sentry flush before Vercel ceiling
const JITTER_MIN_MS             = 100;
const JITTER_MAX_MS             = 400;
const DOMAIN_COOLDOWN_THRESHOLD = 2;
const MAX_HTML_SIZE             = 1024 * 1024;
const CONSECUTIVE_BAD_THRESHOLD = 5;      // deactivate page after N consecutive non-full fetches

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonitoredPage {
  id: string;
  url: string;
}

interface MonitoredPageRow {
  id: string;
  url: string;
}

interface UrlResult {
  succeeded: boolean;
  failed: boolean;
  inserted: number;
  skippedDuplicates: number;
  skippedBudget: boolean;
  skippedCooldown: boolean;
  triggeredCooldown: boolean;
  nonFullPageIds: string[];   // page IDs that received a non-full quality snapshot this run
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

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "MetrivantBot/1.0" },
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

async function processUrl(
  url: string,
  hostname: string,
  groupedPages: MonitoredPage[],
  invocationStart: number,
  domainFailureCounts: Map<string, number>,
  latestHashMap: Map<string, string>  // pre-batched: page_id → latest content_hash
): Promise<UrlResult> {
  const empty: UrlResult = {
    succeeded: false, failed: false, inserted: 0, skippedDuplicates: 0,
    skippedBudget: false, skippedCooldown: false, triggeredCooldown: false,
    nonFullPageIds: [],
  };

  if (Date.now() - invocationStart > INVOCATION_BUDGET_MS) {
    return { ...empty, skippedBudget: true };
  }

  if ((domainFailureCounts.get(hostname) ?? 0) >= DOMAIN_COOLDOWN_THRESHOLD) {
    return { ...empty, skippedCooldown: true };
  }

  await sleep(randomInt(JITTER_MIN_MS, JITTER_MAX_MS));

  try {
    const rawHtml = await fetchWithTimeout(url);
    const contentHash = hashContent(rawHtml);
    const fetchedAt = new Date().toISOString();

    // ── Fetch quality classification ───────────────────────────────────────────
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

    let inserted = 0;
    let skippedDuplicates = 0;
    const nonFullPageIds: string[] = [];

    for (const page of groupedPages) {
      // Duplicate check via pre-batched map — eliminates per-page DB query.
      const isDuplicate = latestHashMap.get(page.id) === contentHash;

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
      if (fetchQuality !== "full") nonFullPageIds.push(page.id);
    }

    return { ...empty, succeeded: true, inserted, skippedDuplicates, nonFullPageIds };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code;

    const isExpectedFailure =
      msg.startsWith("Fetch failed:") ||
      msg.includes("AbortError") ||
      msg.includes("This operation was aborted") ||
      msg.includes("redirect count exceeded") ||
      msg.includes("HTML exceeds size limit") ||
      (error instanceof TypeError && msg === "fetch failed") ||
      errCode === "23505";

    if (!isExpectedFailure) {
      Sentry.captureException(error);
    }

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

  const pageClass =
    typeof req.query?.page_class === "string" ? req.query.page_class : null;

  const monitorSlug = pageClass
    ? `fetch-snapshots-${pageClass.replace(/_/g, "-")}`
    : "fetch-snapshots";

  Sentry.captureCheckIn({ monitorSlug, status: "in_progress" });

  try {
    let pageQuery = supabase
      .from("monitored_pages")
      .select("id, url")   // competitor join removed — name not needed in core fetch path
      .eq("active", true);

    if (pageClass) {
      pageQuery = pageQuery.eq("page_class", pageClass);
    }

    const { data: monitoredPages, error: monitoredPagesError } = await pageQuery;
    if (monitoredPagesError) throw monitoredPagesError;

    const pages: MonitoredPage[] = ((monitoredPages ?? []) as MonitoredPageRow[]).map((r) => ({
      id: r.id,
      url: r.url,
    }));

    // Deduplicate URLs — multiple monitored_pages can share a URL.
    const pagesByUrl = new Map<string, MonitoredPage[]>();
    for (const page of pages) {
      const existing = pagesByUrl.get(page.url) ?? [];
      existing.push(page);
      pagesByUrl.set(page.url, existing);
    }

    const rowsClaimed = pagesByUrl.size;

    // ── Pre-batch duplicate check ──────────────────────────────────────────────
    // Replaces per-page N+1 queries inside processUrl. Load latest content_hash
    // for every active page in one bulk query; processUrl uses map lookups (O(1)).
    const allPageIds = pages.map((p) => p.id);
    const latestHashMap = new Map<string, string>(); // page_id → latest content_hash

    if (allPageIds.length > 0) {
      const { data: recentSnapshots } = await supabase
        .from("snapshots")
        .select("monitored_page_id, content_hash")
        .in("monitored_page_id", allPageIds)
        .order("fetched_at", { ascending: false })
        .limit(allPageIds.length * 5); // generous cap — first occurrence per page = latest

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
          hostname = url;
        }
        const domainSem = getDomainSem(hostname);

        return globalSem(() =>
          domainSem(() =>
            processUrl(url, hostname, groupedPages, startedAt, domainFailureCounts, latestHashMap)
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
      if (r.succeeded) rowsSucceeded += 1;
      if (r.failed)    rowsFailed    += 1;
    }

    // ── Domain cooldown warning ────────────────────────────────────────────────
    if (rowsSkippedCooldown > 0) {
      const cooledDomains = [...domainFailureCounts.entries()]
        .filter(([, count]) => count >= DOMAIN_COOLDOWN_THRESHOLD)
        .map(([domain]) => domain);
      Sentry.captureMessage("fetch_domain_cooldown", {
        level: "warning",
        extra: { rowsSkippedCooldown, cooledDomains },
      });
    }

    // ── Auto-deactivation: consecutive bad-quality pages ──────────────────────
    // After CONSECUTIVE_BAD_THRESHOLD consecutive non-full fetches, deactivate the
    // page. Stops wasting crawl budget on JS-rendered SPAs or bot-walled domains
    // that will never yield extractable content. Non-fatal — must not block output.
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

        // Group qualities per page (DESC order — first = most recent).
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
            .eq("active", true); // guard: only update if still active

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
        // Non-fatal — deactivation must never block pipeline output.
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
      pagesAutoDeactivated,
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
