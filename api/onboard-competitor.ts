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
import { rejectPageUrl } from "../lib/url-guard";
import { discoverFeed } from "../lib/feed-discovery";
import { discoverAts } from "../lib/ats-discovery";
import { discoverInvestorFeed } from "../lib/investor-feed-discovery";
import { discoverProductFeed } from "../lib/product-feed-discovery";
import { discoverEdgarFeed } from "../lib/edgar-discovery";
import type { Category } from "../lib/url-scorer";
import { seedSmartRules, getStaticRules, SmartRule } from "../lib/onboarding-selectors";

// Shape written to monitored_pages.discovery_candidates — operator audit trail only.
// Not read by any pipeline stage.
interface DiscoveryCandidate {
  url:           string;
  score:         number;
  selected?:     true;
  rejected?:     true;
  reject_reason?: string;
}

interface DiscoveryCandidatesJson {
  discovered_at: string;
  candidates:    DiscoveryCandidate[];
}

type CandidatePage = {
  url:                  string;
  page_type:            string;
  page_class:           "high_value" | "standard" | "ambient";
  discovery_candidates?: DiscoveryCandidatesJson;
};

interface InsertedPage {
  id:        string;
  page_type: string;
  url:       string;
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


// ── URL discovery and resolution ───────────────────────────────────────────────
//
// Flow:
//   1. Discover candidates from robots.txt + homepage nav/footer
//   2. Score candidates deterministically per category
//   3. Refine with LLM if OpenAI key available (best-effort, gpt-4o-mini)
//   4. Build a ranked candidate list per category (LLM > scored > template)
//   5. Validate all candidates in parallel with HEAD/GET
//   6. Per category: pick first candidate that passes HTTP + content-pattern gate
//   7. Commit only validated + pattern-clean pages. Empty category > wrong URL.
//
// SaaS fallback: if discovery produces no candidate for pricing/changelog/blog,
// try the conventional template path and validate it too.
// Enterprise sectors: never attempt pricing or changelog (not industry convention).

async function resolveMonitoredPages(
  baseUrl:        string,
  sector:         string,
  competitorName: string,
  openaiKey:      string | undefined
): Promise<{ pages: CandidatePage[]; resolved: number; unresolved: string[]; rejections: { cat: string; url: string; reason: string }[] }> {
  const isEnterprise = ENTERPRISE_SECTORS.has(sector);
  const pages: CandidatePage[] = [];
  const unresolved: string[]   = [];
  const rejections: { cat: string; url: string; reason: string }[] = [];

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

  // ── Build ranked candidate list per category ───────────────────────────────
  // Priority: LLM result (if confident) → top scored candidates → template fallback.
  // Up to MAX_CANDIDATES per category — tried in order until one passes all gates.
  const CONFIDENCE_THRESHOLD = 0.6;
  const MIN_SCORE            = 3;
  const MAX_CANDIDATES       = 3;

  const categoriesToResolve: Category[] = [
    "newsroom",
    "capabilities_or_features",
    "careers",
    "blog_or_articles",
  ];
  if (!isEnterprise) categoriesToResolve.push("pricing");

  // All categories including changelog (SaaS only)
  const allCategories: string[] = [
    ...categoriesToResolve,
    ...(!isEnterprise ? ["changelog"] : []),
  ];

  // Scored candidate entry: url + numeric score for discovery_candidates metadata.
  type ScoredEntry = { url: string; score: number };

  const categoryRankedCandidates = new Map<string, ScoredEntry[]>();

  for (const cat of categoriesToResolve) {
    const queue: ScoredEntry[] = [];

    // 1. LLM result — highest confidence source
    const llmResult = classified?.[cat as Category];
    if (llmResult?.url && llmResult.confidence >= CONFIDENCE_THRESHOLD) {
      queue.push({ url: llmResult.url, score: llmResult.confidence });
    }

    // 2. Scored candidates in rank order
    for (const candidate of scored[cat as Category] ?? []) {
      if (queue.length >= MAX_CANDIDATES) break;
      if (candidate.score >= MIN_SCORE && !queue.some((e) => e.url === candidate.url)) {
        queue.push({ url: candidate.url, score: candidate.score });
      }
    }

    // 3. Template fallback (SaaS only) — score 0 (unscored convention path)
    if (!isEnterprise) {
      const fallbacks: Partial<Record<Category, string>> = {
        pricing:          baseUrl + "/pricing",
        blog_or_articles: baseUrl + "/blog",
      };
      const fallback = fallbacks[cat as Category];
      if (fallback && !queue.some((e) => e.url === fallback)) {
        queue.push({ url: fallback, score: 0 });
      }
    }

    if (queue.length > 0) categoryRankedCandidates.set(cat, queue);
  }

  // Changelog is template-only (convention path, always validated)
  if (!isEnterprise) {
    categoryRankedCandidates.set("changelog", [{ url: baseUrl + "/changelog", score: 0 }]);
  }

  // ── Validate all candidate URLs in parallel ─────────────────────────────────
  const allCandidateUrls = new Set<string>();
  for (const entries of categoryRankedCandidates.values()) {
    for (const { url } of entries) allCandidateUrls.add(url);
  }

  const validationResults = await Promise.all(
    Array.from(allCandidateUrls).map(async (url) => ({
      url,
      result: await validateUrl(url).catch(() => ({ ok: false, status: 0, reason: "error" })),
    }))
  );
  const validatedUrls = new Map(validationResults.map(({ url, result }) => [url, result]));

  // ── Commit first valid candidate per category ───────────────────────────────
  // Iterates ranked list. Empty category is preferred over a wrong URL.
  // Builds discovery_candidates metadata per committed page for operator audit.
  const committedUrls = new Set<string>([baseUrl]);

  for (const cat of allCategories) {
    const entries = categoryRankedCandidates.get(cat) ?? [];
    let committed = false;
    const outcomeList: DiscoveryCandidate[] = [];

    for (const { url, score } of entries) {
      const validation = validatedUrls.get(url);
      if (!validation?.ok) {
        // HTTP failed — record without outcome flags
        outcomeList.push({ url, score });
        continue;
      }

      // Content-pattern gate
      const guardResult = rejectPageUrl(url, cat);
      if (guardResult.reject) {
        rejections.push({ cat, url, reason: guardResult.reason });
        outcomeList.push({ url, score, rejected: true, reject_reason: guardResult.reason });
        Sentry.addBreadcrumb({
          category: "onboarding",
          message:  "url_guard_rejected",
          level:    "info",
          data:     { cat, url, reason: guardResult.reason },
        });
        continue;
      }

      // Dedup — skip if same URL committed under another category
      const normalizedUrl = url.replace(/\/$/, "");
      if (committedUrls.has(normalizedUrl)) {
        outcomeList.push({ url, score });
        continue;
      }
      committedUrls.add(normalizedUrl);

      outcomeList.push({ url, score, selected: true });

      const discoveryCandidates: DiscoveryCandidatesJson = {
        discovered_at: new Date().toISOString(),
        candidates:    outcomeList,
      };

      if (cat === "changelog") {
        pages.push({ url, page_type: "changelog", page_class: "high_value", discovery_candidates: discoveryCandidates });
      } else {
        const pageDef = CATEGORY_TO_PAGE[cat as Category];
        if (pageDef) pages.push({ url, page_type: pageDef.page_type, page_class: pageDef.page_class, discovery_candidates: discoveryCandidates });
      }

      committed = true;
      break;
    }

    if (!committed) {
      if (entries.length > 0 && !unresolved.includes(cat)) {
        Sentry.addBreadcrumb({
          category: "onboarding",
          message:  "category_no_valid_candidate",
          level:    "warning",
          data:     { cat, candidatesAttempted: entries.length },
        });
      }
      if (!unresolved.includes(cat)) unresolved.push(cat);
    }
  }

  return { pages, resolved: pages.length - 1, unresolved, rejections };
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "in_progress" });

  try {

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
    const { pages, resolved, unresolved, rejections } = await resolveMonitoredPages(
      baseUrl,
      sector,
      name,
      openaiKey
    );

    const createdPages: InsertedPage[] = [];

    for (const page of pages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedPage, error: pageError } = await (supabase as any)
        .from("monitored_pages")
        .upsert(
          {
            competitor_id:        competitorId,
            url:                  page.url,
            page_type:            page.page_type,
            page_class:           page.page_class,
            active:               true,
            health_state:         "healthy", // URL passed onboarding validation — safe starting state
            ...(page.discovery_candidates ? { discovery_candidates: page.discovery_candidates } : {}),
          },
          { onConflict: "url" }
        )
        .select()
        .single();

      if (pageError) throw pageError;
      createdPages.push(insertedPage as InsertedPage);
    }

    /*
      3. Seed extraction rules — LLM-proposed selectors where possible, static fallback otherwise.
         All pages are seeded in parallel (one HTML fetch + N parallel LLM calls per page).
         Never throws: seedSmartRules always returns at least the static fallback rules.
    */

    const smartRuleMap = new Map<string, SmartRule[]>();
    await Promise.all(
      createdPages.map(async (cp) => {
        const rules = await seedSmartRules(cp.url, cp.page_type, openaiKey ?? "")
          .catch(() => getStaticRules(cp.page_type).map((r) => ({ ...r, llm_seeded: false })));
        smartRuleMap.set(cp.id, rules);
      })
    );

    let llmSeededRulesCount = 0;

    for (const page of createdPages) {
      const rules = smartRuleMap.get(page.id) ?? getStaticRules(page.page_type).map((r) => ({ ...r, llm_seeded: false }));
      llmSeededRulesCount += rules.filter((r) => r.llm_seeded).length;
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

    /*
      4. Discover and store newsroom feed URL (best-effort — non-fatal on failure)
    */

    let feedDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      // Pass the newsroom page URL to the HTML alternate-link strategy.
      // Path probing runs in parallel regardless (independent strategies).
      const newsroomPage = pages.find((p) => p.page_type === "newsroom");
      const feedResult   = await discoverFeed(baseUrl, newsroomPage?.url);
      feedDiscoveryStatus = feedResult.found ? "found" : "unavailable";

      if (!feedResult.found) {
        Sentry.addBreadcrumb({
          category: "onboarding",
          message:  "feed_discovery_failed",
          level:    "info",
          data:     { competitor_id: competitorId, reason: feedResult.reason },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("competitor_feeds")
        .upsert(
          {
            competitor_id:     competitorId,
            pool_type:         "newsroom",
            feed_url:          feedResult.found ? feedResult.url        : null,
            source_type:       feedResult.found ? feedResult.source_type : "rss",
            discovery_status:  feedResult.found ? "active" : "feed_unavailable",
            last_error:        feedResult.found ? null : feedResult.reason,
            discovered_at:     new Date().toISOString(),
            updated_at:        new Date().toISOString(),
          },
          { onConflict: "competitor_id,pool_type" }
        );
    } catch (feedErr) {
      // Non-fatal: onboarding succeeds even when feed discovery fails.
      Sentry.captureException(feedErr);
    }

    /*
      5. Discover and store ATS endpoint URL (best-effort — non-fatal on failure)
    */

    let atsDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      const careersPage = pages.find((p) => p.page_type === "careers");
      const atsResult   = await discoverAts(domain, careersPage?.url);
      atsDiscoveryStatus = atsResult.found ? "found" : "unavailable";

      if (atsResult.found) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:     competitorId,
              pool_type:         "careers",
              feed_url:          atsResult.endpointUrl,
              source_type:       atsResult.atsType,
              discovery_status:  "active",
              discovered_at:     new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );
      } else {
        // Record that we attempted discovery and it was unavailable.
        // Don't overwrite an existing active careers feed if one was already configured.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingCareersFeed } = await (supabase as any)
          .from("competitor_feeds")
          .select("id, discovery_status")
          .eq("competitor_id", competitorId)
          .eq("pool_type", "careers")
          .maybeSingle();

        if (!existingCareersFeed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("competitor_feeds")
            .insert({
              competitor_id:    competitorId,
              pool_type:        "careers",
              feed_url:         null,
              source_type:      "greenhouse", // placeholder; updated if discovered later
              discovery_status: "feed_unavailable",
              discovered_at:    new Date().toISOString(),
              updated_at:       new Date().toISOString(),
            });
        }
      }
    } catch (atsErr) {
      // Non-fatal: onboarding succeeds even when ATS discovery fails.
      Sentry.captureException(atsErr);
    }

    /*
      6. Discover and store investor feed URL (best-effort — non-fatal on failure)
    */

    let investorDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      const investorResult = await discoverInvestorFeed(baseUrl, domain);
      investorDiscoveryStatus = investorResult.found ? "found" : "unavailable";

      // Don't overwrite an existing active investor feed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingInvestorFeed } = await (supabase as any)
        .from("competitor_feeds")
        .select("id, discovery_status")
        .eq("competitor_id", competitorId)
        .eq("pool_type", "investor")
        .maybeSingle();

      if (!existingInvestorFeed || existingInvestorFeed.discovery_status !== "active") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:     competitorId,
              pool_type:         "investor",
              feed_url:          investorResult.found ? investorResult.url       : null,
              source_type:       investorResult.found ? investorResult.source_type : "investor_rss",
              discovery_status:  investorResult.found ? "active" : "feed_unavailable",
              discovered_at:     new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );
      }
    } catch (investorErr) {
      // Non-fatal: onboarding succeeds even when investor feed discovery fails.
      Sentry.captureException(investorErr);
    }

    /*
      7. Discover and store product / changelog feed URL (best-effort — non-fatal on failure)
    */

    let productDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      // Pass the changelog/blog page URL if one was resolved (gives HTML alternate-link
      // discovery the most targeted page to inspect for <link rel="alternate">).
      const changelogPage = pages.find((p) => p.page_type === "changelog");
      const blogPage      = pages.find((p) => p.page_type === "blog");
      const productPageUrl = (changelogPage ?? blogPage)?.url;

      const productResult = await discoverProductFeed(baseUrl, domain, productPageUrl);
      productDiscoveryStatus = productResult.found ? "found" : "unavailable";

      // Don't overwrite an existing active product feed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingProductFeed } = await (supabase as any)
        .from("competitor_feeds")
        .select("id, discovery_status")
        .eq("competitor_id", competitorId)
        .eq("pool_type", "product")
        .maybeSingle();

      if (!existingProductFeed || existingProductFeed.discovery_status !== "active") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:     competitorId,
              pool_type:         "product",
              feed_url:          productResult.found ? productResult.url        : null,
              source_type:       productResult.found ? productResult.source_type : "changelog_feed",
              discovery_status:  productResult.found ? "active" : "feed_unavailable",
              discovered_at:     new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );
      }
    } catch (productErr) {
      // Non-fatal: onboarding succeeds even when product feed discovery fails.
      Sentry.captureException(productErr);
    }

    /*
      8. Probe for competitor-scoped procurement / awards feed (best-effort — non-fatal on failure)
         Checks common RSS/Atom paths on the competitor's own site.
         Sector-scoped external procurement sources (government portals) are configured
         separately in the procurement_sources table — not part of onboarding.
    */

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

    let procurementDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      let procurementFeedUrl:    string | null = null;
      let procurementSourceType: string        = "procurement_feed";

      for (const path of PROCUREMENT_FEED_PATHS) {
        try {
          const probeUrl = baseUrl + path;
          const resp = await fetch(probeUrl, {
            method:  "GET",
            headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
            signal:  AbortSignal.timeout(5000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          if (resp.ok) {
            const ct = resp.headers.get("content-type") ?? "";
            if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
              procurementFeedUrl    = probeUrl;
              procurementSourceType = ct.includes("atom") ? "award_feed" : "procurement_feed";
              break;
            }
          }
        } catch {
          // Individual path probe failed — try next
        }
      }

      procurementDiscoveryStatus = procurementFeedUrl ? "found" : "unavailable";

      // Don't overwrite an existing active procurement feed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingProcurementFeed } = await (supabase as any)
        .from("competitor_feeds")
        .select("id, discovery_status")
        .eq("competitor_id", competitorId)
        .eq("pool_type", "procurement")
        .maybeSingle();

      if (!existingProcurementFeed || existingProcurementFeed.discovery_status !== "active") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:     competitorId,
              pool_type:         "procurement",
              feed_url:          procurementFeedUrl,
              source_type:       procurementFeedUrl ? procurementSourceType : "procurement_feed",
              discovery_status:  procurementFeedUrl ? "active" : "feed_unavailable",
              discovered_at:     new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );
      }
    } catch (procurementErr) {
      // Non-fatal: onboarding succeeds even when procurement feed discovery fails.
      Sentry.captureException(procurementErr);
    }

    /*
      9. Discover and store SEC EDGAR feed URL (best-effort — non-fatal on failure)
         Searches EDGAR by company name, extracts CIK, constructs Atom feed URL.
         Only succeeds for US-listed public companies.
         Sector-scoped regulatory sources (FDA, FERC, etc.) are operator-configured
         separately in the regulatory_sources table.
    */

    let regulatoryDiscoveryStatus: "found" | "unavailable" | "error" = "error";
    try {
      const edgarResult = await discoverEdgarFeed(name, domain);
      regulatoryDiscoveryStatus = edgarResult.found ? "found" : "unavailable";

      // Don't overwrite an existing active regulatory feed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRegulatoryFeed } = await (supabase as any)
        .from("competitor_feeds")
        .select("id, discovery_status")
        .eq("competitor_id", competitorId)
        .eq("pool_type", "regulatory")
        .maybeSingle();

      if (!existingRegulatoryFeed || existingRegulatoryFeed.discovery_status !== "active") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("competitor_feeds")
          .upsert(
            {
              competitor_id:     competitorId,
              pool_type:         "regulatory",
              feed_url:          edgarResult.found ? edgarResult.feedUrl    : null,
              source_type:       edgarResult.found ? edgarResult.source_type : "sec_feed",
              discovery_status:  edgarResult.found ? "active" : "feed_unavailable",
              discovered_at:     new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            },
            { onConflict: "competitor_id,pool_type" }
          );
      }
    } catch (edgarErr) {
      // Non-fatal: onboarding succeeds even when EDGAR discovery fails.
      Sentry.captureException(edgarErr);
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("onboarding", {
      competitor_id:            competitorId,
      sector,
      pages_created:            createdPages.length,
      pages_resolved:           resolved,
      pages_unresolved:         unresolved.length,
      unresolved_categories:    unresolved,
      pages_rejected:           rejections.length,
      rejected_pages:           rejections,
      llm_seeded_rules:         llmSeededRulesCount,
      feed_discovery:           feedDiscoveryStatus,
      ats_discovery:            atsDiscoveryStatus,
      investor_discovery:       investorDiscoveryStatus,
      product_discovery:        productDiscoveryStatus,
      procurement_discovery:    procurementDiscoveryStatus,
      regulatory_discovery:     regulatoryDiscoveryStatus,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "ok", checkInId });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok:                       true,
      competitor_id:            competitorId,
      pages_created:            createdPages.length,
      pages_resolved:           resolved,
      unresolved_categories:    unresolved,
      rejected_pages:           rejections,
      llm_seeded_rules:         llmSeededRulesCount,
      feed_discovery:           feedDiscoveryStatus,
      ats_discovery:            atsDiscoveryStatus,
      investor_discovery:       investorDiscoveryStatus,
      product_discovery:        productDiscoveryStatus,
      procurement_discovery:    procurementDiscoveryStatus,
      regulatory_discovery:     regulatoryDiscoveryStatus,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "error", checkInId });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("onboard-competitor", handler);
