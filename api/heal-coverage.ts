// ── /api/heal-coverage ─────────────────────────────────────────────────────────
// Vercel cron: daily 05:00 UTC
//
// Automated URL repair for monitored pages whose health_state has become
// 'unresolved' or 'blocked' — indicating the stored URL is no longer valid.
//
// Flow per competitor group:
//   1. Re-validate current URL — if it passes now, self-heal (reset health_state).
//   2. For pages that still fail: discover candidates from the competitor's root.
//      (One discoverCandidates() call per competitor, shared across its broken pages.)
//   3. Score candidates + try template fallbacks for the specific page_type.
//   4. Validate each candidate; commit the first that passes HTTP + guard checks.
//   5. If the replacement URL is already used by another row, deactivate the broken page.
//   6. If no replacement is found, leave the page unchanged (never worsen state).
//
// Safety:
//   - Homepage pages are skipped (too fundamental to guess from path patterns).
//   - URL uniqueness is verified before any UPDATE (avoids unique constraint violation).
//   - All HTTP calls use the same timeout as onboard-competitor (4s HEAD, 4s GET fallback).
//   - No LLM calls — scoring heuristics + templates are sufficient and fast.
//   - Budget guard: MAX_PAGES_PER_RUN caps total work; CONCURRENCY limits parallel HTTP load.
//
// Runs after retention (03:00) and suggest-selector-repairs (04:00).

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { discoverCandidates } from "../lib/url-discovery";
import { scoreAndRank } from "../lib/url-scorer";
import { validateUrl } from "../lib/url-validator";
import { rejectPageUrl } from "../lib/url-guard";
import type { Category } from "../lib/url-scorer";

// ── Config ─────────────────────────────────────────────────────────────────────

// Health states treated as broken URLs that need a replacement.
// 'challenge' is intentionally excluded — ScrapingBee handles those at fetch time.
// 'degraded' is intentionally excluded — intermittent, not definitively wrong URL.
const BROKEN_STATES = ["unresolved", "blocked"] as const;

// Maximum broken pages processed per run. Each page requires at least one
// HTTP call (self-heal check), so 40 pages × 4s = ~160s worst-case — the
// shared-per-competitor discovery significantly reduces this in practice.
const MAX_PAGES_PER_RUN = 40;

// Competitors processed concurrently. Each competitor group makes multiple
// HTTP calls (1 discoverCandidates + N validateUrl per page).
const CONCURRENCY = 4;

// Minimum heuristic score for a scored candidate to enter the validation queue.
const MIN_SCORE = 3;

// ── page_type → url-scorer Category ──────────────────────────────────────────

const PAGE_TYPE_TO_CATEGORY: Partial<Record<string, Category>> = {
  newsroom: "newsroom",
  features:  "capabilities_or_features",
  careers:   "careers",
  blog:      "blog_or_articles",
  pricing:   "pricing",
};

// Template fallbacks per page_type. Tried in order after scored candidates.
// All paths are relative to the competitor's root domain.
const PAGE_TYPE_TEMPLATES: Record<string, string[]> = {
  pricing:   ["/pricing", "/plans", "/pricing/plans"],
  blog:      ["/blog", "/articles", "/insights", "/resources/blog"],
  newsroom:  ["/newsroom", "/news", "/press", "/media", "/press-releases"],
  features:  ["/features", "/product", "/solutions", "/platform"],
  careers:   ["/careers", "/jobs", "/join-us", "/work-with-us"],
  changelog: ["/changelog", "/updates", "/releases", "/whats-new", "/release-notes"],
  homepage:  [], // never attempt template repair for homepage
};

