import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { parseFeed } from "../lib/feed-parser";
import { SECTOR_MEDIA_SOURCES, getConfiguredSectors } from "../lib/sector-media-sources";
import { extractKeywords, computeContentHash } from "../lib/media-keyword-extractor";
import { generateRunId } from "../lib/pipeline-metrics";

// Cluster detection thresholds (see migrations/044_media_pool.sql spec).
const MIN_ARTICLES_FOR_CLUSTER = 5;
const MIN_SOURCES_FOR_CLUSTER  = 3;
const CLUSTER_WINDOW_DAYS      = 7;
const CLUSTER_WINDOW_MS        = CLUSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Representative URLs to store per cluster (top N by recency).
const MAX_REPRESENTATIVE_URLS = 3;

// Maximum articles we process from a single feed per run.
const MAX_ENTRIES_PER_FEED = 100;

// Maximum age of an article to ingest (14 days — media is ephemeral).
const MAX_ENTRY_AGE_DAYS = 14;
const MAX_ENTRY_AGE_MS   = MAX_ENTRY_AGE_DAYS * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaObservationRow {
  sector:       string;
  source_name:  string;
  title:        string;
  url:          string | null;
  published_at: string | null;
  content_hash: string;
  keywords:     string[];
}

interface StoredObservation {
  id:           string;
  sector:       string;
  source_name:  string;
  title:        string;
  url:          string | null;
  published_at: string | null;
  keywords:     string[];
}

// ── Feed fetch ────────────────────────────────────────────────────────────────

async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:   "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
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

// ── Cluster detection ─────────────────────────────────────────────────────────
//
// Operates on in-memory observations loaded from media_observations for
// this sector. No SQL array unnesting — all logic in TypeScript.
//
// A cluster exists when a keyword appears in ≥MIN_ARTICLES articles
// from ≥MIN_SOURCES distinct sources within the rolling window.
//
// Returns upsert rows for sector_narratives.

interface ClusterUpsertRow {
  sector:               string;
  theme_label:          string;
  keywords:             string[];
  source_count:         number;
  article_count:        number;
  representative_urls:  string[];
  first_detected_at:    string;
  last_detected_at:     string;
  confidence_score:     number;
}

