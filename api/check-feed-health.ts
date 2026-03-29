import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId, serializeError } from "../lib/pipeline-metrics";
import { checkFeedHealth, FeedHealthResult } from "../lib/feed-health";
import { SECTOR_MEDIA_SOURCES } from "../lib/sector-media-sources";

// Process feeds in chunks to avoid overwhelming the network.
const CONCURRENCY = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitorFeedRow {
  id: string;
  competitor_id: string;
  feed_url: string | null;
  pool_type: string;
  source_type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function processInChunks<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "check-feed-health", status: "in_progress" });

  try {
    // ── Part 1: competitor_feeds (pools 1-6) ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedRows, error: feedError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, pool_type, source_type")
      .not("feed_url", "is", null);

    if (feedError) throw feedError;

    const feeds = (feedRows ?? []) as CompetitorFeedRow[];

    let poolHealthy = 0;
    let poolBlocked = 0;
    let poolUnreachable = 0;
    let poolStale = 0;

    const poolResults = await processInChunks(feeds, CONCURRENCY, async (feed) => {
      const result = await checkFeedHealth(feed.feed_url!);
      return { feed, result };
    });

    const now = new Date().toISOString();

    for (const { feed, result } of poolResults) {
      // Update feed health state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("competitor_feeds")
        .update({
          feed_health_state: result.state,
          last_health_check_at: now,
        })
        .eq("id", feed.id);

      if (result.state === "healthy") poolHealthy++;
      else if (result.state === "blocked") poolBlocked++;
      else if (result.state === "unreachable") poolUnreachable++;
      else if (result.state === "stale") poolStale++;

      // Sentry warning for non-healthy feeds
      if (result.state !== "healthy") {
        Sentry.captureMessage(`feed_health_degraded`, {
          level: "warning",
          extra: {
            feed_id: feed.id,
            competitor_id: feed.competitor_id,
            pool_type: feed.pool_type,
            feed_url: feed.feed_url,
            health_state: result.state,
            http_status: result.httpStatus,
            error: result.error,
          },
        });
      }
    }

    // ── Part 2: SECTOR_MEDIA_SOURCES (pool 7) ────────────────────────────
    let mediaHealthy = 0;
    let mediaBlocked = 0;
    let mediaUnreachable = 0;
    let mediaStale = 0;

    const mediaResults = await processInChunks(
      SECTOR_MEDIA_SOURCES,
      CONCURRENCY,
      async (source) => {
        const result = await checkFeedHealth(source.feed_url);
        return { source, result };
      },
    );

    for (const { source, result } of mediaResults) {
      if (result.state === "healthy") mediaHealthy++;
      else if (result.state === "blocked") mediaBlocked++;
      else if (result.state === "unreachable") mediaUnreachable++;
      else if (result.state === "stale") mediaStale++;

      if (result.state !== "healthy") {
        Sentry.captureMessage(`media_feed_health_degraded`, {
          level: "warning",
          extra: {
            sector: source.sector,
            source_name: source.source_name,
            feed_url: source.feed_url,
            health_state: result.state,
            http_status: result.httpStatus,
            error: result.error,
          },
        });
      }
    }

    const runtimeMs = elapsed();

    void recordEvent({
      run_id: runId,
      stage: "feed_health_check",
      status: "success",
      duration_ms: runtimeMs,
      metadata: {
        pool_feeds: feeds.length,
        pool_healthy: poolHealthy,
        pool_blocked: poolBlocked,
        pool_unreachable: poolUnreachable,
        pool_stale: poolStale,
        media_sources: SECTOR_MEDIA_SOURCES.length,
        media_healthy: mediaHealthy,
        media_blocked: mediaBlocked,
        media_unreachable: mediaUnreachable,
        media_stale: mediaStale,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "check-feed-health", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "check-feed-health",
      poolFeeds: {
        total: feeds.length,
        healthy: poolHealthy,
        blocked: poolBlocked,
        unreachable: poolUnreachable,
        stale: poolStale,
      },
      mediaSources: {
        total: SECTOR_MEDIA_SOURCES.length,
        healthy: mediaHealthy,
        blocked: mediaBlocked,
        unreachable: mediaUnreachable,
        stale: mediaStale,
      },
      runtimeDurationMs: runtimeMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "check-feed-health", status: "error", checkInId });
    void recordEvent({
      run_id: runId,
      stage: "feed_health_check",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: serializeError(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("check-feed-health", handler);
