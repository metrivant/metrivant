import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";
import { extractVersionTag } from "../lib/product-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Maximum pool_events entries to look back for dedup per competitor.
const DEDUP_LOOKBACK = 300;

// Maximum feed entries processed per feed per run.
const MAX_ENTRIES_PER_FEED = 100;

// Maximum age of a product feed entry to ingest (90 days).
// Prevents mass-importing full release history when a feed is newly discovered.
const MAX_ENTRY_AGE_DAYS = 90;
const MAX_ENTRY_AGE_MS   = MAX_ENTRY_AGE_DAYS * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 10_000;

interface FeedRow {
  id:            string;
  competitor_id: string;
  feed_url:      string;
  source_type:   string;
}

async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
        "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
      },
      signal:   controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  Sentry.captureCheckIn({ monitorSlug: "ingest-product-feeds", status: "in_progress" });

  try {
    // ── Load active product feed configurations ────────────────────────────────
    // Scoped to pool_type='product'. GitHub releases.atom feeds are standard Atom
    // and parsed by the same parseFeed() function as all other feeds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedRows, error: feedsError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, source_type")
      .eq("pool_type", "product")
      .eq("discovery_status", "active")
      .not("feed_url", "is", null)
      .limit(50);

    if (feedsError) throw feedsError;

    const feeds = (feedRows ?? []) as FeedRow[];
    const feedsTotal      = feeds.length;
    let   feedsIngested   = 0;
    let   feedsFailed     = 0;
    let   eventsInserted  = 0;
    let   eventsDuplicate = 0;

    for (const feed of feeds) {
      const feedElapsed = startTimer();
      try {
        const xml     = await fetchFeedXml(feed.feed_url);
        const entries = parseFeed(xml).slice(0, MAX_ENTRIES_PER_FEED);

        if (entries.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("competitor_feeds")
            .update({ last_fetched_at: new Date().toISOString() })
            .eq("id", feed.id);
          feedsIngested += 1;
          continue;
        }

        // Filter entries that are too old
        const now          = Date.now();
        const freshEntries = entries.filter((e) =>
          !e.published_at || (now - e.published_at.getTime()) <= MAX_ENTRY_AGE_MS
        );

        // Load existing content_hashes + event_urls for this competitor's product events
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingRows } = await (supabase as any)
          .from("pool_events")
          .select("content_hash, event_url")
          .eq("competitor_id", feed.competitor_id)
          .eq("event_type", "product_release")
          .order("created_at", { ascending: false })
          .limit(DEDUP_LOOKBACK);

        const existingHashes = new Set<string>(
          ((existingRows ?? []) as { content_hash: string }[]).map((r) => r.content_hash)
        );
        const existingUrls = new Set<string>(
          ((existingRows ?? []) as { event_url: string | null }[])
            .filter((r) => r.event_url)
            .map((r) => r.event_url as string)
        );

        // Build rows for new entries only
        const newRows: Record<string, unknown>[] = [];
        for (const entry of freshEntries) {
          if (existingHashes.has(entry.content_hash)) {
            eventsDuplicate += 1;
            continue;
          }
          if (entry.event_url && existingUrls.has(entry.event_url)) {
            eventsDuplicate += 1;
            continue;
          }

          // Extract version_tag at ingestion time.
          // For GitHub releases.atom: title is typically "v1.2.3" or "v1.2.3 - description".
          // For changelog RSS: title might be "Release 2.1.0" or "Changelog - March 2024".
          // Stored now; semver classification happens during promotion.
          const versionTag = extractVersionTag(entry.title, entry.guid);

          newRows.push({
            competitor_id:        feed.competitor_id,
            source_type:          feed.source_type,
            source_url:           feed.feed_url,
            event_type:           "product_release",
            title:                entry.title.slice(0, 500),
            summary:              entry.summary ? entry.summary.slice(0, 2000) : null,
            event_url:            entry.event_url ?? null,
            published_at:         entry.published_at?.toISOString() ?? null,
            content_hash:         entry.content_hash,
            normalization_status: "pending",
            version_tag:          versionTag,
            // product_event_type is populated later by promote-product-signals.ts
          });
        }

        if (newRows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (supabase as any)
            .from("pool_events")
            .upsert(newRows as any[], { onConflict: "competitor_id,content_hash", ignoreDuplicates: true });

          if (insertError) {
            Sentry.captureException(insertError);
          } else {
            eventsInserted += newRows.length;
          }
        }

        // Update feed metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .update({
            last_fetched_at:      new Date().toISOString(),
            consecutive_failures: 0,
            last_error:           null,
            updated_at:           new Date().toISOString(),
          })
          .eq("id", feed.id);

        feedsIngested += 1;
        void recordEvent({
          run_id: runId,
          stage:  "product_ingest",
          status: "success",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:        feed.id,
            competitor_id:  feed.competitor_id,
            source_type:    feed.source_type,
            entries_parsed: entries.length,
            entries_fresh:  freshEntries.length,
            entries_new:    newRows.length,
          },
        });
      } catch (feedError) {
        feedsFailed += 1;
        Sentry.captureException(feedError);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: currentFeed } = await (supabase as any)
            .from("competitor_feeds")
            .select("consecutive_failures")
            .eq("id", feed.id)
            .single();

          const failures = ((currentFeed as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("competitor_feeds")
            .update({
              consecutive_failures: failures,
              last_error:           feedError instanceof Error ? feedError.message : String(feedError),
              discovery_status:     failures >= 10 ? "feed_unavailable" : "active",
              updated_at:           new Date().toISOString(),
            })
            .eq("id", feed.id);
        } catch (updateErr) {
          Sentry.captureException(updateErr);
        }

        void recordEvent({
          run_id: runId,
          stage:  "product_ingest",
          status: "failure",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:       feed.id,
            competitor_id: feed.competitor_id,
            source_type:   feed.source_type,
            error:         feedError instanceof Error ? feedError.message : String(feedError),
          },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "ingest-product-feeds",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "ingest-product-feeds", status: "ok" });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "ingest-product-feeds",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "ingest-product-feeds", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("ingest-product-feeds", handler);
