import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseAtsResponse } from "../lib/ats-parser";
import { normalizeDepartment } from "../lib/department-normalizer";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import type { AtsType } from "../lib/ats-parser";

// Maximum pool_events to look back when checking for duplicates per competitor.
const DEDUP_LOOKBACK = 500;

// Maximum postings to process per ATS feed per run.
const MAX_POSTINGS_PER_FEED = 200;

// Maximum age of a job posting to ingest (90 days).
// Prevents mass-importing archived listings when a feed is newly discovered.
const MAX_POSTING_AGE_DAYS = 90;
const MAX_POSTING_AGE_MS   = MAX_POSTING_AGE_DAYS * 24 * 60 * 60 * 1000;

// Fetch timeout for ATS API calls.
const FETCH_TIMEOUT_MS = 10_000;

const USER_AGENT = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

interface FeedRow {
  id:           string;
  competitor_id: string;
  feed_url:     string;
  source_type:  string;
}

async function fetchAtsJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept":     "application/json",
      },
      signal:   controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  Sentry.captureCheckIn({ monitorSlug: "ingest-careers", status: "in_progress" });

  try {
    // ── Load active careers feed configurations ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedRows, error: feedsError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, source_type")
      .eq("pool_type", "careers")
      .eq("discovery_status", "active")
      .not("feed_url", "is", null)
      .not("source_type", "eq", "workday") // Workday: no structured API; careers page diff handles it
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
        // Fetch ATS JSON
        const json     = await fetchAtsJson(feed.feed_url);
        const atsType  = feed.source_type as AtsType;
        const postings = parseAtsResponse(atsType, json).slice(0, MAX_POSTINGS_PER_FEED);

        if (postings.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("competitor_feeds")
            .update({ last_fetched_at: new Date().toISOString() })
            .eq("id", feed.id);
          feedsIngested += 1;
          continue;
        }

        // Filter out postings that are too old
        const now           = Date.now();
        const freshPostings = postings.filter((p) => {
          const ts = new Date(p.publishedAt).getTime();
          return isNaN(ts) || (now - ts) <= MAX_POSTING_AGE_MS;
        });

        // Load existing content_hashes + external_event_ids for this competitor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingRows } = await (supabase as any)
          .from("pool_events")
          .select("content_hash, external_event_id")
          .eq("competitor_id", feed.competitor_id)
          .eq("event_type", "job_posting")
          .order("created_at", { ascending: false })
          .limit(DEDUP_LOOKBACK);

        const existingHashes = new Set<string>(
          ((existingRows ?? []) as { content_hash: string }[]).map((r) => r.content_hash)
        );
        const existingExternalIds = new Set<string>(
          ((existingRows ?? []) as { external_event_id: string | null }[])
            .filter((r) => r.external_event_id)
            .map((r) => r.external_event_id as string)
        );

        // Build rows for new postings only
        const newRows: Record<string, unknown>[] = [];
        for (const posting of freshPostings) {
          if (existingHashes.has(posting.contentHash)) {
            eventsDuplicate += 1;
            continue;
          }
          if (existingExternalIds.has(posting.externalId)) {
            eventsDuplicate += 1;
            continue;
          }

          const deptNormalized = normalizeDepartment(posting.department);

          newRows.push({
            competitor_id:        feed.competitor_id,
            source_type:          feed.source_type,
            source_url:           feed.feed_url,
            event_type:           "job_posting",
            title:                posting.title.slice(0, 500),
            summary:              null,
            event_url:            posting.postingUrl || null,
            published_at:         posting.publishedAt,
            content_hash:         posting.contentHash,
            normalization_status: "pending",
            // Careers-specific evidence columns
            external_event_id:    posting.externalId,
            department:           posting.department || null,
            location:             posting.location   || null,
            employment_type:      posting.employmentType || null,
            department_normalized: deptNormalized,
          });
        }

        // Bulk upsert — DB unique index on (competitor_id, external_event_id) is the safety net
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

        // Update feed metadata on success
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
          stage:  "careers_ingest",
          status: "success",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:         feed.id,
            competitor_id:   feed.competitor_id,
            ats_type:        feed.source_type,
            postings_parsed: postings.length,
            postings_fresh:  freshPostings.length,
            postings_new:    newRows.length,
          },
        });
      } catch (feedError) {
        feedsFailed += 1;
        Sentry.captureException(feedError);

        // Increment failure counter; mark feed_unavailable after 10 consecutive failures
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
          stage:  "careers_ingest",
          status: "failure",
          duration_ms: feedElapsed(),
          metadata: {
            feed_id:       feed.id,
            competitor_id: feed.competitor_id,
            ats_type:      feed.source_type,
            error:         feedError instanceof Error ? feedError.message : String(feedError),
          },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "ingest-careers",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "ingest-careers", status: "ok" });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "ingest-careers",
      feedsTotal,
      feedsIngested,
      feedsFailed,
      eventsInserted,
      eventsDuplicate,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "ingest-careers", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("ingest-careers", handler);
