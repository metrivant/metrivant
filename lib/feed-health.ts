// Feed health validation logic.
//
// Validates a feed URL by:
//   1. HTTP GET with timeout (feeds don't reliably support HEAD)
//   2. Check HTTP status
//   3. Parse response for most recent entry date
//   4. Classify health state: healthy | blocked | unreachable | stale
//
// Used by api/check-feed-health.ts (weekly cron).

import { parseFeed, FeedEntry } from "./feed-parser";

const FETCH_TIMEOUT_MS = 10_000;

// A feed is "stale" if its most recent entry is older than this.
const STALE_DAYS = 14;

export type FeedHealthState = "healthy" | "blocked" | "unreachable" | "stale";

export interface FeedHealthResult {
  state: FeedHealthState;
  httpStatus: number | null;
  latestEntryAt: string | null;
  entryCount: number;
  error: string | null;
}

/**
 * Validate a single feed URL and return its health state.
 */
export async function checkFeedHealth(feedUrl: string): Promise<FeedHealthResult> {
  let httpStatus: number | null = null;

  // Step 1: HTTP GET with timeout
  let body: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(feedUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Metrivant Feed Health Check (research@metrivant.com)",
          "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      httpStatus = res.status;

      if (res.status === 403 || res.status === 401) {
        return { state: "blocked", httpStatus, latestEntryAt: null, entryCount: 0, error: `http_${res.status}` };
      }
      if (res.status === 404 || res.status === 410) {
        return { state: "blocked", httpStatus, latestEntryAt: null, entryCount: 0, error: `http_${res.status}` };
      }
      if (!res.ok) {
        return { state: "unreachable", httpStatus, latestEntryAt: null, entryCount: 0, error: `http_${res.status}` };
      }

      body = await res.text();
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return {
      state: "unreachable",
      httpStatus: null,
      latestEntryAt: null,
      entryCount: 0,
      error: isTimeout ? "timeout" : msg.slice(0, 200),
    };
  }

  // Step 2: Parse feed entries
  let entries: FeedEntry[];
  try {
    entries = parseFeed(body);
  } catch {
    return { state: "blocked", httpStatus, latestEntryAt: null, entryCount: 0, error: "parse_failed" };
  }

  if (entries.length === 0) {
    return { state: "stale", httpStatus, latestEntryAt: null, entryCount: 0, error: "no_entries" };
  }

  // Step 3: Find most recent entry date
  const dates = entries
    .map((e) => e.published_at)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  const latestDate = dates.length > 0 ? dates[0] : null;
  const latestEntryAt = latestDate?.toISOString() ?? null;

  // Step 4: Check staleness
  if (latestDate) {
    const ageDays = (Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > STALE_DAYS) {
      return { state: "stale", httpStatus, latestEntryAt, entryCount: entries.length, error: null };
    }
  } else {
    // Entries exist but none have dates — can't determine freshness, assume stale.
    return { state: "stale", httpStatus, latestEntryAt: null, entryCount: entries.length, error: "no_dates" };
  }

  return { state: "healthy", httpStatus, latestEntryAt, entryCount: entries.length, error: null };
}
