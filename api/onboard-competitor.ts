import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";
import { normalizeDomain } from "../lib/normalizeDomain";
import { discoverCandidates } from "../lib/url-discovery";
import { scoreAndRank } from "../lib/url-scorer";
import { classifyWithLLM } from "../lib/url-classifier";
import { validateUrl } from "../lib/url-validator";
import type { Category } from "../lib/url-scorer";

type CandidatePage = {
  url:        string;
  page_type:  string;
  page_class: "high_value" | "standard" | "ambient";
};

type ExtractionRule = {
  section_type: string;
  selector:     string;
};

interface InsertedPage {
  id:        string;
  page_type: string;
}

function normalizeUrl(input: string): string {
  const u = new URL(input);
  return u.protocol + "//" + u.hostname;
}

// ── Sector classification ──────────────────────────────────────────────────────

const ENTERPRISE_SECTORS = new Set(["defense", "energy", "healthcare"]);

// ── Category → monitored_pages mapping ────────────────────────────────────────

const CATEGORY_TO_PAGE: Record<Category, { page_type: string; page_class: CandidatePage["page_class"] }> = {
  newsroom:                 { page_type: "newsroom",  page_class: "high_value" },
  capabilities_or_features: { page_type: "features",  page_class: "standard"   },
  careers:                  { page_type: "careers",   page_class: "ambient"    },
  blog_or_articles:         { page_type: "blog",      page_class: "ambient"    },
  pricing:                  { page_type: "pricing",   page_class: "high_value" },
};

// ── Extraction rules per page type ────────────────────────────────────────────

function rulesForPage(pageType: string): ExtractionRule[] {
  switch (pageType) {
    case "homepage":
      return [
        { section_type: "hero",             selector: "h1"   },
        { section_type: "headline",         selector: "h2"   },
        { section_type: "product_mentions", selector: "main" },
      ];
    case "pricing":
      return [
        { section_type: "pricing_plans",      selector: "main" },
        { section_type: "pricing_references", selector: "main" },
      ];
    case "changelog":
    case "blog":
      return [
        { section_type: "release_feed", selector: "main" },
        { section_type: "headline",     selector: "h1"   },
      ];
    case "features":
      return [
        { section_type: "features_overview", selector: "main" },
        { section_type: "headline",          selector: "h1"   },
      ];
    case "newsroom":
      return [
        { section_type: "announcements", selector: "main" },
        { section_type: "headline",      selector: "h1"   },
      ];
    case "careers":
      return [
        { section_type: "careers_feed", selector: "main" },
      ];
    default:
      return [];
  }
}

// ── URL discovery and resolution ───────────────────────────────────────────────
//
// Flow:
//   1. Discover candidates from robots.txt + homepage nav/footer
//   2. Score candidates deterministically per category
//   3. Refine with LLM if OpenAI key available (best-effort, gpt-4o-mini)
//   4. Validate top candidate per category with HEAD/GET
//   5. Commit only validated pages
//
// SaaS fallback: if discovery produces no candidate for pricing/changelog/blog,
// try the conventional template path and validate it too.
// Enterprise sectors: never attempt pricing or changelog (not industry convention).

