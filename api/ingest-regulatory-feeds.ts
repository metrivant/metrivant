import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";
import { compileCompetitorMatchers, matchCompetitors } from "../lib/procurement-matcher";
import { extractFilingType, ALLOWED_FILING_TYPES } from "../lib/regulatory-classifier";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Maximum pool_events entries to look back when checking for duplicates.
const DEDUP_LOOKBACK = 200;

// Maximum feed entries processed per source per run.
const MAX_ENTRIES_PER_FEED = 100;

// Regulatory filings can be retroactively published; wider window than other pools.
const MAX_ENTRY_AGE_DAYS = 365;
const MAX_ENTRY_AGE_MS   = MAX_ENTRY_AGE_DAYS * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 12_000;

// SEC EDGAR requires a descriptive User-Agent identifying the operator.
const EDGAR_USER_AGENT   = "Metrivant Regulatory Monitor (research@metrivant.com)";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)";

// Minimum gap between sequential EDGAR requests: 110ms ≈ 9 req/sec.
const EDGAR_REQUEST_GAP_MS = 110;

let lastEdgarRequestAt = 0;

interface CompetitorFeedRow {
  id:            string;
  competitor_id: string;
  feed_url:      string;
  source_type:   string;
}

interface RegulatorySourceRow {
  id:          string;
  feed_url:    string;
  source_type: string;
  source_name: string;
}

interface ExistingEvent {
  content_hash: string;
  filing_id:    string | null;
  event_url:    string | null;
}

