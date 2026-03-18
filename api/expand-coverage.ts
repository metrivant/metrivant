import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { discoverCandidates } from "../lib/url-discovery";
import { scoreAndRank } from "../lib/url-scorer";
import { classifyWithLLM } from "../lib/url-classifier";
import { validateUrl } from "../lib/url-validator";
import { rejectPageUrl } from "../lib/url-guard";
import { seedSmartRules } from "../lib/onboarding-selectors";
import type { Category } from "../lib/url-scorer";

// ── Config ─────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.6;
const MIN_SCORE            = 3;
const CONCURRENCY          = 10; // competitors processed in parallel per chunk
const ENTERPRISE_SECTORS   = new Set(["defense", "energy", "healthcare"]);

const CATEGORY_TO_PAGE: Record<Category, { page_type: string; page_class: "high_value" | "standard" | "ambient" }> = {
  newsroom:                 { page_type: "newsroom",  page_class: "high_value" },
  capabilities_or_features: { page_type: "features",  page_class: "standard"   },
  careers:                  { page_type: "careers",   page_class: "ambient"    },
  blog_or_articles:         { page_type: "blog",      page_class: "ambient"    },
  pricing:                  { page_type: "pricing",   page_class: "high_value" },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompetitorRow {
  id:          string;
  name:        string;
  website_url: string;
}

interface ExpansionResult {
  competitor_id:   string;
  new_pages:       number;
  llm_seeded_rules: number;
}

// ── Sector lookup ──────────────────────────────────────────────────────────────
// competitors table has no sector column — look up via tracked_competitors → organizations.
// Defaults to "saas" for untracked competitors.

async function buildSectorMap(competitorIds: string[]): Promise<Map<string, string>> {
  const sectorMap = new Map<string, string>();
  if (competitorIds.length === 0) return sectorMap;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tracked } = await (supabase as any)
    .from("tracked_competitors")
    .select("competitor_id, org_id")
    .in("competitor_id", competitorIds);

  const orgIds = [...new Set(((tracked ?? []) as { competitor_id: string; org_id: string }[]).map((r) => r.org_id))];
  if (orgIds.length === 0) return sectorMap;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgs } = await (supabase as any)
    .from("organizations")
    .select("id, sector")
    .in("id", orgIds);

  const orgSectors = new Map(
    ((orgs ?? []) as { id: string; sector: string }[]).map((o) => [o.id, o.sector])
  );

  for (const { competitor_id, org_id } of (tracked ?? []) as { competitor_id: string; org_id: string }[]) {
    const sector = orgSectors.get(org_id);
    if (sector) sectorMap.set(competitor_id, sector);
  }

  return sectorMap;
}

// ── Per-competitor expansion ───────────────────────────────────────────────────