function detectClusters(
  sector: string,
  observations: StoredObservation[],
  windowCutoff: Date,
): ClusterUpsertRow[] {
  // Filter to rolling window.
  const recent = observations.filter((o) => {
    if (!o.published_at) return false;
    return new Date(o.published_at) >= windowCutoff;
  });

  if (recent.length === 0) return [];

  // Build inverted index: keyword → list of observations containing it.
  const index = new Map<string, StoredObservation[]>();
  for (const obs of recent) {
    for (const kw of obs.keywords) {
      if (!index.has(kw)) index.set(kw, []);
      index.get(kw)!.push(obs);
    }
  }

  const clusters: ClusterUpsertRow[] = [];

  for (const [keyword, hits] of index) {
    const sourceNames   = new Set(hits.map((h) => h.source_name));
    const articleCount  = hits.length;
    const sourceCount   = sourceNames.size;

    if (articleCount < MIN_ARTICLES_FOR_CLUSTER) continue;
    if (sourceCount  < MIN_SOURCES_FOR_CLUSTER)  continue;

    // Collect all keywords co-occurring with the trigger keyword.
    const allKeywords = new Set<string>([keyword]);
    for (const hit of hits) {
      for (const kw of hit.keywords) allKeywords.add(kw);
    }

    // Sort hits by published_at descending to pick representative URLs.
    const sorted = [...hits].sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });

    const representativeUrls = sorted
      .filter((h) => h.url)
      .slice(0, MAX_REPRESENTATIVE_URLS)
      .map((h) => h.url as string);

    const dates = sorted
      .map((h) => h.published_at ? new Date(h.published_at) : null)
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());

    const firstDetected = new Date(Math.min(...dates));
    const lastDetected  = new Date(Math.max(...dates));

    // Confidence formula: min(1.0, (article_count/10) + (source_count/10))
    const confidenceScore = Math.min(1.0, articleCount / 10 + sourceCount / 10);

    // theme_label: normalized lowercase trigger keyword (upsert key).
    const themeLabel = keyword.toLowerCase().replace(/_/g, " ");

    clusters.push({
      sector,
      theme_label:         themeLabel,
      keywords:            [...allKeywords].sort(),
      source_count:        sourceCount,
      article_count:       articleCount,
      representative_urls: representativeUrls,
      first_detected_at:   firstDetected.toISOString(),
      last_detected_at:    lastDetected.toISOString(),
      confidence_score:    confidenceScore,
    });
  }

  return clusters;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "ingest-media-feeds", status: "in_progress" });

  const configuredSectors = getConfiguredSectors();
  let totalObservationsInserted = 0;
  let totalObservationsDuplicate = 0;
  let totalFeedsFetched = 0;
  let totalFeedsFailed  = 0;
  let totalNarrativesUpserted = 0;
  const sectorResults: Record<string, { inserted: number; duplicate: number; narratives: number }> = {};

  try {

    for (const sector of configuredSectors) {
      const sources = SECTOR_MEDIA_SOURCES.filter((s) => s.sector === sector);
      let sectorInserted  = 0;
      let sectorDuplicate = 0;

      // ── Step 1: Fetch + ingest media_observations for this sector ────────────

      // Build set of existing content_hashes for dedup (last 30 days).
      const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows } = await (supabase as any)
        .from("media_observations")
        .select("content_hash")
        .eq("sector", sector)
        .gte("created_at", cutoff30d.toISOString())
        .limit(2000);

      const existingHashes = new Set<string>(
        ((existingRows ?? []) as { content_hash: string }[]).map((r) => r.content_hash)
      );

      // Fetch all sources for this sector.
      for (const source of sources) {
        let xml: string;
        try {
          xml = await fetchFeedXml(source.feed_url);
          totalFeedsFetched++;
        } catch (err) {
          totalFeedsFailed++;
          Sentry.captureException(err, {
            extra: { sector, source_name: source.source_name, feed_url: source.feed_url },
          });
          continue;
        }

        let entries: ReturnType<typeof parseFeed>;
        try {
          entries = parseFeed(xml);
        } catch {
          totalFeedsFailed++;
          continue;
        }

        const now = Date.now();
        const freshEntries = entries
          .filter((e) => !e.published_at || (now - e.published_at.getTime()) <= MAX_ENTRY_AGE_MS)
          .slice(0, MAX_ENTRIES_PER_FEED);

        // Build rows for insertion.
        const toInsert: MediaObservationRow[] = [];
        for (const entry of freshEntries) {
          const hash = await computeContentHash(sector, source.source_name, entry.title);
          if (existingHashes.has(hash)) {
            sectorDuplicate++;
            continue;
          }

          const keywords = extractKeywords(entry.title, sector).keywords;
          // Skip articles that matched zero allowlist terms — not useful for clustering.
          if (keywords.length === 0) continue;

          toInsert.push({
            sector,
            source_name:  source.source_name,
            title:        entry.title,
            url:          entry.event_url ?? null,
            published_at: entry.published_at?.toISOString() ?? null,
            content_hash: hash,
            keywords,
          });

          // Add to local set so same-run duplicates from different feeds are caught.
          existingHashes.add(hash);
        }

        if (toInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (supabase as any)
            .from("media_observations")
            .insert(toInsert, { onConflict: "content_hash" });

          if (insertError) {
            Sentry.captureException(insertError, {
              extra: { sector, source_name: source.source_name },
            });
          } else {
            sectorInserted += toInsert.length;
          }
        }
      }

      totalObservationsInserted += sectorInserted;
      totalObservationsDuplicate += sectorDuplicate;

      // ── Step 2: Load all recent observations for cluster detection ────────────

      const windowCutoff = new Date(Date.now() - CLUSTER_WINDOW_MS);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: obsRows, error: obsError } = await (supabase as any)
        .from("media_observations")
        .select("id, sector, source_name, title, url, published_at, keywords")
        .eq("sector", sector)
        .gte("published_at", windowCutoff.toISOString())
        .order("published_at", { ascending: false })
        .limit(500);

      if (obsError) {
        Sentry.captureException(obsError, { extra: { sector } });
        sectorResults[sector] = { inserted: sectorInserted, duplicate: sectorDuplicate, narratives: 0 };
        continue;
      }

      const observations = (obsRows ?? []) as StoredObservation[];

      // ── Step 3: Detect clusters + upsert sector_narratives ───────────────────

      const clusterRows = detectClusters(sector, observations, windowCutoff);

      let sectorNarratives = 0;
      for (const cluster of clusterRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase as any)
          .from("sector_narratives")
          .upsert(cluster, { onConflict: "sector,theme_label" });

        if (upsertError) {
          Sentry.captureException(upsertError, { extra: { sector, theme_label: cluster.theme_label } });
        } else {
          sectorNarratives++;
        }
      }

      totalNarrativesUpserted += sectorNarratives;
      sectorResults[sector] = {
        inserted:   sectorInserted,
        duplicate:  sectorDuplicate,
        narratives: sectorNarratives,
      };
    }

    Sentry.captureCheckIn({ monitorSlug: "ingest-media-feeds", status: "ok", checkInId });

    res.status(200).json({
      ok:                    true,
      runId,
      sectors:               configuredSectors.length,
      feedsFetched:          totalFeedsFetched,
      feedsFailed:           totalFeedsFailed,
      observationsInserted:  totalObservationsInserted,
      observationsDuplicate: totalObservationsDuplicate,
      narrativesUpserted:    totalNarrativesUpserted,
      sectorBreakdown:       sectorResults,
    });

  } catch (err) {
    Sentry.captureCheckIn({ monitorSlug: "ingest-media-feeds", status: "error", checkInId });
    Sentry.captureException(err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : JSON.stringify(err), runId });
  }
}

export default withSentry("ingest-media-feeds", handler);
