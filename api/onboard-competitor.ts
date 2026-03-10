import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

type CandidatePage = {
  url: string;
  page_type: string;
};

function normalizeUrl(input: string): string {
  const u = new URL(input);
  return u.protocol + "//" + u.hostname;
}

function candidatePages(baseUrl: string): CandidatePage[] {
  return [
    { url: baseUrl, page_type: "homepage" },
    { url: baseUrl + "/pricing", page_type: "pricing" },
    { url: baseUrl + "/changelog", page_type: "changelog" },
    { url: baseUrl + "/blog", page_type: "blog" }
  ];
}

function rulesForPage(pageType: string) {
  if (pageType === "homepage") {
    return [{ section_type: "hero", selector: "h1" }];
  }

  if (pageType === "pricing") {
    return [{ section_type: "pricing_plans", selector: "main" }];
  }

  if (pageType === "changelog") {
    return [{ section_type: "release_feed", selector: "main" }];
  }

  if (pageType === "blog") {
    return [{ section_type: "release_feed", selector: "main" }];
  }

  return [];
}

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "onboard-competitor",
    status: "in_progress",
  });

  try {
    const { name, website_url } = req.body ?? {};

    if (!name || !website_url) {
      return res.status(400).json({
        ok: false,
        error: "name and website_url required",
      });
    }

    const baseUrl = normalizeUrl(website_url);

    const { data: competitor, error: competitorError } = await supabase
      .from("competitors")
      .insert({
        name,
        website_url: baseUrl,
        active: true,
      })
      .select()
      .single();

    if (competitorError) throw competitorError;

    const pages = candidatePages(baseUrl);
    const createdPages: any[] = [];

    for (const page of pages) {
      const { data: insertedPage, error: pageError } = await supabase
        .from("monitored_pages")
        .insert({
          competitor_id: competitor.id,
          url: page.url,
          page_type: page.page_type,
          active: true,
        })
        .select()
        .single();

      if (pageError) throw pageError;

      createdPages.push(insertedPage);
    }

    for (const page of createdPages) {
      const rules = rulesForPage(page.page_type);

      for (const rule of rules) {
        const { error: ruleError } = await supabase
          .from("extraction_rules")
          .insert({
            monitored_page_id: page.id,
            section_type: rule.section_type,
            selector: rule.selector,
            extract_method: "css",
            active: true,
          });

        if (ruleError) throw ruleError;
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.captureCheckIn({
      monitorSlug: "onboard-competitor",
      status: "ok",
    });

    await Sentry.flush(2000);

    return res.status(200).json({
      ok: true,
      competitor_id: competitor.id,
      pages_created: createdPages.length,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "onboard-competitor",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("onboard-competitor", handler);