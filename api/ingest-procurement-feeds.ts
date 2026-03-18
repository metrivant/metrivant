import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";
import { compileCompetitorMatchers, matchCompetitors } from "../lib/procurement-matcher";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Maximum pool_events entries to look back for dedup per competitor.
const DEDUP_LOOKBACK = 200;

// Maximum feed entries processed per source per run.
const MAX_ENTRIES_PER_FEED = 100;

// Maximum age of a procurement entry to ingest (180 days).
// Government contract awards are often published weeks after the award date.
// Wider window than other pools to capture retroactive award publications.
const MAX_ENTRY_AGE_DAYS = 180;
const MAX_ENTRY_AGE_MS   = MAX_ENTRY_AGE_DAYS * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 10_000;

interface CompetitorFeedRow {
  id:            string;
  competitor_id: string;
  feed_url:      string;
  source_type:   string;
}

interface ProcurementSourceRow {
  id:          string;
  feed_url:    string;
  source_type: string;
  source_name: string;
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

// Extract a numeric contract value from a title or summary string.
// Handles patterns like "$50M", "$1.2B", "$500 million", "£25 million".
// Returns a USD-approximate value (no currency conversion — raw number only).
function extractContractValue(title: string, summary: string | null | undefined): number | null {
  const text = `${title} ${summary ?? ""}`;
  const m = text.match(/(?:\$|£|€|AUD|CAD)\s*(\d+(?:\.\d+)?)\s*(m|b|million|billion|mn|bn)\b/i);
  if (!m) return null;

  const raw = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "b" || unit === "bn" || unit === "billion") return raw * 1_000_000_000;
  if (unit === "m" || unit === "mn" || unit === "million") return raw * 1_000_000;
  return null;
}

// Extract a stable contract ID from the entry title or summary.
// Looks for patterns common in government procurement (US PIID, UK CCS refs).
function extractContractId(title: string, summary: string | null | undefined, guid: string | null | undefined): string | null {
  // GUID from structured procurement APIs (most reliable)
  // Only use if it looks like a contract ID (alphanumeric, no "http")
  if (guid && !guid.startsWith("http") && guid.length >= 6 && guid.length <= 64) {
    return guid;
  }

  const text = `${title} ${summary ?? ""}`;

  // US Federal PIID pattern: alphanumeric 13–20 char codes
  const piidMatch = text.match(/\b([A-Z]{4,6}\d{10,14})\b/);
  if (piidMatch) return piidMatch[1];

  // UK CCS/Crown Commercial reference patterns
  const ccsMatch = text.match(/\b(CCS-[A-Z0-9-]{6,20}|RM\d{4,6})\b/i);
  if (ccsMatch) return ccsMatch[1].toUpperCase();

  return null;
}

