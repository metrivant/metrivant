import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

type CandidatePage = {
  url: string;
  page_type: string;
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

function candidatePages(baseUrl: string): CandidatePage[] {
  return [
    { url: baseUrl,                  page_type: "homepage"  },
    { url: baseUrl + "/pricing",     page_type: "pricing"   },
    { url: baseUrl + "/changelog",   page_type: "changelog" },
    { url: baseUrl + "/blog",        page_type: "blog"      },
    { url: baseUrl + "/features",    page_type: "features"  },
    { url: baseUrl + "/newsroom",    page_type: "newsroom"  },
  ];
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

    default:
      return [];
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "onboard-competitor",
    status: "in_progress"
  });

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name        = typeof body.name        === "string" ? body.name        : undefined;
    const website_url = typeof body.website_url === "string" ? body.website_url : undefined;

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

    const { data: existingCompetitor } = await supabase
      .from("competitors")
      .select("id")
      .eq("website_url", baseUrl)
      .maybeSingle();

    let competitorId: string;

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
    } else {
      const { data: created, error } = await supabase
        .from("competitors")
        .insert({
          name: name,
          website_url: baseUrl,
          active: true
        })
        .select()
        .single();

      if (error) throw error;

      competitorId = created.id;
    }

    /*
      2. Ensure monitored pages exist
    */

    const pages = candidatePages(baseUrl);
    const createdPages: InsertedPage[] = [];

    for (const page of pages) {
      const { data: insertedPage, error: pageError } = await supabase
        .from("monitored_pages")
        .upsert(
          {
            competitor_id: competitorId,
            url: page.url,
            page_type: page.page_type,
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
    throw error;
  }
}

export default withSentry("onboard-competitor", handler);
