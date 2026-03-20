// Retroactive feed discovery for all existing competitors.
//
// Competitors onboarded before pool infrastructure was built have no competitor_feeds
// rows — pool ingestion produces nothing for them. This endpoint closes that gap by
// running the same discovery logic as onboard-competitor (steps 4–9) across every
// active competitor, skipping pools that are already active.
//
// Safety:
//   - Never overwrites active feeds (discovery_status = 'active' is always skipped).
//   - Competitors already fully covered are skipped entirely.
//   - EDGAR requests are processed sequentially to respect SEC rate limits.
//   - All other pool discoveries run in parallel within each competitor chunk.
//
// Schedule: weekly, Sunday 07:00 UTC (after expand-coverage at 06:00).
// maxDuration: 90s (set in vercel.json functions block).

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { discoverFeed } from "../lib/feed-discovery";
import { discoverAts } from "../lib/ats-discovery";
import { discoverInvestorFeed } from "../lib/investor-feed-discovery";
import { discoverProductFeed } from "../lib/product-feed-discovery";
import { discoverEdgarFeed } from "../lib/edgar-discovery";
import { recordEvent, generateRunId } from "../lib/pipeline-metrics";

// ── Config ─────────────────────────────────────────────────────────────────────

const CONCURRENCY        = 5;   // competitors processed in parallel per chunk
const WALL_CLOCK_GUARD_MS = 80_000; // leave 10s buffer before maxDuration=90s

// Procurement: path-probe only (no lib — mirrors onboard-competitor step 8)
const PROCUREMENT_FEED_PATHS = [
  "/contracts/feed",
  "/contracts/feed.xml",
  "/contracts/rss",
  "/awards/feed",
  "/awards/feed.xml",
  "/awards/rss",
  "/procurement/feed",
  "/procurement/feed.xml",
  "/procurement/rss",
];

// ── Types ──────────────────────────────────────────────────────────────────────

const POOL_TYPES = ["newsroom", "careers", "investor", "product", "procurement", "regulatory"] as const;
type PoolType = typeof POOL_TYPES[number];

type PoolStats = { found: number; skipped: number; unavailable: number; error: number };

type CompetitorRow = { id: string; name: string; website_url: string; domain: string };
type FeedRow       = { pool_type: string; discovery_status: string };
type PageRow       = { page_type: string; url: string };

// ── Procurement probe ──────────────────────────────────────────────────────────

