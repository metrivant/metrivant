import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Maximum pool_events entries to look back when checking for duplicates.
// Covers several months of activity without a full table scan.
const DEDUP_LOOKBACK = 300;

// Maximum feed entries processed per feed per run.
// Caps initial historical import at onboarding (feeds can have 100+ archive entries).
// At steady-state (hourly runs), most feeds produce <10 new entries — this limit
// is rarely reached outside the first few runs after feed discovery.
const MAX_ENTRIES_PER_FEED = 50;

// Maximum age of a feed entry to ingest (90 days).
// Prevents mass-importing archived content when a feed is newly discovered.
const MAX_ENTRY_AGE_DAYS = 90;
const MAX_ENTRY_AGE_MS   = MAX_ENTRY_AGE_DAYS * 24 * 60 * 60 * 1000;

// Fetch timeout for feed XML retrieval.
const FETCH_TIMEOUT_MS = 10_000;

interface FeedRow {
  id:           string;
  competitor_id: string;
  feed_url:     string;
  source_type:  string;
}

// ── Title normalization ────────────────────────────────────────────────────────
//
// Secondary dedup key — used for in-run comparison only.
// NEVER fed into content_hash (which remains anchored to the raw feed entry).
// Changing this function only affects within-run dedup; it cannot re-ingest
// existing pool_events because those are checked by content_hash first.
//
// Strips press-wire prefixes ("Acme Corp – Press Release – Title" → "Title"),
// collapses whitespace, and lowercases for comparison.
// Conservative regex: only strips prefixes matching the exact wire format pattern.
function normalizeTitle(title: string): string {
  return title
    // Strip "Company Name – [Press Release|News Release|Announcement] – " prefixes
    // as emitted by PR Newswire, Business Wire, GlobeNewswire, etc.
    .replace(/^[^–—]{3,80}[–—]\s*(?:press release|news release|announcement|pressemitteilung)[–—]\s*/i, "")
    // Collapse all whitespace variants to a single space
    .replace(/[\s\u00a0\u2009\u2002\u2003]+/g, " ")
    .trim()
    .toLowerCase();
}

