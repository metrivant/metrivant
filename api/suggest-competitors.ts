import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { extractCompanyEntities } from "../lib/media-entity-extractor";
import { scoreCompetitorSuggestion } from "../lib/competitor-scorer";

// ── /api/suggest-competitors ──────────────────────────────────────────────────
// Weekly: Sunday 08:00 UTC
//
// Extracts company names from recent media_observations, cross-references against
// existing competitors, scores new entities, and auto-accepts/rejects based on score.
//
// Auto-accepted competitors are onboarded via the runtime API (fire-and-forget).
// Rejected suggestions are recorded for audit trail.
// Pending suggestions appear in the ops dashboard.

const OBSERVATION_WINDOW_DAYS = 14;
const BATCH_SIZE = 50;  // titles per GPT call
const MIN_ARTICLES = 3; // minimum mentions to consider
const MIN_SOURCES  = 2; // minimum distinct sources

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaObs {
  title:        string;
  source_name:  string;
  sector:       string;
  url:          string | null;
  published_at: string | null;
}

interface EntityAggregation {
  name:         string;
  sector:       string;
  articles:     MediaObs[];
  sourceNames:  Set<string>;
  urls:         string[];
  firstSeen:    Date;
  lastSeen:     Date;
}

// ── Domain discovery ──────────────────────────────────────────────────────────

async function discoverDomain(companyName: string): Promise<string | null> {
  // Try common domain patterns
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slug}.io`,
    `https://${slug}.io`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
        });
        if (res.ok) return url;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "suggest-competitors", status: "in_progress" });

  try {
    const windowCutoff = new Date(Date.now() - OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // ── Load recent media observations ────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: obsRows, error: obsErr } = await (supabase as any)
      .from("media_observations")
      .select("title, source_name, sector, url, published_at")
      .gte("published_at", windowCutoff)
      .order("published_at", { ascending: false })
      .limit(500);

    if (obsErr) throw obsErr;

    const observations = (obsRows ?? []) as MediaObs[];
    if (observations.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "suggest-competitors", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "suggest-competitors", observations: 0, entities: 0 });
    }

    // ── Load existing competitor names for exclusion ──────────────────────
    const { data: compRows } = await supabase
      .from("competitors")
      .select("name");

    const existingNames = new Set<string>(
      ((compRows ?? []) as { name: string }[]).map((c) => c.name.toLowerCase())
    );

    // Also load existing suggestions to avoid re-processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSuggestions } = await (supabase as any)
      .from("competitor_suggestions")
      .select("company_name, sector");

    const existingSuggestionKeys = new Set<string>(
      ((existingSuggestions ?? []) as { company_name: string; sector: string }[])
        .map((s) => `${s.company_name.toLowerCase()}::${s.sector}`)
    );

    // ── Extract entities in batches ───────────────────────────────────────
    const titles = observations.map((o) => o.title);
    const allEntities: { name: string; titleIndex: number }[] = [];

    for (let i = 0; i < titles.length; i += BATCH_SIZE) {
      const batch = titles.slice(i, i + BATCH_SIZE);
      const extracted = await extractCompanyEntities(batch);
      for (const entity of extracted) {
        for (const idx of entity.titleIndices) {
          allEntities.push({ name: entity.name, titleIndex: i + idx });
        }
      }
    }

    // ── Aggregate by (name, sector) ───────────────────────────────────────
    const aggregations = new Map<string, EntityAggregation>();

    for (const { name, titleIndex } of allEntities) {
      if (titleIndex >= observations.length) continue;
      const obs = observations[titleIndex];
      const key = `${name.toLowerCase()}::${obs.sector}`;

      // Skip existing competitors
      if (existingNames.has(name.toLowerCase())) continue;

      // Skip already-suggested
      if (existingSuggestionKeys.has(key)) continue;

      const agg = aggregations.get(key) ?? {
        name,
        sector: obs.sector,
        articles: [],
        sourceNames: new Set<string>(),
        urls: [],
        firstSeen: new Date(),
        lastSeen: new Date(0),
      };

      agg.articles.push(obs);
      agg.sourceNames.add(obs.source_name);
      if (obs.url) agg.urls.push(obs.url);

      const pubDate = obs.published_at ? new Date(obs.published_at) : new Date();
      if (pubDate < agg.firstSeen) agg.firstSeen = pubDate;
      if (pubDate > agg.lastSeen) agg.lastSeen = pubDate;

      aggregations.set(key, agg);
    }

    // ── Filter by minimum thresholds ──────────────────────────────────────
    const candidates = [...aggregations.values()].filter(
      (a) => a.articles.length >= MIN_ARTICLES && a.sourceNames.size >= MIN_SOURCES
    );

    // ── Score + decide + write ────────────────────────────────────────────
    let accepted = 0;
    let rejected = 0;
    let pending = 0;

    for (const candidate of candidates) {
      // Discover domain
      const domain = await discoverDomain(candidate.name);

      const scoringResult = scoreCompetitorSuggestion({
        articleCount: candidate.articles.length,
        sourceCount: candidate.sourceNames.size,
        lastSeenAt: candidate.lastSeen,
        hasDomain: domain !== null,
      });

      const representativeUrls = candidate.urls.slice(0, 3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("competitor_suggestions")
        .upsert({
          company_name:        candidate.name,
          sector:              candidate.sector,
          article_count:       candidate.articles.length,
          source_count:        candidate.sourceNames.size,
          representative_urls: representativeUrls,
          first_seen_at:       candidate.firstSeen.toISOString(),
          last_seen_at:        candidate.lastSeen.toISOString(),
          domain,
          relevance_score:     scoringResult.score,
          score_breakdown:     scoringResult.breakdown,
          status:              scoringResult.decision === "accept" ? "accepted" : scoringResult.decision === "reject" ? "rejected" : "pending",
          decision_reason:     scoringResult.reason,
          updated_at:          new Date().toISOString(),
        }, { onConflict: "company_name,sector" });

      if (scoringResult.decision === "accept") {
        accepted++;

        // ── Auto-onboard: fire-and-forget to runtime API ────────────────
        if (domain) {
          const runtimeUrl = process.env.RUNTIME_URL;
          const cronSecret = process.env.CRON_SECRET;
          if (runtimeUrl && cronSecret) {
            try {
              void fetch(`${runtimeUrl}/api/onboard-competitor`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${cronSecret}`,
                },
                body: JSON.stringify({
                  name: candidate.name,
                  website_url: domain,
                }),
              });
            } catch { /* fire-and-forget */ }
          }
        }
      } else if (scoringResult.decision === "reject") {
        rejected++;
      } else {
        pending++;
      }
    }

    void recordEvent({
      run_id: runId,
      stage: "suggest_competitors",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        observations: observations.length,
        entities_extracted: allEntities.length,
        candidates_scored: candidates.length,
        accepted,
        rejected,
        pending,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "suggest-competitors", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "suggest-competitors",
      observations: observations.length,
      entitiesExtracted: allEntities.length,
      candidatesScored: candidates.length,
      accepted,
      rejected,
      pending,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "suggest-competitors", status: "error", checkInId });
    void recordEvent({ run_id: runId, stage: "suggest_competitors", status: "failure", duration_ms: elapsed(), metadata: { error: error instanceof Error ? error.message : String(error) } });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("suggest-competitors", handler);
