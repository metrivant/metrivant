import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId, serializeError } from "../lib/pipeline-metrics";
import { discoverFeedUrl } from "../lib/feed-repair";

// ── /api/repair-feeds ─────────────────────────────────────────────────────────
// Weekly: Sunday 06:30 UTC (after check-feed-health at 06:00)
//
// Auto-repairs competitor_feeds with feed_health_state = blocked|unreachable|stale.
// Attempts to discover a new feed URL via common RSS path patterns + HTML link tags.
//
// Escalation:
//   - 1st week: attempt discovery, if found → update feed_url + reset health
//   - 3+ weeks broken (consecutive_failures >= 3): deactivate feed
//
// Only repairs newsroom + product feeds (RSS-based). Careers/investor/regulatory
// use API endpoints that can't be auto-discovered.

const REPAIRABLE_POOLS = ["newsroom", "product"];
const MAX_FEEDS_PER_RUN = 20;
const DEACTIVATE_AFTER_WEEKS = 3; // consecutive_failures threshold

interface BrokenFeed {
  id: string;
  competitor_id: string;
  feed_url: string;
  pool_type: string;
  consecutive_failures: number;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "repair-feeds", status: "in_progress" });

  try {
    // ── Load broken feeds ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedRows, error: feedErr } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, pool_type, consecutive_failures")
      .in("feed_health_state", ["blocked", "unreachable", "stale"])
      .in("pool_type", REPAIRABLE_POOLS)
      .not("feed_url", "is", null)
      .order("consecutive_failures", { ascending: false })
      .limit(MAX_FEEDS_PER_RUN);

    if (feedErr) throw feedErr;

    const brokenFeeds = (feedRows ?? []) as BrokenFeed[];

    if (brokenFeeds.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "repair-feeds", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "repair-feeds", processed: 0 });
    }

    // ── Load competitor domains ───────────────────────────────────────────
    const compIds = [...new Set(brokenFeeds.map((f) => f.competitor_id))];
    const { data: compRows } = await supabase
      .from("competitors")
      .select("id, website_url")
      .in("id", compIds);

    const domainMap = new Map<string, string>();
    for (const c of (compRows ?? []) as { id: string; website_url: string }[]) {
      domainMap.set(c.id, c.website_url);
    }

    // ── Process each broken feed ──────────────────────────────────────────
    let repaired = 0;
    let deactivated = 0;
    let skipped = 0;

    for (const feed of brokenFeeds) {
      const domain = domainMap.get(feed.competitor_id);
      if (!domain) { skipped++; continue; }

      // Check if feed should be deactivated (broken too long)
      if (feed.consecutive_failures >= DEACTIVATE_AFTER_WEEKS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .update({
            discovery_status: "feed_unavailable",
            feed_health_state: "unreachable",
            last_error: "deactivated_after_repeated_failures",
          })
          .eq("id", feed.id);

        deactivated++;
        Sentry.captureMessage("feed_deactivated_repeated_failure", {
          level: "warning",
          extra: { feed_id: feed.id, pool_type: feed.pool_type, failures: feed.consecutive_failures },
        });

        void recordEvent({
          run_id: runId,
          stage: "feed_repair",
          status: "success",
          metadata: { feed_id: feed.id, action: "deactivated", failures: feed.consecutive_failures },
        });
        continue;
      }

      // Attempt feed discovery
      const result = await discoverFeedUrl(domain, feed.pool_type);

      if (result.found && result.feedUrl) {
        // Update feed URL + reset health
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .update({
            feed_url: result.feedUrl,
            feed_health_state: "healthy",
            consecutive_failures: 0,
            last_error: null,
            discovery_status: "active",
          })
          .eq("id", feed.id);

        repaired++;
        void recordEvent({
          run_id: runId,
          stage: "feed_repair",
          status: "success",
          metadata: {
            feed_id: feed.id,
            action: "repaired",
            old_url: feed.feed_url,
            new_url: result.feedUrl,
            method: result.method,
            entries: result.entryCount,
          },
        });
      } else {
        // Increment failure counter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .update({ consecutive_failures: feed.consecutive_failures + 1 })
          .eq("id", feed.id);

        skipped++;
        void recordEvent({
          run_id: runId,
          stage: "feed_repair",
          status: "skipped",
          metadata: { feed_id: feed.id, action: "no_replacement_found", failures: feed.consecutive_failures + 1 },
        });
      }
    }

    void recordEvent({
      run_id: runId,
      stage: "feed_repair",
      status: "success",
      duration_ms: elapsed(),
      metadata: { processed: brokenFeeds.length, repaired, deactivated, skipped },
    });

    Sentry.captureCheckIn({ monitorSlug: "repair-feeds", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "repair-feeds",
      processed: brokenFeeds.length,
      repaired,
      deactivated,
      skipped,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "repair-feeds", status: "error", checkInId });
    void recordEvent({ run_id: runId, stage: "feed_repair", status: "failure", duration_ms: elapsed(), metadata: { error: serializeError(error) } });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("repair-feeds", handler);