async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
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

  Sentry.captureCheckIn({ monitorSlug: "ingest-feeds", status: "in_progress" });

  try {
    // ── Load active newsroom feed configurations ───────────────────────────────
    // Scoped to pool_type='newsroom' — investor feeds are handled by ingest-investor-feeds.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedRows, error: feedsError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, source_type")
      .eq("pool_type", "newsroom")
      .eq("discovery_status", "active")
      .not("feed_url", "is", null)
      .limit(50);

    if (feedsError) throw feedsError;

    const feeds = (feedRows ?? []) as FeedRow[];
    const feedsTotal    = feeds.length;
    let   feedsIngested = 0;
    let   feedsFailed   = 0;
    let   eventsInserted = 0;
    let   eventsDuplicate = 0;

    for (const feed of feeds) {
      const feedElapsed = startTimer();
      try {
        // Fetch and parse the feed XML.
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

        // Filter entries that are too old (avoid importing archived history).
        const now          = Date.now();
        const freshEntries = entries.filter((e) =>
          !e.published_at || (now - e.published_at.getTime()) <= MAX_ENTRY_AGE_MS
        );

        // Load existing content_hashes, URLs, and raw titles for this competitor to dedup.
        // Three independent dedup keys:
        //   1. content_hash  — primary, anchored to raw feed entry (never changes)
        //   2. event_url     — prevents duplicates from feeds that vary minor title text
        //   3. normalizeTitle(title) — catches editorial variants of the same story
        //      (e.g., "Acme Acquires Foo" vs "Acme Corp – Press Release – Acme Acquires Foo")
        //      Normalized titles are computed in memory from the stored raw title column.
        //      No migration required. If the normalization function changes, only in-run
        //      dedup is affected — existing rows are still found by content_hash.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingRows } = await (supabase as any)
          .from("pool_events")
          .select("content_hash, event_url, title")
          .eq("competitor_id", feed.competitor_id)
          .order("created_at", { ascending: false })
          .limit(DEDUP_LOOKBACK);

        type ExistingRow = { content_hash: string; event_url: string | null; title: string | null };
        const existingHashes = new Set<string>(
          ((existingRows ?? []) as ExistingRow[]).map((r) => r.content_hash)
        );
        const existingUrls = new Set<string>(
          ((existingRows ?? []) as ExistingRow[])
            .filter((r) => r.event_url)
            .map((r) => r.event_url as string)
        );
        // Normalized titles from historical rows — catches press-wire prefix variants.
        const existingNormalizedTitles = new Set<string>(
          ((existingRows ?? []) as ExistingRow[])
            .filter((r) => r.title)
            .map((r) => normalizeTitle(r.title as string))
        );

        // Build rows for new entries only.
        const newRows: Record<string, unknown>[] = [];
        for (const entry of freshEntries) {
          // Gate 1: content_hash (primary — anchored to raw feed GUID or title+date)
          if (existingHashes.has(entry.content_hash)) {
            eventsDuplicate += 1;
            continue;
          }
          // Gate 2: event_url — same URL already stored under different editorial text
          if (entry.event_url && existingUrls.has(entry.event_url)) {
            eventsDuplicate += 1;
            continue;
          }
          // Gate 3: normalized title — catches press-wire prefix variants of the same story.
          // Only applies when the title normalizes to a non-trivially short string (≥10 chars)
          // to avoid false matches on generic single-word titles.
          const normalized = normalizeTitle(entry.title);
          if (normalized.length >= 10 && existingNormalizedTitles.has(normalized)) {
            eventsDuplicate += 1;
            continue;
          }

          // Classify event_type from feed source hints.
          // Atom feeds from investor-relations pages → investor_update (future path).
          // All others → press_release by default.
          const event_type = feed.source_type === "newsroom_feed"
            ? "newsroom_post"
            : "press_release";

          newRows.push({
            competitor_id:        feed.competitor_id,
            source_type:          feed.source_type,
            source_url:           feed.feed_url,
            event_type,
            title:                entry.title.slice(0, 500),
            summary:              entry.summary ? entry.summary.slice(0, 2000) : null,
            event_url:            entry.event_url ?? null,
            published_at:         entry.published_at?.toISOString() ?? null,
            content_hash:         entry.content_hash,
            normalization_status: "pending",
          });

          // Extend in-run dedup sets so subsequent entries in the same feed batch
          // are checked against entries accepted earlier in this run.
          existingHashes.add(entry.content_hash);
          if (entry.event_url) existingUrls.add(entry.event_url);
          if (normalized.length >= 10) existingNormalizedTitles.add(normalized);
        }

        // Bulk insert, ignoring conflicts (secondary safety net against races).
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

        // Update feed metadata.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .update({
            last_fetched_at:     new Date().toISOString(),
            consecutive_failures: 0,
            last_error:           null,
            updated_at:           new Date().toISOString(),
          })
          .eq("id", feed.id);

        feedsIngested += 1;
        void recordEvent({
          run_id: runId,
          stage:  "feed_ingest",
          status: "success",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:      feed.id,
            competitor_id: feed.competitor_id,
            entries_parsed: entries.length,
            entries_fresh:  freshEntries.length,
            entries_new:    newRows.length,
          },
        });
      } catch (feedError) {
        feedsFailed += 1;
        Sentry.captureException(feedError);

        // Increment failure counter; mark feed_unavailable after 10 consecutive failures.
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
          stage:  "feed_ingest",
          status: "failure",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:       feed.id,
            competitor_id: feed.competitor_id,
            error:         feedError instanceof Error ? feedError.message : String(feedError),
          },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:     "ingest-feeds",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "ingest-feeds", status: "ok" });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "ingest-feeds",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "ingest-feeds", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("ingest-feeds", handler);
