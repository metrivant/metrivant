import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";

// ── activate-feed ──────────────────────────────────────────────────────────────
//
// Operator endpoint: manually activate a known feed URL for a competitor.
// Bypasses auto-discovery; validates the feed is reachable and parseable
// before writing to competitor_feeds.
//
// Use case: auto-discovery fails for fintech companies that distribute press
// via PR wire services (Business Wire, PR Newswire, GlobeNewswire) rather
// than domain-hosted RSS. The operator provides the known wire feed URL.
//
// Auth: requires CRON_SECRET in Authorization header (same as all runtime endpoints).
// Idempotent: re-activating an already-active feed with a new URL is safe.

const FETCH_TIMEOUT_MS = 10_000;

const VALID_POOL_TYPES = new Set([
  "newsroom",
  "careers",
  "investor",
  "product",
  "procurement",
  "regulatory",
]);

async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
        "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
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

  const body          = (req.body ?? {}) as Record<string, unknown>;
  const competitor_id = typeof body.competitor_id === "string" ? body.competitor_id.trim() : undefined;
  const feed_url      = typeof body.feed_url      === "string" ? body.feed_url.trim()      : undefined;
  const pool_type     = typeof body.pool_type     === "string" ? body.pool_type.trim()     : "newsroom";

  // ── Input validation ─────────────────────────────────────────────────────────
  if (!competitor_id || !feed_url) {
    return res.status(400).json({
      ok:     false,
      error:  "bad_request",
      reason: "competitor_id and feed_url are required",
    });
  }

  try {
    const u = new URL(feed_url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return res.status(400).json({ ok: false, error: "bad_request", reason: "feed_url must be http or https" });
    }
  } catch {
    return res.status(400).json({ ok: false, error: "bad_request", reason: "feed_url is not a valid URL" });
  }

  if (!VALID_POOL_TYPES.has(pool_type)) {
    return res.status(400).json({
      ok:     false,
      error:  "bad_request",
      reason: `pool_type must be one of: ${[...VALID_POOL_TYPES].join(", ")}`,
    });
  }

  // ── Fetch feed XML ────────────────────────────────────────────────────────────
  let xml: string;
  try {
    xml = await fetchFeedXml(feed_url);
  } catch (err) {
    return res.status(200).json({
      ok:     false,
      error:  "fetch_failed",
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Parse and validate ────────────────────────────────────────────────────────
  let entries: ReturnType<typeof parseFeed>;
  try {
    entries = parseFeed(xml);
  } catch {
    return res.status(200).json({ ok: false, error: "invalid_feed", reason: "parse_failed" });
  }

  if (entries.length === 0) {
    return res.status(200).json({ ok: false, error: "invalid_feed", reason: "no_items" });
  }

  // ── Activate in competitor_feeds ──────────────────────────────────────────────
  // Upsert: handles both the normal case (row exists, discovery_status=feed_unavailable)
  // and the edge case where no row exists for this competitor+pool_type yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("competitor_feeds")
    .upsert(
      {
        competitor_id,
        pool_type,
        feed_url,
        source_type:      "rss",            // default for manually-provided wire feeds
        discovery_status: "active",
        last_error:       null,
        discovered_at:    new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      },
      { onConflict: "competitor_id,pool_type" }
    );

  if (upsertError) {
    Sentry.captureException(upsertError);
    return res.status(500).json({ ok: false, error: "db_error", reason: upsertError.message });
  }

  Sentry.addBreadcrumb({
    category: "feed_activation",
    message:  "manual_feed_activated",
    level:    "info",
    data:     { competitor_id, feed_url, pool_type, items_found: entries.length },
  });

  return res.status(200).json({
    ok:            true,
    competitor_id,
    feed_url,
    pool_type,
    items_found:   entries.length,
    activated:     true,
  });
}

export default withSentry("activate-feed", handler);