async function resolveMonitoredPages(
  baseUrl:        string,
  sector:         string,
  competitorName: string,
  openaiKey:      string | undefined
): Promise<{ pages: CandidatePage[]; resolved: number; unresolved: string[] }> {
  const isEnterprise = ENTERPRISE_SECTORS.has(sector);
  const pages: CandidatePage[] = [];
  const unresolved: string[]   = [];

  // Homepage is always committed without discovery
  pages.push({ url: baseUrl, page_type: "homepage", page_class: "standard" });

  // ── Discover candidates ─────────────────────────────────────────────────────
  let candidates = await discoverCandidates(baseUrl).catch(() => []);
  const scored   = scoreAndRank(candidates, sector);

  // ── LLM classification (best-effort) ───────────────────────────────────────
  let classified = null;
  if (openaiKey && candidates.length > 0) {
    classified = await classifyWithLLM(scored, competitorName, sector, openaiKey).catch(() => null);
  }

  // ── Resolve best URL per category ──────────────────────────────────────────
  const CONFIDENCE_THRESHOLD = 0.6;
  const MIN_SCORE            = 3;

  const categoriesToResolve: Category[] = [
    "newsroom",
    "capabilities_or_features",
    "careers",
    "blog_or_articles",
  ];
  if (!isEnterprise) categoriesToResolve.push("pricing");

  const categoryUrls = new Map<string, string>();

  for (const cat of categoriesToResolve) {
    const llmResult = classified?.[cat];

    if (llmResult?.url && llmResult.confidence >= CONFIDENCE_THRESHOLD) {
      categoryUrls.set(cat, llmResult.url);
      continue;
    }

    const topScored = scored[cat]?.[0];
    if (topScored && topScored.score >= MIN_SCORE) {
      categoryUrls.set(cat, topScored.url);
      continue;
    }

    // SaaS template fallback for discoverable categories
    if (!isEnterprise) {
      const fallbacks: Partial<Record<Category, string>> = {
        pricing:          baseUrl + "/pricing",
        blog_or_articles: baseUrl + "/blog",
      };
      const fallback = fallbacks[cat];
      if (fallback) categoryUrls.set(cat, fallback);
    }
  }

  // SaaS-only: changelog is convention-specific — template only, always validated
  if (!isEnterprise) {
    categoryUrls.set("changelog", baseUrl + "/changelog");
  }

  // ── Validate all candidates in parallel ────────────────────────────────────
  const toValidate = Array.from(categoryUrls.entries());
  const validations = await Promise.all(
    toValidate.map(async ([cat, url]) => ({
      cat,
      url,
      result: await validateUrl(url).catch(() => ({ ok: false, status: 0, reason: "error" })),
    }))
  );

  // Track committed URLs to prevent duplicate URL conflicts
  const committedUrls = new Set<string>([baseUrl]);

  for (const { cat, url, result } of validations) {
    if (!result.ok) {
      unresolved.push(cat);
      continue;
    }

    // Skip if this URL was already committed under another category
    const normalizedUrl = url.replace(/\/$/, "");
    if (committedUrls.has(normalizedUrl)) {
      unresolved.push(cat);
      continue;
    }
    committedUrls.add(normalizedUrl);

    if (cat === "changelog") {
      pages.push({ url, page_type: "changelog", page_class: "high_value" });
    } else {
      const pageDef = CATEGORY_TO_PAGE[cat as Category];
      if (pageDef) {
        pages.push({ url, page_type: pageDef.page_type, page_class: pageDef.page_class });
      }
    }
  }

  return { pages, resolved: pages.length - 1, unresolved };
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();

  try {
    try { Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "in_progress" }); } catch { /* non-fatal */ }

    const body        = (req.body ?? {}) as Record<string, unknown>;
    const name        = typeof body.name        === "string" ? body.name        : undefined;
    const website_url = typeof body.website_url === "string" ? body.website_url : undefined;
    const sector      = typeof body.sector      === "string" ? body.sector      : "saas";

    if (!name || !website_url) {
      return res.status(400).json({ ok: false, error: "name and website_url required" });
    }

    let baseUrl: string;
    try {
      baseUrl = normalizeUrl(website_url);
    } catch {
      return res.status(400).json({ ok: false, error: "website_url must be a valid URL" });
    }

    /*
      1. Ensure competitor exists (idempotent)
    */

    const domain = normalizeDomain(baseUrl);

    const { data: existingCompetitor } = await supabase
      .from("competitors")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    let competitorId: string;

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
      await supabase
        .from("competitors")
        .update({ active: true, website_url: baseUrl, name })
        .eq("id", competitorId);
    } else {
      const { data: created, error } = await supabase
        .from("competitors")
        .insert({ name, website_url: baseUrl, domain, active: true })
        .select()
        .single();

      if (error) throw error;
      competitorId = created.id;
    }

    /*
      2. Discover and resolve monitored pages
    */

    const openaiKey = process.env.OPENAI_API_KEY;
    const { pages, resolved, unresolved } = await resolveMonitoredPages(
      baseUrl,
      sector,
      name,
      openaiKey
    );

    const createdPages: InsertedPage[] = [];

    for (const page of pages) {
      const { data: insertedPage, error: pageError } = await supabase
        .from("monitored_pages")
        .upsert(
          {
            competitor_id: competitorId,
            url:           page.url,
            page_type:     page.page_type,
            page_class:    page.page_class,
            active:        true,
          },
          { onConflict: "url" }
        )
        .select()
        .single();

      if (pageError) throw pageError;
      createdPages.push(insertedPage as InsertedPage);
    }

    /*
      3. Ensure extraction rules exist for each page
    */

    for (const page of createdPages) {
      const rules = rulesForPage(page.page_type);
      for (const rule of rules) {
        const { error: ruleError } = await supabase
          .from("extraction_rules")
          .upsert(
            {
              monitored_page_id: page.id,
              section_type:      rule.section_type,
              selector:          rule.selector,
              extract_method:    "css",
              active:            true,
            },
            { onConflict: "monitored_page_id,section_type" }
          );

        if (ruleError) throw ruleError;
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("onboarding", {
      competitor_id:   competitorId,
      sector,
      pages_created:   createdPages.length,
      pages_resolved:  resolved,
      pages_unresolved: unresolved.length,
      unresolved_categories: unresolved,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "ok" });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok:                   true,
      competitor_id:        competitorId,
      pages_created:        createdPages.length,
      pages_resolved:       resolved,
      unresolved_categories: unresolved,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "error" });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("onboard-competitor", handler);
