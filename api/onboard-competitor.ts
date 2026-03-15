import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../lib/rate-limit";
import { normalizeDomain } from "../lib/normalizeDomain";

type CandidatePage = {
  url: string;
  page_type: string;
  page_class: "high_value" | "standard" | "ambient";
};

type ExtractionRule = {
  section_type: string;
  selector: string;
};

interface InsertedPage {
  id: string;
  page_type: string;
}

function normalizeUrl(input: string): string {
  const u = new URL(input);
  return u.protocol + "//" + u.hostname;
}

// ── Sector-aware page set ──────────────────────────────────────────────────────
//
// SaaS-style companies publish pricing pages, changelogs, and feature pages at
// standard paths — all 7 page types apply.
//
// Enterprise-heavy sectors (Defense, Aerospace, Energy, Healthcare) typically do
// NOT have /pricing (enterprise contracts) or /changelog (not a convention).
// They DO have newsrooms and careers pages. Registering non-existent paths causes
// fetch-snapshots to accumulate consecutive_fetch_failures silently.
//
// custom sector: include all 7 — user controls which competitors they add.

const ENTERPRISE_SECTORS = new Set([
  "defense", "energy", "healthcare",
]);

function candidatePages(baseUrl: string, sector: string): CandidatePage[] {
  const isEnterprise = ENTERPRISE_SECTORS.has(sector);

  // All sectors share these pages
  const pages: CandidatePage[] = [
    { url: baseUrl,                page_type: "homepage", page_class: "standard" },
    { url: baseUrl + "/blog",      page_type: "blog",     page_class: "ambient"  },
    { url: baseUrl + "/features",  page_type: "features", page_class: "standard" },
    { url: baseUrl + "/newsroom",  page_type: "newsroom", page_class: "high_value" },
    { url: baseUrl + "/careers",   page_type: "careers",  page_class: "ambient"  },
  ];

  // SaaS-style sectors: also monitor pricing and changelog
  if (!isEnterprise) {
    pages.splice(1, 0,
      { url: baseUrl + "/pricing",   page_type: "pricing",   page_class: "high_value" },
      { url: baseUrl + "/changelog", page_type: "changelog", page_class: "high_value" },
    );
  }

  return pages;
}

function rulesForPage(pageType: string): ExtractionRule[] {
  switch (pageType) {
    case "homepage":
      return [
        // h1 hero headline — primary positioning signal
        { section_type: "hero",             selector: "h1"   },
        // h2 subheadlines — messaging shifts often appear here first
        { section_type: "headline",         selector: "h2"   },
        // full main content — catches product rotation, feature highlights
        { section_type: "product_mentions", selector: "main" },
      ];

    case "pricing":
      return [
        // Full pricing page — captures plan names, prices, feature gates
        { section_type: "pricing_plans",      selector: "main" },
        // Standalone pricing reference blocks when pricing is inline
        { section_type: "pricing_references", selector: "main" },
      ];

    case "changelog":
    case "blog":
      return [
        // Full feed — new posts appear as additions to this text block
        { section_type: "release_feed", selector: "main" },
        // Page headline — changes when a new post becomes the featured one
        { section_type: "headline",     selector: "h1"   },
      ];

    case "features":
      return [
        // Full features page — product expansion signals
        { section_type: "features_overview", selector: "main" },
        { section_type: "headline",          selector: "h1"   },
      ];

    case "newsroom":
      return [
        // Newsroom announcements — high-value strategic activity
        { section_type: "announcements", selector: "main" },
        { section_type: "headline",      selector: "h1"   },
      ];

    case "careers":
      return [
        // Job listings feed — hiring acceleration is an early movement indicator
        { section_type: "careers_feed", selector: "main" },
      ];

    default:
      return [];
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const ip = getClientIp(req as { headers: Record<string, string | string[] | undefined> });
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMITS.PER_IP)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const startedAt = Date.now();

  try {
    // captureCheckIn inside try — if Sentry is uninitialized it must not crash the handler
    try { Sentry.captureCheckIn({ monitorSlug: "onboard-competitor", status: "in_progress" }); } catch { /* non-fatal */ }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name        = typeof body.name        === "string" ? body.name        : undefined;
    const website_url = typeof body.website_url === "string" ? body.website_url : undefined;
    const sector      = typeof body.sector      === "string" ? body.sector      : "saas";

    if (!name || !website_url) {
      return res.status(400).json({
        ok: false,
        error: "name and website_url required"
      });
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

    // Use canonical domain as the unique identity key for the competitor registry.
    // This prevents duplicate rows from protocol/path variants of the same hostname.
    const domain = normalizeDomain(baseUrl);

    const { data: existingCompetitor } = await supabase
      .from("competitors")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    let competitorId: string;

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
      // Re-activate if previously deactivated by clean-slate (or any other path).
      // Also ensure website_url and name stay current. Idempotent.
      await supabase
        .from("competitors")
        .update({ active: true, website_url: baseUrl, name })
        .eq("id", competitorId);
    } else {
      const { data: created, error } = await supabase
        .from("competitors")
        .insert({
          name,
          website_url: baseUrl,
          domain,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      competitorId = created.id;
    }

    /*
      2. Ensure monitored pages exist
    */

    const pages = candidatePages(baseUrl, sector);
    const createdPages: InsertedPage[] = [];

    for (const page of pages) {
      const { data: insertedPage, error: pageError } = await supabase
        .from("monitored_pages")
        .upsert(
          {
            competitor_id: competitorId,
            url: page.url,
            page_type: page.page_type,
            page_class: page.page_class,
            active: true
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
              active:            true
            },
            { onConflict: "monitored_page_id,section_type" }
          );

        if (ruleError) throw ruleError;
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("onboarding", {
      competitor_id: competitorId,
      sector,
      pages_created: createdPages.length,
      runtimeDurationMs
    });

    Sentry.captureCheckIn({
      monitorSlug: "onboard-competitor",
      status: "ok"
    });

    await Sentry.flush(2000);

    return res.status(200).json({
      ok: true,
      competitor_id: competitorId,
      pages_created: createdPages.length,
      runtimeDurationMs
    });

  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "onboard-competitor",
      status: "error"
    });

    await Sentry.flush(2000);

    // Return 500 rather than rethrowing — withSentry would catch and re-report
    // this to Sentry a second time, creating duplicate error noise.
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("onboard-competitor", handler);