// page_class preserved when URL is updated — keeps monitoring tier correct.
const PAGE_CLASS_BY_TYPE: Record<string, "high_value" | "standard" | "ambient"> = {
  pricing:   "high_value",
  changelog: "high_value",
  newsroom:  "high_value",
  blog:      "ambient",
  careers:   "ambient",
  features:  "standard",
  homepage:  "standard",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface BrokenPage {
  id:            string;
  url:           string;
  page_type:     string;
  health_state:  string;
  competitor_id: string;
}

interface CompetitorInfo {
  id:          string;
  name:        string;
  website_url: string;
}

interface HealResult {
  page_id:   string;
  page_type: string;
  outcome:   "self_healed" | "repaired" | "unresolvable";
  old_url?:  string;
  new_url?:  string;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function extractBase(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol + "//" + u.hostname;
  } catch {
    return url;
  }
}

// ── Per-competitor healing ─────────────────────────────────────────────────────

async function healCompetitorPages(
  pages:      BrokenPage[],
  competitor: CompetitorInfo,
  sector:     string
): Promise<HealResult[]> {
  const results: HealResult[] = [];

  // ── Step 1: self-heal check ────────────────────────────────────────────────
  // Re-validate each current URL. Pages that now pass are reset without changing URL.
  // This handles CDN outages, temporary 404s, and recently-corrected pages.
  const needsRepair: BrokenPage[] = [];

  for (const page of pages) {
    const current = await validateUrl(page.url).catch(() => ({ ok: false as const }));
    if (current.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("monitored_pages")
        .update({ health_state: "healthy" })
        .eq("id", page.id);
      results.push({ page_id: page.id, page_type: page.page_type, outcome: "self_healed", old_url: page.url });
    } else {
      needsRepair.push(page);
    }
  }

  if (needsRepair.length === 0) return results;

  // ── Step 2: URL discovery — one call for all pages in this competitor ──────
  const base       = extractBase(competitor.website_url);
  const discovered = await discoverCandidates(base).catch(() => []);
  const scored     = scoreAndRank(discovered, sector);

  // ── Step 3: find and commit replacement per broken page ───────────────────
  for (const page of needsRepair) {
    // Homepage: never attempt template repair — fundamental URL, skip it.
    if (page.page_type === "homepage") {
      results.push({ page_id: page.id, page_type: page.page_type, outcome: "unresolvable" });
      continue;
    }

    const category = PAGE_TYPE_TO_CATEGORY[page.page_type];

    // Build candidate queue: scored (if category maps) then templates.
    const candidates: string[] = [];

    if (category) {
      const scoredForCat = (scored[category] ?? [])
        .filter((c) => c.score >= MIN_SCORE)
        .map((c) => c.url);
      candidates.push(...scoredForCat);
    }

    const templates = (PAGE_TYPE_TEMPLATES[page.page_type] ?? []).map((t) => base + t);
    for (const t of templates) {
      if (!candidates.includes(t)) candidates.push(t);
    }

    // Exclude current URL — we already know it is broken.
    const toTry = candidates.filter((u) => u !== page.url);

    // Try candidates in priority order — take the first that passes all gates.
    let replacement: string | null = null;
    for (const url of toTry) {
      const guard = rejectPageUrl(url, category ?? page.page_type);
      if (guard.reject) continue;

      const validation = await validateUrl(url).catch(() => ({ ok: false as const }));
      if (validation.ok) { replacement = url; break; }
    }

    if (!replacement) {
      results.push({ page_id: page.id, page_type: page.page_type, outcome: "unresolvable" });
      continue;
    }

    // ── Step 4: unique constraint guard ───────────────────────────────────────
    // If the replacement URL already exists in monitored_pages (active or inactive),
    // the UPDATE would violate the unique constraint. Deactivate the broken duplicate
    // instead — the other row is likely the correct canonical entry.
    const { count } = await supabase
      .from("monitored_pages")
      .select("id", { count: "exact", head: true })
      .eq("url", replacement);

    if ((count ?? 0) > 0) {
      await supabase
        .from("monitored_pages")
        .update({ active: false })
        .eq("id", page.id);
      results.push({ page_id: page.id, page_type: page.page_type, outcome: "unresolvable" });
      continue;
    }

    // ── Step 5: commit replacement ─────────────────────────────────────────────
    const pageClass = PAGE_CLASS_BY_TYPE[page.page_type] ?? "standard";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("monitored_pages")
      .update({ url: replacement, health_state: "healthy", page_class: pageClass })
      .eq("id", page.id);

    if (updateErr) {
      Sentry.captureException(updateErr);
      results.push({ page_id: page.id, page_type: page.page_type, outcome: "unresolvable" });
      continue;
    }

    results.push({
      page_id:   page.id,
      page_type: page.page_type,
      outcome:   "repaired",
      old_url:   page.url,
      new_url:   replacement,
    });
  }

  return results;
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "heal-coverage", status: "in_progress" });

  try {
    // ── 1. Load broken pages ─────────────────────────────────────────────────
    // Order: unresolved first (likely wrong URL), then blocked (consistently failing).
    // Limit to MAX_PAGES_PER_RUN — subsequent runs clear the remainder.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brokenRows, error: brokenErr } = await (supabase as any)
      .from("monitored_pages")
      .select("id, url, page_type, health_state, competitor_id")
      .in("health_state", [...BROKEN_STATES])
      .eq("active", true)
      .order("health_state", { ascending: true }) // unresolved < blocked alphabetically
      .limit(MAX_PAGES_PER_RUN);

    if (brokenErr) throw brokenErr;

    const brokenPages = (brokenRows ?? []) as unknown as BrokenPage[];

    if (brokenPages.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "heal-coverage", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true, job: "heal-coverage",
        broken_found: 0, repaired: 0, self_healed: 0, unresolvable: 0,
      });
    }

    // ── 2. Load competitor info ──────────────────────────────────────────────
    const competitorIds = [...new Set(brokenPages.map((p) => p.competitor_id))];

    const { data: competitorRows, error: compErr } = await supabase
      .from("competitors")
      .select("id, name, website_url")
      .in("id", competitorIds);

    if (compErr) throw compErr;

    const competitorMap = new Map<string, CompetitorInfo>(
      ((competitorRows ?? []) as CompetitorInfo[]).map((c) => [c.id, c])
    );

    // ── 3. Sector lookup ─────────────────────────────────────────────────────
    // competitors table has no sector column — resolve via tracked_competitors → organizations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tracked } = await (supabase as any)
      .from("tracked_competitors")
      .select("competitor_id, org_id")
      .in("competitor_id", competitorIds);

    const orgIds = [
      ...new Set(
        ((tracked ?? []) as { competitor_id: string; org_id: string }[]).map((r) => r.org_id)
      ),
    ];

    const sectorMap = new Map<string, string>();

    if (orgIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgs } = await (supabase as any)
        .from("organizations")
        .select("id, sector")
        .in("id", orgIds);

      const orgSectors = new Map<string, string>(
        ((orgs ?? []) as { id: string; sector: string }[]).map((o) => [o.id, o.sector])
      );

      for (const { competitor_id, org_id } of (tracked ?? []) as {
        competitor_id: string;
        org_id: string;
      }[]) {
        const sector = orgSectors.get(org_id);
        if (sector) sectorMap.set(competitor_id, sector);
      }
    }

    // ── 4. Group by competitor, process in chunks ────────────────────────────
    // Grouping ensures discoverCandidates() runs once per competitor regardless
    // of how many broken pages it has.
    const byCompetitor = new Map<string, BrokenPage[]>();
    for (const p of brokenPages) {
      const list = byCompetitor.get(p.competitor_id) ?? [];
      list.push(p);
      byCompetitor.set(p.competitor_id, list);
    }

    const allResults: HealResult[] = [];
    let errors = 0;

    const competitorEntries = [...byCompetitor.entries()];

    for (let i = 0; i < competitorEntries.length; i += CONCURRENCY) {
      const chunk = competitorEntries.slice(i, i + CONCURRENCY);

      const chunkResults = await Promise.allSettled(
        chunk.map(async ([competitorId, pages]) => {
          const competitor = competitorMap.get(competitorId);
          if (!competitor) return [] as HealResult[];

          const sector = sectorMap.get(competitorId) ?? "saas";
          return healCompetitorPages(pages, competitor, sector);
        })
      );

      for (const r of chunkResults) {
        if (r.status === "fulfilled") {
          allResults.push(...r.value);
        } else {
          errors++;
          Sentry.captureException(r.reason);
        }
      }
    }

    // ── 5. Summarize and emit ─────────────────────────────────────────────────
    const repaired      = allResults.filter((r) => r.outcome === "repaired").length;
    const selfHealed    = allResults.filter((r) => r.outcome === "self_healed").length;
    const unresolvable  = allResults.filter((r) => r.outcome === "unresolvable").length;
    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("heal_coverage", {
      broken_found:   brokenPages.length,
      repaired,
      self_healed:    selfHealed,
      unresolvable,
      errors,
      runtimeDurationMs,
    });

    if (repaired > 0) {
      Sentry.captureMessage(`heal_coverage: ${repaired} URLs repaired, ${selfHealed} self-healed`, "info");
    }

    Sentry.captureCheckIn({ monitorSlug: "heal-coverage", status: "ok", checkInId });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok: true,
      job: "heal-coverage",
      broken_found:   brokenPages.length,
      repaired,
      self_healed:    selfHealed,
      unresolvable,
      errors,
      runtimeDurationMs,
    });

  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "heal-coverage", status: "error", checkInId });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("heal-coverage", handler);