async function fetchFeed(url: string, isEdgar: boolean): Promise<string> {
  // Enforce SEC rate limit — only applies when fetching EDGAR endpoints.
  if (isEdgar) {
    const gapMs = Date.now() - lastEdgarRequestAt;
    if (gapMs < EDGAR_REQUEST_GAP_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, EDGAR_REQUEST_GAP_MS - gapMs));
    }
    lastEdgarRequestAt = Date.now();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:   "GET",
      headers:  {
        "User-Agent": isEdgar ? EDGAR_USER_AGENT : DEFAULT_USER_AGENT,
        "Accept":     "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
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

// Extract the SEC EDGAR accession number from an entry URL or GUID.
// EDGAR accession numbers follow the pattern: XXXXXXXXXX-YY-ZZZZZZ
// They appear in:
//   - Entry GUIDs: "urn:tag:sec.gov,...:accession-number=XXXXXXXXXX-YY-ZZZZZZ"
//   - Entry link URLs: "/Archives/edgar/data/{cik}/{18-digit-run}/..."
function extractFilingId(
  eventUrl: string | null | undefined,
  guid:     string | null | undefined
): string | null {
  const candidates = [guid, eventUrl].filter(Boolean) as string[];

  for (const candidate of candidates) {
    // Formatted accession number: XXXXXXXXXX-YY-ZZZZZZ
    const formatted = candidate.match(/(\d{10}-\d{2}-\d{6})/);
    if (formatted) return formatted[1];

    // Unformatted 18-digit run in EDGAR Archives path: reformatted as above
    const archivePath = candidate.match(/\/edgar\/data\/\d+\/(\d{18})/);
    if (archivePath) {
      const raw = archivePath[1];
      return `${raw.slice(0, 10)}-${raw.slice(10, 12)}-${raw.slice(12)}`;
    }
  }

  return null;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "ingest-regulatory-feeds", status: "in_progress" });

  try {
    // ── Phase 1: Load competitor-scoped regulatory feeds (e.g., EDGAR Atom) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: competitorFeedRows, error: cfError } = await (supabase as any)
      .from("competitor_feeds")
      .select("id, competitor_id, feed_url, source_type")
      .eq("pool_type", "regulatory")
      .eq("discovery_status", "active")
      .not("feed_url", "is", null)
      .limit(50);

    if (cfError) throw cfError;

    // ── Phase 2: Load sector/regulator-scoped regulatory sources ──────────────
    // These are operator-configured feeds (FDA, FERC, etc.) that span multiple
    // companies. Entries require competitor name matching.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: regulatorySourceRows, error: rsError } = await (supabase as any)
      .from("regulatory_sources")
      .select("id, feed_url, source_type, source_name")
      .eq("active", true)
      .eq("discovery_status", "active")
      .limit(25);

    if (rsError) throw rsError;

    // ── Pre-load all tracked competitors for sector-source name matching ───────
    const regSources    = (regulatorySourceRows ?? []) as RegulatorySourceRow[];
    const hasRegSources = regSources.length > 0;

    type CompetitorRow = { id: string; name: string };
    let allCompetitors: CompetitorRow[] = [];
    if (hasRegSources) {
      const { data: compRows } = await supabase
        .from("competitors")
        .select("id, name")
        .eq("active", true);
      allCompetitors = (compRows ?? []) as CompetitorRow[];
    }

    const compiledMatchers = compileCompetitorMatchers(allCompetitors);

    const competitorFeeds = (competitorFeedRows ?? []) as CompetitorFeedRow[];
    const totalSources    = competitorFeeds.length + regSources.length;
    let   sourcesIngested = 0;
    let   sourcesFailed   = 0;
    let   eventsInserted  = 0;
    let   eventsDuplicate = 0;
    let   eventsFiltered  = 0; // dropped by filing whitelist
    let   eventsNoMatch   = 0; // sector entries with no competitor match

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: ingest filing entries into pool_events for a specific competitor.
    // ─────────────────────────────────────────────────────────────────────────
    async function ingestForCompetitor(
      competitorId: string,
      sourceType:   string,
      feedUrl:      string,
      entries:      ReturnType<typeof parseFeed>,
      isEdgar:      boolean
    ): Promise<{ inserted: number; duplicate: number; filtered: number }> {
      const now          = Date.now();
      const freshEntries = entries.filter((e) =>
        !e.published_at || (now - e.published_at.getTime()) <= MAX_ENTRY_AGE_MS
      );

      if (freshEntries.length === 0) return { inserted: 0, duplicate: 0, filtered: 0 };

      // Load existing events for this competitor to detect duplicates.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows } = await (supabase as any)
        .from("pool_events")
        .select("content_hash, filing_id, event_url")
        .eq("competitor_id", competitorId)
        .eq("event_type", "regulatory_filing")
        .order("created_at", { ascending: false })
        .limit(DEDUP_LOOKBACK);

      const existingHashes    = new Set<string>(
        ((existingRows ?? []) as ExistingEvent[]).map((r) => r.content_hash)
      );
      const existingFilingIds = new Set<string>(
        ((existingRows ?? []) as ExistingEvent[])
          .filter((r) => r.filing_id)
          .map((r) => r.filing_id as string)
      );
      const existingUrls = new Set<string>(
        ((existingRows ?? []) as ExistingEvent[])
          .filter((r) => r.event_url)
          .map((r) => r.event_url as string)
      );

      let inserted  = 0;
      let duplicate = 0;
      let filtered  = 0;

      const newRows: Record<string, unknown>[] = [];

      for (const entry of freshEntries) {
        // ── Filing whitelist filter ──────────────────────────────────────────
        // For EDGAR feeds: extract form type from title and drop non-whitelisted
        // filings (e.g., proxy supplements, insider reports, registration forms).
        // For non-EDGAR feeds: accept all entries; classification at promotion.
        let filingType: string | null = null;
        if (isEdgar) {
          filingType = extractFilingType(entry.title);
          if (!filingType || !ALLOWED_FILING_TYPES.has(filingType)) {
            filtered++;
            continue;
          }
        }

        // ── Dedup: content_hash (primary) ────────────────────────────────────
        if (existingHashes.has(entry.content_hash)) { duplicate++; continue; }

        // ── Dedup: event_url ─────────────────────────────────────────────────
        if (entry.event_url && existingUrls.has(entry.event_url)) { duplicate++; continue; }

        // ── Dedup: filing_id (stable EDGAR accession number) ─────────────────
        const filingId = extractFilingId(entry.event_url, entry.guid);
        if (filingId && existingFilingIds.has(filingId)) { duplicate++; continue; }

        newRows.push({
          competitor_id:        competitorId,
          source_type:          sourceType,
          source_url:           feedUrl,
          event_type:           "regulatory_filing",
          title:                entry.title.slice(0, 500),
          summary:              entry.summary ? entry.summary.slice(0, 2000) : null,
          event_url:            entry.event_url ?? null,
          published_at:         entry.published_at?.toISOString() ?? null,
          content_hash:         entry.content_hash,
          normalization_status: "pending",
          // Regulatory-specific columns
          filing_type:          filingType,
          regulatory_body:      isEdgar ? "SEC" : null,
          filing_id:            filingId,
          jurisdiction:         isEdgar ? "US" : null,
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

      return { inserted, duplicate, filtered };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Process competitor-scoped regulatory feeds
    // ─────────────────────────────────────────────────────────────────────────
    for (const feed of competitorFeeds) {
      const feedElapsed = startTimer();
      const isEdgar     = feed.source_type === "sec_feed";
      try {
        const xml     = await fetchFeed(feed.feed_url, isEdgar);
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

        const { inserted, duplicate, filtered } = await ingestForCompetitor(
          feed.competitor_id,
          feed.source_type,
          feed.feed_url,
          entries,
          isEdgar
        );

        eventsInserted  += inserted;
        eventsDuplicate += duplicate;
        eventsFiltered  += filtered;

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
          stage:  "regulatory_ingest",
          status: "success",
          duration_ms: feedElapsed(),
          metadata: {
            source_id:     feed.id,
            source_kind:   "competitor_feed",
            competitor_id: feed.competitor_id,
            entries_new:   inserted,
            filtered,
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
          stage:  "regulatory_ingest",
          status: "failure",
          duration_ms: feedElapsed(),
          metadata: { source_id: feed.id, error: String(feedError) },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Process sector/regulator-scoped regulatory sources (e.g., FDA, FERC feeds)
    // Each entry is matched against all tracked competitors by name.
    // One pool_event is created per matched competitor.
    // ─────────────────────────────────────────────────────────────────────────
    for (const source of regSources) {
      const sourceElapsed = startTimer();
      const isEdgar       = source.source_type === "sec_feed";
      try {
        const xml     = await fetchFeed(source.feed_url, isEdgar);
        const entries = parseFeed(xml).slice(0, MAX_ENTRIES_PER_FEED);

        if (entries.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("regulatory_sources")
            .update({ last_fetched_at: new Date().toISOString() })
            .eq("id", source.id);
          sourcesIngested += 1;
          continue;
        }

        let sourceInserted  = 0;
        let sourceDuplicate = 0;
        let sourceFiltered  = 0;
        let sourceNoMatch   = 0;

        for (const entry of entries) {
          // For EDGAR-format sector sources, apply the whitelist before matching.
          if (isEdgar) {
            const ft = extractFilingType(entry.title);
            if (!ft || !ALLOWED_FILING_TYPES.has(ft)) {
              sourceFiltered++;
              continue;
            }
          }

          // Attempt to extract filer/issuer name from common disclosure phrasing.
          const filerMatch = `${entry.title} ${entry.summary ?? ""}`.match(
            /(?:filed\s+by|submitted\s+by|reporting\s+person|registrant)[:\s]+([A-Z][^.,\n]{2,60})/i
          );
          const filerName = filerMatch ? filerMatch[1].trim() : null;

          // Match entry to tracked competitors by name.
          const matchedIds = matchCompetitors(filerName, entry.title, entry.summary, compiledMatchers);

          if (matchedIds.length === 0) {
            sourceNoMatch++;
            continue;
          }

          // Create a separate pool_event for each matched competitor.
          for (const competitorId of matchedIds) {
            const { inserted, duplicate, filtered } = await ingestForCompetitor(
              competitorId,
              source.source_type,
              source.feed_url,
              [entry],
              isEdgar
            );
            sourceInserted  += inserted;
            sourceDuplicate += duplicate;
            sourceFiltered  += filtered;
          }
        }

        eventsInserted  += sourceInserted;
        eventsDuplicate += sourceDuplicate;
        eventsFiltered  += sourceFiltered;
        eventsNoMatch   += sourceNoMatch;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("regulatory_sources")
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
          stage:  "regulatory_ingest",
          status: "success",
          duration_ms: sourceElapsed(),
          metadata: {
            source_id:        source.id,
            source_name:      source.source_name,
            source_kind:      "regulatory_source",
            entries_total:    entries.length,
            entries_matched:  sourceInserted + sourceDuplicate,
            entries_no_match: sourceNoMatch,
            entries_filtered: sourceFiltered,
          },
        });
      } catch (sourceError) {
        sourcesFailed += 1;
        Sentry.captureException(sourceError);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: currentSource } = await (supabase as any)
            .from("regulatory_sources")
            .select("consecutive_failures")
            .eq("id", source.id)
            .single();
          const failures = ((currentSource as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("regulatory_sources")
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
          stage:  "regulatory_ingest",
          status: "failure",
          duration_ms: sourceElapsed(),
          metadata: { source_id: source.id, source_name: source.source_name, error: String(sourceError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:      "ingest-regulatory-feeds",
      totalSources,
      sourcesIngested,
      sourcesFailed,
      eventsInserted,
      eventsDuplicate,
      eventsFiltered,
      eventsNoMatch,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "ingest-regulatory-feeds", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "ingest-regulatory-feeds",
      totalSources,
      sourcesIngested,
      sourcesFailed,
      eventsInserted,
      eventsDuplicate,
      eventsFiltered,
      eventsNoMatch,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "ingest-regulatory-feeds", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("ingest-regulatory-feeds", handler);