async function expandCompetitor(
  competitor: CompetitorRow,
  sector:     string,
  openaiKey:  string | undefined
): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    competitor_id:    competitor.id,
    new_pages:        0,
    llm_seeded_rules: 0,
  };

  const isEnterprise = ENTERPRISE_SECTORS.has(sector);
  const baseUrl      = competitor.website_url;

  // ── Which page types already exist? ─────────────────────────────────────────
  const { data: existingPages } = await supabase
    .from("monitored_pages")
    .select("page_type")
    .eq("competitor_id", competitor.id)
    .eq("active", true);

  const existingTypes = new Set(
    ((existingPages ?? []) as { page_type: string }[]).map((r) => r.page_type)
  );

  // ── Which categories still need coverage? ───────────────────────────────────
  const categoriesToCheck: Category[] = [
    "newsroom", "capabilities_or_features", "careers", "blog_or_articles",
    ...(!isEnterprise ? ["pricing" as Category] : []),
  ];

  const uncovered = categoriesToCheck.filter((cat) => {
    const def = CATEGORY_TO_PAGE[cat];
    return def && !existingTypes.has(def.page_type);
  });
  const needChangelog = !isEnterprise && !existingTypes.has("changelog");

  if (uncovered.length === 0 && !needChangelog) return result; // already fully covered

  // ── URL discovery ────────────────────────────────────────────────────────────
  const candidates = await discoverCandidates(baseUrl).catch(() => []);
  if (candidates.length === 0) return result;

  const scored = scoreAndRank(candidates, sector);

  let classified: Awaited<ReturnType<typeof classifyWithLLM>> | null = null;
  if (openaiKey && candidates.length > 0) {
    classified = await classifyWithLLM(scored, competitor.name, sector, openaiKey).catch(() => null);
  }

  // ── Build ranked candidate queue for each uncovered category ─────────────────
  const categoryRankedCandidates = new Map<string, { url: string; score: number }[]>();

  for (const cat of uncovered) {
    const queue: { url: string; score: number }[] = [];

    const llmResult = classified?.[cat];
    if (llmResult?.url && llmResult.confidence >= CONFIDENCE_THRESHOLD) {
      queue.push({ url: llmResult.url, score: llmResult.confidence });
    }
    for (const c of scored[cat] ?? []) {
      if (queue.length >= 2) break;
      if (c.score >= MIN_SCORE && !queue.some((e) => e.url === c.url)) {
        queue.push({ url: c.url, score: c.score });
      }
    }
    // Template fallbacks (SaaS only)
    if (!isEnterprise) {
      const fallbacks: Partial<Record<Category, string>> = {
        pricing:          baseUrl + "/pricing",
        blog_or_articles: baseUrl + "/blog",
      };
      const fb = fallbacks[cat];
      if (fb && !queue.some((e) => e.url === fb)) queue.push({ url: fb, score: 0 });
    }
    if (queue.length > 0) categoryRankedCandidates.set(cat, queue);
  }

  if (needChangelog) {
    categoryRankedCandidates.set("changelog", [{ url: baseUrl + "/changelog", score: 0 }]);
  }

  if (categoryRankedCandidates.size === 0) return result;

  // ── Validate all candidate URLs in parallel ──────────────────────────────────
  const allUrls = new Set<string>();
  for (const entries of categoryRankedCandidates.values()) {
    for (const { url } of entries) allUrls.add(url);
  }

  const validations = await Promise.all(
    Array.from(allUrls).map(async (url) => ({
      url,
      ok: await validateUrl(url).then((r) => r.ok).catch(() => false),
    }))
  );
  const validated = new Map(validations.map(({ url, ok }) => [url, ok]));

  // ── Commit first valid, guard-passing candidate per category ─────────────────
  const committedUrls = new Set<string>();

  for (const [cat, entries] of categoryRankedCandidates.entries()) {
    for (const { url } of entries) {
      if (!validated.get(url)) continue;
      if (rejectPageUrl(url, cat).reject) continue;

      const normalized = url.replace(/\/$/, "");
      if (committedUrls.has(normalized)) continue;
      committedUrls.add(normalized);

      const isChangelog = cat === "changelog";
      const pageType    = isChangelog ? "changelog" : CATEGORY_TO_PAGE[cat as Category]?.page_type;
      const pageClass   = isChangelog ? ("high_value" as const) : CATEGORY_TO_PAGE[cat as Category]?.page_class;
      if (!pageType || !pageClass) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase as any)
        .from("monitored_pages")
        .upsert(
          {
            competitor_id: competitor.id,
            url,
            page_type:    pageType,
            page_class:   pageClass,
            active:       true,
            health_state: "healthy",
          },
          { onConflict: "url" }
        )
        .select("id, page_type, url")
        .single();

      if (error || !inserted) {
        Sentry.addBreadcrumb({
          category: "expand_coverage",
          message:  "page_upsert_failed",
          level:    "warning",
          data:     { competitor_id: competitor.id, url, error: error?.message },
        });
        continue;
      }

      result.new_pages++;

      // Seed LLM-targeted extraction rules for the new page
      const rules = await seedSmartRules(url, pageType, openaiKey ?? "").catch(() => []);
      for (const rule of rules) {
        await supabase
          .from("extraction_rules")
          .upsert(
            {
              monitored_page_id: (inserted as { id: string }).id,
              section_type:      rule.section_type,
              selector:          rule.selector,
              extract_method:    "css",
              active:            true,
            },
            { onConflict: "monitored_page_id,section_type" }
          );
        if (rule.llm_seeded) result.llm_seeded_rules++;
      }

      Sentry.addBreadcrumb({
        category: "expand_coverage",
        message:  "new_page_added",
        level:    "info",
        data:     { competitor_id: competitor.id, url, page_type: pageType, llm_seeded_rules: result.llm_seeded_rules },
      });

      break; // One new page per category per run
    }
  }

  return result;
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "expand-coverage", status: "in_progress" });

  try {
    const openaiKey = process.env.OPENAI_API_KEY;

    // Fetch all active competitors
    const { data: competitorRows, error: compError } = await supabase
      .from("competitors")
      .select("id, name, website_url")
      .eq("active", true)
      .limit(200);

    if (compError) throw compError;

    const competitors = (competitorRows ?? []) as CompetitorRow[];
    if (competitors.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "expand-coverage", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "expand-coverage", competitors_checked: 0, new_pages_added: 0 });
    }

    // Look up sectors from organizations via tracked_competitors
    const sectorMap = await buildSectorMap(competitors.map((c) => c.id)).catch(() => new Map<string, string>());

    // Process in chunks to avoid network flood
    let totalNewPages        = 0;
    let totalLlmSeededRules  = 0;
    let errors               = 0;

    for (let i = 0; i < competitors.length; i += CONCURRENCY) {
      const chunk   = competitors.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((c) => expandCompetitor(c, sectorMap.get(c.id) ?? "saas", openaiKey))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          totalNewPages       += r.value.new_pages;
          totalLlmSeededRules += r.value.llm_seeded_rules;
        } else {
          errors++;
          Sentry.captureException(r.reason);
        }
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("expand_coverage", {
      competitors_checked: competitors.length,
      new_pages_added:     totalNewPages,
      llm_seeded_rules:    totalLlmSeededRules,
      errors,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "expand-coverage", status: "ok", checkInId });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok:                  true,
      job:                 "expand-coverage",
      competitors_checked: competitors.length,
      new_pages_added:     totalNewPages,
      llm_seeded_rules:    totalLlmSeededRules,
      errors,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "expand-coverage", status: "error", checkInId });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("expand-coverage", handler);
