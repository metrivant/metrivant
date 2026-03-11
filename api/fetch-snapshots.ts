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

  Sentry.captureCheckIn({
    monitorSlug: "fetch-snapshots",
    status: "in_progress",
  });

  try {
    const { data: monitoredPages, error: monitoredPagesError } = await supabase
      .from("monitored_pages")
      .select("id, url")
      .eq("active", true);

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
            throw insertError;
          }

          rowsInserted += 1;
        }

        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsInserted,
      rowsSkippedDuplicates,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "fetch-snapshots",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "fetch-snapshots",
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
      monitorSlug: "fetch-snapshots",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("fetch-snapshots", handler);