// Build a dedup set for a competitor's existing procurement events.
// Checks both content_hash and contract_id.
interface ExistingEvent {
  content_hash: string;
  contract_id:  string | null;
  event_url:    string | null;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "ingest-procurement-feeds", status: "in_progress" });

  try {
    // ── Phase 1: Load competitor-scoped procurement feeds ─────────────────────
    // These are feeds configured per-competitor (similar to all other pools).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: competitorFeedRows, error: cfError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, source_type")
      .eq("pool_type", "procurement")
      .eq("discovery_status", "active")
      .not("feed_url", "is", null)
      .limit(50);

    if (cfError) throw cfError;

    // ── Phase 2: Load sector-scoped procurement sources ───────────────────────
    // These are external government/portal feeds configured by operators.
    // Entries from these sources require competitor name matching.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sectorSourceRows, error: ssError } = await (supabase as any)
      .from("procurement_sources")
      .select("id, feed_url, source_type, source_name")
      .eq("active", true)
      .eq("discovery_status", "active")
      .limit(25);

    if (ssError) throw ssError;

    // ── Pre-load all tracked competitors for name matching ────────────────────
    // Used only for sector-scoped sources. If there are no sector sources,
    // this load is skipped for efficiency.
    const sectorSources = (sectorSourceRows ?? []) as ProcurementSourceRow[];
    const hasSectorSources = sectorSources.length > 0;

    type CompetitorRow = { id: string; name: string };
    let allCompetitors: CompetitorRow[] = [];
    if (hasSectorSources) {
      const { data: compRows } = await supabase
        .from("competitors")
        .select("id, name")
        .eq("active", true);
      allCompetitors = (compRows ?? []) as CompetitorRow[];
    }

    const compiledMatchers = compileCompetitorMatchers(allCompetitors);

    const competitorFeeds = (competitorFeedRows ?? []) as CompetitorFeedRow[];
    const totalSources    = competitorFeeds.length + sectorSources.length;
    let sourcesIngested   = 0;
    let sourcesFailed     = 0;
    let eventsInserted    = 0;
    let eventsDuplicate   = 0;
    let eventsNoMatch     = 0; // sector-sourced entries with no competitor match

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: ingest entries into pool_events for a specific competitor.
    // Returns { inserted, duplicate } counts for this competitor/source combo.
    // ─────────────────────────────────────────────────────────────────────────
    async function ingestForCompetitor(
      competitorId: string,
      sourceType:   string,
      feedUrl:      string,
      entries:      ReturnType<typeof parseFeed>,
      awardeeOverride?: string | null // for sector-source entries, the raw awardee_name
    ): Promise<{ inserted: number; duplicate: number }> {
      const now          = Date.now();
      const freshEntries = entries.filter((e) =>
        !e.published_at || (now - e.published_at.getTime()) <= MAX_ENTRY_AGE_MS
      );

      if (freshEntries.length === 0) return { inserted: 0, duplicate: 0 };

      // Load existing events for this competitor for dedup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows } = await (supabase as any)
        .from("pool_events")
        .select("content_hash, contract_id, event_url")
        .eq("competitor_id", competitorId)
        .eq("event_type", "procurement_event")
        .order("created_at", { ascending: false })
        .limit(DEDUP_LOOKBACK);

      const existingHashes      = new Set<string>(((existingRows ?? []) as ExistingEvent[]).map((r) => r.content_hash));
      const existingContractIds = new Set<string>(
        ((existingRows ?? []) as ExistingEvent[]).filter((r) => r.contract_id).map((r) => r.contract_id as string)
      );
      const existingUrls = new Set<string>(
        ((existingRows ?? []) as ExistingEvent[]).filter((r) => r.event_url).map((r) => r.event_url as string)
      );

      let inserted  = 0;
      let duplicate = 0;

      const newRows: Record<string, unknown>[] = [];
      for (const entry of freshEntries) {
        // Dedup by content_hash (primary)
        if (existingHashes.has(entry.content_hash)) { duplicate++; continue; }
        // Dedup by event_url
        if (entry.event_url && existingUrls.has(entry.event_url)) { duplicate++; continue; }

        // Extract structured fields
        const contractId    = extractContractId(entry.title, entry.summary, entry.guid);
        const contractValue = extractContractValue(entry.title, entry.summary);

        // Dedup by contract_id (when available — prevents re-ingesting the same award)
        if (contractId && existingContractIds.has(contractId)) { duplicate++; continue; }

        newRows.push({
          competitor_id:        competitorId,
          source_type:          sourceType,
          source_url:           feedUrl,
          event_type:           "procurement_event",
          title:                entry.title.slice(0, 500),
          summary:              entry.summary ? entry.summary.slice(0, 2000) : null,
          event_url:            entry.event_url ?? null,
          published_at:         entry.published_at?.toISOString() ?? null,
          content_hash:         entry.content_hash,
          normalization_status: "pending",
          awardee_name:         awardeeOverride ?? null,
          contract_id:          contractId,
          contract_value:       contractValue,
          // buyer_name, currency, program_name, region: extracted later
          // or left NULL if not parseable from unstructured title/summary
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
          inserted = newRows.length;
        }
      }

      return { inserted, duplicate };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Process competitor-scoped procurement feeds
    // ─────────────────────────────────────────────────────────────────────────
    for (const feed of competitorFeeds) {
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
          sourcesIngested += 1;
          continue;
        }

        const { inserted, duplicate } = await ingestForCompetitor(
          feed.competitor_id,
          feed.source_type,
          feed.feed_url,
          entries
        );

        eventsInserted  += inserted;
        eventsDuplicate += duplicate;

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

        sourcesIngested += 1;
        void recordEvent({
          run_id: runId,
          stage:  "procurement_ingest",
          status: "success",
          duration_ms: feedElapsed(),
          metadata: {
            source_id:     feed.id,
            source_kind:   "competitor_feed",
            competitor_id: feed.competitor_id,
            entries_new:   inserted,
          },
        });
      } catch (feedError) {
        sourcesFailed += 1;
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
          stage:  "procurement_ingest",
          status: "failure",
          duration_ms: feedElapsed(),
          metadata: { source_id: feed.id, error: String(feedError) },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Process sector-scoped procurement sources (government feeds etc.)
    // Each entry is matched against all tracked competitors by name.
    // One pool_event is created per matched competitor.
    // ─────────────────────────────────────────────────────────────────────────
    for (const source of sectorSources) {
      const sourceElapsed = startTimer();
      try {
        const xml     = await fetchFeedXml(source.feed_url);
        const entries = parseFeed(xml).slice(0, MAX_ENTRIES_PER_FEED);

        if (entries.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("procurement_sources")
            .update({ last_fetched_at: new Date().toISOString() })
            .eq("id", source.id);
          sourcesIngested += 1;
          continue;
        }

        let sourceInserted  = 0;
        let sourceDuplicate = 0;
        let sourceNoMatch   = 0;

        for (const entry of entries) {
          // Extract awardee_name from title/summary heuristically.
          // Government feeds often put the company name right after "awarded to".
          const awardeeMatch = `${entry.title} ${entry.summary ?? ""}`.match(
            /(?:awarded\s+to|selected\s+vendor|winning\s+bid(?:der)?(?:\s+is)?)[:\s]+([A-Z][^.,\n]{2,60})/i
          );
          const awardeeRaw = awardeeMatch ? awardeeMatch[1].trim() : null;

          // Match entry to tracked competitors
          const matchedIds = matchCompetitors(awardeeRaw, entry.title, entry.summary, compiledMatchers);

          if (matchedIds.length === 0) {
            sourceNoMatch += 1;
            continue;
          }

          // Create a pool_event for each matched competitor (separate evidence records)
          for (const competitorId of matchedIds) {
            const { inserted, duplicate } = await ingestForCompetitor(
              competitorId,
              source.source_type,
              source.feed_url,
              [entry],
              awardeeRaw
            );
            sourceInserted  += inserted;
            sourceDuplicate += duplicate;
          }
        }

        eventsInserted  += sourceInserted;
        eventsDuplicate += sourceDuplicate;
        eventsNoMatch   += sourceNoMatch;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("procurement_sources")
          .update({
            last_fetched_at:      new Date().toISOString(),
            consecutive_failures: 0,
            last_error:           null,
            updated_at:           new Date().toISOString(),
          })
          .eq("id", source.id);

        sourcesIngested += 1;
        void recordEvent({
          run_id: runId,
          stage:  "procurement_ingest",
          status: "success",
          duration_ms: sourceElapsed(),
          metadata: {
            source_id:         source.id,
            source_name:       source.source_name,
            source_kind:       "sector_source",
            entries_total:     entries.length,
            entries_matched:   sourceInserted + sourceDuplicate,
            entries_no_match:  sourceNoMatch,
          },
        });
      } catch (sourceError) {
        sourcesFailed += 1;
        Sentry.captureException(sourceError);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: currentSource } = await (supabase as any)
            .from("procurement_sources")
            .select("consecutive_failures")
            .eq("id", source.id)
            .single();
          const failures = ((currentSource as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("procurement_sources")
            .update({
              consecutive_failures: failures,
              last_error:           sourceError instanceof Error ? sourceError.message : String(sourceError),
              discovery_status:     failures >= 10 ? "feed_unavailable" : "active",
              updated_at:           new Date().toISOString(),
            })
            .eq("id", source.id);
        } catch (updateErr) {
          Sentry.captureException(updateErr);
        }

        void recordEvent({
          run_id: runId,
          stage:  "procurement_ingest",
          status: "failure",
          duration_ms: sourceElapsed(),
          metadata: { source_id: source.id, source_name: source.source_name, error: String(sourceError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:      "ingest-procurement-feeds",
      totalSources,
      sourcesIngested,
      sourcesFailed,
      eventsInserted,
      eventsDuplicate,
      eventsNoMatch,
      runtimeDurationMs,
    });

    // Warn when active sources were ingested successfully but produced zero new events.
    // eventsDuplicate === 0 excludes normal steady-state dedup.
    if (totalSources > 0 && sourcesIngested > 0 && eventsInserted === 0 && eventsDuplicate === 0) {
      Sentry.captureMessage("ingest_procurement_feeds_empty_entries", "warning");
    }

    Sentry.captureCheckIn({ monitorSlug: "ingest-procurement-feeds", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "ingest-procurement-feeds",
      totalSources,
      sourcesIngested,
      sourcesFailed,
      eventsInserted,
      eventsDuplicate,
      eventsNoMatch,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "ingest-procurement-feeds", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("ingest-procurement-feeds", handler);
