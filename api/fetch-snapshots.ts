import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_SIZE = 1024 * 1024; // 1 MB

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
      .select("id, url, competitors ( name )")
      .eq("active", true);

    if (pageClass) {
      pageQuery = pageQuery.eq("page_class", pageClass);
    }

    const { data: monitoredPages, error: monitoredPagesError } = await pageQuery;

    if (monitoredPagesError) {
      throw monitoredPagesError;
    }

    const pages: MonitoredPage[] = ((monitoredPages ?? []) as MonitoredPageRow[]).map((r) => ({
      id: r.id,
      url: r.url,
      competitor_name: r.competitors?.name ?? null,
    }));

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

        // ── Fetch quality check: detect bot walls and JS-rendered shells ──────
        // Count text-bearing elements using fast string operations (no parse needed).
        // If fewer than 3 such elements are found, the HTML is likely a bot wall,
        // a JS-shell that needs client rendering, or an anti-scrape fallback.
        const textElementCount =
          (rawHtml.match(/<\/p>/gi)?.length ?? 0) +
          (rawHtml.match(/<\/h1>/gi)?.length ?? 0) +
          (rawHtml.match(/<\/h2>/gi)?.length ?? 0) +
          (rawHtml.match(/<\/li>/gi)?.length ?? 0);

        // 'full' = normal page with meaningful content
        // 'shell' = bot wall / JS-only shell / anti-scrape response
        const fetchQuality = textElementCount < 3 ? "shell" : "full";

        if (fetchQuality === "shell") {
          // Use the first grouped page's competitor_name as a representative label.
          const representativeName = groupedPages[0]?.competitor_name ?? "unknown";
          Sentry.captureMessage("fetch_shell_detected", {
            level: "warning",
            extra: {
              competitor_name: representativeName,
              url,
              text_element_count: textElementCount,
            },
          });
          Sentry.addBreadcrumb({
            category: "pipeline",
            message: "Snapshot flagged as shell — low text-element count",
            level: "warning",
            data: { url, textElementCount, fetchQuality },
          });
        }

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

          // The base snapshot payload — always safe to insert.
          const basePayload = {
            monitored_page_id: page.id,
            fetched_at: fetchedAt,
            raw_html: rawHtml,
            extracted_text: null,
            content_hash: contentHash,
            status: "fetched",
            sections_extracted: false,
            is_duplicate: false,
          };

          // TODO: add fetch_quality column to snapshots via migration before removing this guard.
          // We attempt to write fetch_quality. If the column does not yet exist, Supabase returns
          // a 42703 ("undefined_column") error and we fall back to the base payload so no snapshot
          // is ever lost. The cast is intentional — fetch_quality is not yet in the generated types.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let { error: insertError } = await supabase
            .from("snapshots")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ ...basePayload, fetch_quality: fetchQuality } as any);

          // Column does not exist yet — retry with base payload so the snapshot is not lost.
          if (insertError && (insertError as { code?: string }).code === "42703") {
            Sentry.addBreadcrumb({
              category: "pipeline",
              message: "fetch_quality column not yet on snapshots — skipping column write",
              level: "info",
            });
            ({ error: insertError } = await supabase
              .from("snapshots")
              .insert(basePayload));
          }

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
        // These are expected pipeline outcomes — websites block bots, timeout,
        // redirect-loop, or return oversized pages. Don't pollute Sentry with them.
        const msg = error instanceof Error ? error.message : String(error);
        // Also check error code for Supabase DB errors where the message
        // may not match the pattern but the error is a known non-critical outcome.
        const errCode = (error as { code?: string })?.code;
        const isExpectedFailure =
          msg.includes("404") ||
          msg.includes("403") ||
          msg.includes("401") ||
          msg.includes("AbortError") ||
          msg.includes("This operation was aborted") ||
          msg.includes("redirect count exceeded") ||
          msg.includes("HTML exceeds size limit") ||
          errCode === "23505"; // unique constraint violation — concurrent run race
        if (!isExpectedFailure) {
          Sentry.captureException(error);
        }
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "fetch-snapshots",
      batch_size: rowsClaimed,
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
