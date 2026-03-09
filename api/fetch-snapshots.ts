import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";
import crypto from "crypto";

interface MonitoredPage {
  id: string;
  competitor_id: string;
  url: string;
  active: boolean;
}

async function handler(req: any, res: any) {
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  Sentry.captureCheckIn(
    {
      monitorSlug: "fetch-snapshots",
      status: "in_progress",
    },
    checkInId
  );

  try {
    // 1. Load active monitored pages
    const { data: monitoredPages, error: monitoredPagesError } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id, url, active")
      .eq("active", true);

    if (monitoredPagesError) {
      throw monitoredPagesError;
    }

    const pages = (monitoredPages ?? []) as MonitoredPage[];

    // 2. Group by URL so each physical page is fetched once
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

    for (const [url, groupedPages] of pagesByUrl.entries()) {
      rowsProcessed += 1;

      try {
        const response = await fetch(url, {
          headers: {
            "user-agent": "MetrivantBot/1.0"
          }
        });

        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }

        const rawHtml = await response.text();

        const contentHash = crypto
          .createHash("sha256")
          .update(rawHtml)
          .digest("hex");

        for (const page of groupedPages) {
          // 3. Check most recent snapshot for this monitored page
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

          const isDuplicate = latestSnapshot?.content_hash === contentHash;

          // 4. Insert snapshot row
          const { error: insertError } = await supabase
            .from("snapshots")
            .insert({
              monitored_page_id: page.id,
              fetched_at: new Date().toISOString(),
              raw_html: rawHtml,
              extracted_text: null,
              content_hash: contentHash,
              status: "fetched",
              sections_extracted: false,
              is_duplicate: isDuplicate,
            });

          if (insertError) {
            throw insertError;
          }
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
      runtimeDurationMs,
    });

    Sentry.captureCheckIn(
      {
        monitorSlug: "fetch-snapshots",
        status: "ok",
      },
      checkInId
    );

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "fetch-snapshots",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      runtimeDurationMs,
    });} catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn(
      {
        monitorSlug: "fetch-snapshots",
        status: "error",
      },
      checkInId
    );

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("fetch-snapshots", handler);
