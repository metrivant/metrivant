import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_SIZE = 1024 * 1024; // 1 MB

interface MonitoredPage {
  id: string;
  url: string;
}

interface LatestSnapshot {
  content_hash: string;
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
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

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  // page_class filter — passed as query param by the three cron entries:
  //   ?page_class=ambient     → every 30 min (blog, careers, feeds)
  //   ?page_class=high_value  → every 60 min (pricing, changelog, newsroom)
  //   ?page_class=standard    → every 3 hours (homepage, features, solutions)
  // When absent (manual invocation), all active pages are fetched.
  const pageClass =
    typeof req.query?.page_class === "string" ? req.query.page_class : null;

  // Scoped monitor slug so Sentry tracks each cadence independently.
  const monitorSlug = pageClass
    ? `fetch-snapshots-${pageClass.replace(/_/g, "-")}`
    : "fetch-snapshots";

  Sentry.captureCheckIn({
    monitorSlug,
    status: "in_progress",
  });

  try {
    let pageQuery = supabase
      .from("monitored_pages")
      .select("id, url")
      .eq("active", true);

    if (pageClass) {
      pageQuery = pageQuery.eq("page_class", pageClass);
    }

    const { data: monitoredPages, error: monitoredPagesError } = await pageQuery;

    if (monitoredPagesError) {
      throw monitoredPagesError;
    }

    const pages = (monitoredPages ?? []) as MonitoredPage[];

    const pagesByUrl = new Map<string, MonitoredPage[]>();

    for (const page of pages) {
      const existing = pagesByUrl.get(page.url) ?? [];
      existing.push(page);
      pagesByUrl.set(page.url, existing);
    }

    const rowsClaimed = pagesByUrl.size;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let rowsInserted = 0;
    let rowsSkippedDuplicates = 0;

    for (const [url, groupedPages] of pagesByUrl.entries()) {
      rowsProcessed += 1;

      try {
        const rawHtml = await fetchWithTimeout(url);
        const contentHash = hashContent(rawHtml);
        const fetchedAt = new Date().toISOString();

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
            rowsSkippedDuplicates += 1;
            continue;
          }

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
            });

          if (insertError) {
            // Unique constraint violation (23505) = concurrent run inserted same hash first — treat as duplicate skip
            if ((insertError as { code?: string }).code === "23505") {
              rowsSkippedDuplicates += 1;
              continue;
            }
            throw insertError;
          }

          rowsInserted += 1;
        }

        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        // 404s and timeouts are expected pipeline outcomes — don't pollute Sentry
        const msg = error instanceof Error ? error.message : String(error);
        const isExpectedFailure =
          msg.includes("404") ||
          msg.includes("AbortError") ||
          msg.includes("This operation was aborted");
        if (!isExpectedFailure) {
          Sentry.captureException(error);
        }
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      pageClass: pageClass ?? "all",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsInserted,
      rowsSkippedDuplicates,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug,
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "fetch-snapshots",
      pageClass: pageClass ?? "all",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsInserted,
      rowsSkippedDuplicates,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug,
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("fetch-snapshots", handler);