async function probeProcurementFeed(baseUrl: string): Promise<string | null> {
  const base = baseUrl.replace(/\/$/, "");
  for (const path of PROCUREMENT_FEED_PATHS) {
    try {
      const resp = await fetch(base + path, {
        method:  "GET",
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signal: (AbortSignal as any).timeout(5000),
      });
      if (resp.ok) {
        const ct = resp.headers.get("content-type") ?? "";
        if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
          return base + path;
        }
      }
    } catch {
      // try next path
    }
  }
  return null;
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "backfill-feeds", status: "in_progress" });
  const runId     = generateRunId();
  const startedAt = Date.now();

  const stats: Record<PoolType, PoolStats> = {
    newsroom:    { found: 0, skipped: 0, unavailable: 0, error: 0 },
    careers:     { found: 0, skipped: 0, unavailable: 0, error: 0 },
    investor:    { found: 0, skipped: 0, unavailable: 0, error: 0 },
    product:     { found: 0, skipped: 0, unavailable: 0, error: 0 },
    procurement: { found: 0, skipped: 0, unavailable: 0, error: 0 },
    regulatory:  { found: 0, skipped: 0, unavailable: 0, error: 0 },
  };

  let competitorsProcessed = 0;
  let budgetExhausted      = false;

  try {
    // 1. Fetch all active competitors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: competitors, error: compErr } = await (supabase as any)
      .from("competitors")
      .select("id, name, website_url, domain")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (compErr) throw compErr;

    const allCompetitors = (competitors ?? []) as CompetitorRow[];

    // Collect competitors that need EDGAR regulatory discovery.
    // Must run sequentially after all parallel work — SEC rate limit: 10 req/s.
    const regulatoryQueue: CompetitorRow[] = [];

    // 2. Process competitors in parallel chunks
    for (let i = 0; i < allCompetitors.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        budgetExhausted = true;
        Sentry.captureMessage("backfill_feeds_budget_exhausted", "warning");
        break;
      }

      const chunk = allCompetitors.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (competitor) => {
        const { id, name, website_url, domain } = competitor;
        const baseUrl = website_url.replace(/\/$/, "");

        try {
          // Fetch existing feeds + relevant page URLs in parallel
          const [feedsRes, pagesRes] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
              .from("competitor_feeds")
              .select("pool_type, discovery_status")
              .eq("competitor_id", id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
              .from("monitored_pages")
              .select("page_type, url")
              .eq("competitor_id", id)
              .eq("active", true)
              .in("page_type", ["newsroom", "careers", "changelog", "blog"]),
          ]);

          const existingFeeds = (feedsRes.data ?? []) as FeedRow[];
          const pages         = (pagesRes.data  ?? []) as PageRow[];

          // Map of pool_type → discovery_status for existing rows
          const feedStatusMap = new Map<string, string>(
            existingFeeds.map((f) => [f.pool_type, f.discovery_status])
          );

          // Only attempt discovery when pool is not already active
          const needsDiscovery = (pool: PoolType): boolean =>
            feedStatusMap.get(pool) !== "active";

          // Resolve page URLs for discovery hints
          const newsroomUrl  = pages.find((p) => p.page_type === "newsroom")?.url;
          const careersUrl   = pages.find((p) => p.page_type === "careers")?.url;
          const changelogUrl = pages.find((p) => p.page_type === "changelog")?.url;
          const blogUrl      = pages.find((p) => p.page_type === "blog")?.url;
          const productPageUrl = changelogUrl ?? blogUrl;

          // Queue regulatory for sequential EDGAR processing
          if (needsDiscovery("regulatory")) {
            regulatoryQueue.push(competitor);
          } else {
            stats.regulatory.skipped += 1;
          }

          // Run all non-regulatory pool discoveries in parallel
          const poolTasks: Array<Promise<void>> = [];

          // ── newsroom ──────────────────────────────────────────────────────────
          if (needsDiscovery("newsroom")) {
            poolTasks.push(
              discoverFeed(baseUrl, newsroomUrl)
                .then(async (result) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (supabase as any)
                    .from("competitor_feeds")
                    .upsert(
                      {
                        competitor_id:    id,
                        pool_type:        "newsroom",
                        feed_url:         result.found ? result.url         : null,
                        source_type:      result.found ? result.source_type : "rss",
                        discovery_status: result.found ? "active"           : "feed_unavailable",
                        last_error:       result.found ? null               : result.reason,
                        discovered_at:    new Date().toISOString(),
                        updated_at:       new Date().toISOString(),
                      },
                      { onConflict: "competitor_id,pool_type" }
                    );
                  stats.newsroom[result.found ? "found" : "unavailable"] += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: result.found ? "success" : "skipped", metadata: { competitor_id: id, pool: "newsroom", result: result.found ? "found" : result.reason } });
                })
                .catch((err) => {
                  stats.newsroom.error += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "newsroom", error: String(err) } });
                })
            );
          } else {
            stats.newsroom.skipped += 1;
          }

          // ── careers ───────────────────────────────────────────────────────────
          if (needsDiscovery("careers")) {
            poolTasks.push(
              discoverAts(domain, careersUrl)
                .then(async (result) => {
                  if (result.found) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                      .from("competitor_feeds")
                      .upsert(
                        {
                          competitor_id:    id,
                          pool_type:        "careers",
                          feed_url:         result.endpointUrl,
                          source_type:      result.atsType,
                          discovery_status: "active",
                          last_error:       null,
                          discovered_at:    new Date().toISOString(),
                          updated_at:       new Date().toISOString(),
                        },
                        { onConflict: "competitor_id,pool_type" }
                      );
                    stats.careers.found += 1;
                  } else {
                    // Record the attempt. Only upsert if no row exists (preserve existing unavailable records).
                    if (!feedStatusMap.has("careers")) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await (supabase as any)
                        .from("competitor_feeds")
                        .upsert(
                          {
                            competitor_id:    id,
                            pool_type:        "careers",
                            feed_url:         null,
                            source_type:      "greenhouse", // placeholder; updated if discovered later
                            discovery_status: "feed_unavailable",
                            last_error:       result.reason,
                            discovered_at:    new Date().toISOString(),
                            updated_at:       new Date().toISOString(),
                          },
                          { onConflict: "competitor_id,pool_type" }
                        );
                    }
                    stats.careers.unavailable += 1;
                  }
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: result.found ? "success" : "skipped", metadata: { competitor_id: id, pool: "careers", result: result.found ? result.atsType : result.reason } });
                })
                .catch((err) => {
                  stats.careers.error += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "careers", error: String(err) } });
                })
            );
          } else {
            stats.careers.skipped += 1;
          }

          // ── investor ──────────────────────────────────────────────────────────
          if (needsDiscovery("investor")) {
            poolTasks.push(
              discoverInvestorFeed(baseUrl, domain)
                .then(async (result) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (supabase as any)
                    .from("competitor_feeds")
                    .upsert(
                      {
                        competitor_id:    id,
                        pool_type:        "investor",
                        feed_url:         result.found ? result.url         : null,
                        source_type:      result.found ? result.source_type : "investor_rss",
                        discovery_status: result.found ? "active"           : "feed_unavailable",
                        last_error:       result.found ? null               : result.reason,
                        discovered_at:    new Date().toISOString(),
                        updated_at:       new Date().toISOString(),
                      },
                      { onConflict: "competitor_id,pool_type" }
                    );
                  stats.investor[result.found ? "found" : "unavailable"] += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: result.found ? "success" : "skipped", metadata: { competitor_id: id, pool: "investor", result: result.found ? "found" : result.reason } });
                })
                .catch((err) => {
                  stats.investor.error += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "investor", error: String(err) } });
                })
            );
          } else {
            stats.investor.skipped += 1;
          }

          // ── product ───────────────────────────────────────────────────────────
          if (needsDiscovery("product")) {
            poolTasks.push(
              discoverProductFeed(baseUrl, domain, productPageUrl)
                .then(async (result) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (supabase as any)
                    .from("competitor_feeds")
                    .upsert(
                      {
                        competitor_id:    id,
                        pool_type:        "product",
                        feed_url:         result.found ? result.url         : null,
                        source_type:      result.found ? result.source_type : "changelog_feed",
                        discovery_status: result.found ? "active"           : "feed_unavailable",
                        last_error:       result.found ? null               : result.reason,
                        discovered_at:    new Date().toISOString(),
                        updated_at:       new Date().toISOString(),
                      },
                      { onConflict: "competitor_id,pool_type" }
                    );
                  stats.product[result.found ? "found" : "unavailable"] += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: result.found ? "success" : "skipped", metadata: { competitor_id: id, pool: "product", result: result.found ? result.source_type : result.reason } });
                })
                .catch((err) => {
                  stats.product.error += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "product", error: String(err) } });
                })
            );
          } else {
            stats.product.skipped += 1;
          }

          // ── procurement ───────────────────────────────────────────────────────
          if (needsDiscovery("procurement")) {
            poolTasks.push(
              probeProcurementFeed(baseUrl)
                .then(async (feedUrl) => {
                  const sourceType = feedUrl?.includes("atom") ? "award_feed" : "procurement_feed";
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (supabase as any)
                    .from("competitor_feeds")
                    .upsert(
                      {
                        competitor_id:    id,
                        pool_type:        "procurement",
                        feed_url:         feedUrl,
                        source_type:      feedUrl ? sourceType : "procurement_feed",
                        discovery_status: feedUrl ? "active"   : "feed_unavailable",
                        last_error:       feedUrl ? null        : "no_procurement_feed_at_common_paths",
                        discovered_at:    new Date().toISOString(),
                        updated_at:       new Date().toISOString(),
                      },
                      { onConflict: "competitor_id,pool_type" }
                    );
                  stats.procurement[feedUrl ? "found" : "unavailable"] += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: feedUrl ? "success" : "skipped", metadata: { competitor_id: id, pool: "procurement", result: feedUrl ?? "unavailable" } });
                })
                .catch((err) => {
                  stats.procurement.error += 1;
                  recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "procurement", error: String(err) } });
                })
            );
          } else {
            stats.procurement.skipped += 1;
          }

          await Promise.all(poolTasks);

        } catch (err) {
          // Per-competitor error — non-fatal, continue to next
          Sentry.captureException(err, { extra: { competitor_id: id, name, stage: "backfill_feeds_chunk" } });
        }

        competitorsProcessed += 1;
      }));
    }

    // 3. Process regulatory (EDGAR) sequentially — SEC rate limit: max 10 req/s.
    //    Each discoverEdgarFeed call makes 2 sequential EDGAR requests with 110ms gap.
    for (const competitor of regulatoryQueue) {
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        budgetExhausted = true;
        break;
      }

      const { id, name, domain } = competitor;
      try {
        const edgarResult = await discoverEdgarFeed(name, domain);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:    id,
              pool_type:        "regulatory",
              feed_url:         edgarResult.found ? edgarResult.feedUrl    : null,
              source_type:      edgarResult.source_type,
              discovery_status: edgarResult.found ? "active"              : "feed_unavailable",
              last_error:       edgarResult.found ? null                  : "edgar_not_found",
              discovered_at:    new Date().toISOString(),
              updated_at:       new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );

        stats.regulatory[edgarResult.found ? "found" : "unavailable"] += 1;
        recordEvent({ run_id: runId, stage: "feed_backfill", status: edgarResult.found ? "success" : "skipped", metadata: { competitor_id: id, pool: "regulatory", cik: edgarResult.cik ?? null } });

      } catch (err) {
        stats.regulatory.error += 1;
        recordEvent({ run_id: runId, stage: "feed_backfill", status: "failure", metadata: { competitor_id: id, pool: "regulatory", error: String(err) } });
        Sentry.captureException(err, { extra: { competitor_id: id, name, stage: "backfill_feeds_edgar" } });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.captureCheckIn({ monitorSlug: "backfill-feeds", status: "ok", checkInId });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok:                   true,
      competitorsProcessed,
      regulatoryProcessed:  regulatoryQueue.length,
      budgetExhausted,
      runtimeDurationMs,
      stats,
    });

  } catch (err) {
    const runtimeDurationMs = Date.now() - startedAt;
    Sentry.captureException(err);
    Sentry.captureCheckIn({ monitorSlug: "backfill-feeds", status: "error", checkInId });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: String(err), runtimeDurationMs });
  }
}

export default withSentry("backfill-feeds", handler);
