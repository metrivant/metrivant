import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { validateUrl } from "../lib/url-validator";
import { rejectPageUrl } from "../lib/url-guard";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { suggestAlternativeUrls, analyzeDegradedPage } from "../lib/ai-url-resolver";

// ── /api/resolve-coverage ─────────────────────────────────────────────────────
// Daily 05:30 UTC — runs AFTER heal-coverage (05:00).
//
// Handles pages that heal-coverage cannot fix:
//   • blocked/unresolved stuck >48h → AI-powered URL suggestion via GPT-4o-mini
//   • degraded >72h → analyze content + reset baseline OR repair URL
//   • challenge >7d → deactivate (permanently walled, ScrapingBee can't help)
//
// Escalation chain: heal-coverage (heuristic) → resolve-coverage (AI) → deactivate
//
// Safety:
//   • Never touches pages that heal-coverage just processed (48h age gate)
//   • All URL suggestions validated before commit
//   • Deactivation is last resort with Sentry notification
//   • Max 30 pages per run

const MAX_PAGES_PER_RUN = 30;
const BLOCKED_MIN_AGE_HOURS = 48;     // Wait for heal-coverage to try first
const DEGRADED_MIN_AGE_HOURS = 72;    // Degraded may self-resolve
const CHALLENGE_MAX_AGE_DAYS = 7;     // Give ScrapingBee a week

interface StuckPage {
  id:            string;
  url:           string;
  page_type:     string;
  health_state:  string;
  competitor_id: string;
  updated_at:    string;
}

interface CompetitorInfo {
  id:          string;
  name:        string;
  website_url: string;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol + "//" + u.hostname;
  } catch {
    return url;
  }
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "resolve-coverage", status: "in_progress" });

  try {
    // ── Load stuck pages ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pageRows, error: pageErr } = await (supabase as any)
      .from("monitored_pages")
      .select("id, url, page_type, health_state, competitor_id, updated_at")
      .eq("active", true)
      .in("health_state", ["blocked", "unresolved", "degraded", "challenge"])
      .order("updated_at", { ascending: true })
      .limit(MAX_PAGES_PER_RUN);

    if (pageErr) throw pageErr;

    const stuckPages = (pageRows ?? []) as StuckPage[];

    if (stuckPages.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "resolve-coverage", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "resolve-coverage", processed: 0 });
    }

    // ── Load competitor info ──────────────────────────────────────────────
    const compIds = [...new Set(stuckPages.map((p) => p.competitor_id))];
    const { data: compRows } = await supabase
      .from("competitors")
      .select("id, name, website_url")
      .in("id", compIds);

    const compMap = new Map<string, CompetitorInfo>();
    for (const c of (compRows ?? []) as CompetitorInfo[]) {
      compMap.set(c.id, c);
    }

    // ── Process each stuck page ──────────────────────────────────────────
    let repaired = 0;
    let baselineReset = 0;
    let deactivated = 0;
    let skipped = 0;
    let aiAttempts = 0;

    for (const page of stuckPages) {
      const comp = compMap.get(page.competitor_id);
      if (!comp) { skipped++; continue; }

      const ageHours = hoursSince(page.updated_at);
      const domain = extractDomain(comp.website_url);

      // ── BLOCKED / UNRESOLVED — AI URL resolution ──────────────────────
      if ((page.health_state === "blocked" || page.health_state === "unresolved") && ageHours >= BLOCKED_MIN_AGE_HOURS) {

        // First: re-validate current URL (may have self-healed since heal-coverage ran)
        const selfHeal = await validateUrl(page.url).catch(() => ({ ok: false as const }));
        if (selfHeal.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("monitored_pages")
            .update({ health_state: "healthy" })
            .eq("id", page.id);
          repaired++;
          continue;
        }

        // AI suggestion
        aiAttempts++;
        const suggestions = await suggestAlternativeUrls(domain, page.page_type, page.url);

        let found = false;
        for (const candidateUrl of suggestions.urls) {
          // Skip if same as current broken URL
          if (candidateUrl === page.url) continue;

          // Guard check
          const guard = rejectPageUrl(candidateUrl, page.page_type);
          if (guard.reject) continue;

          // Validate
          const validation = await validateUrl(candidateUrl).catch(() => ({ ok: false as const }));
          if (!validation.ok) continue;

          // Unique check — don't create duplicates
          const { count } = await supabase
            .from("monitored_pages")
            .select("id", { count: "exact", head: true })
            .eq("url", candidateUrl);

          if ((count ?? 0) > 0) continue;

          // Commit replacement
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("monitored_pages")
            .update({ url: candidateUrl, health_state: "healthy" })
            .eq("id", page.id);

          repaired++;
          found = true;

          void recordEvent({
            run_id: runId,
            stage: "resolve_coverage",
            status: "success",
            metadata: {
              page_id: page.id,
              action: "ai_url_repair",
              old_url: page.url,
              new_url: candidateUrl,
              competitor: comp.name,
              page_type: page.page_type,
            },
          });
          break;
        }

        if (!found && ageHours > 168) {
          // Stuck > 7 days even after AI — deactivate
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("monitored_pages")
            .update({ active: false })
            .eq("id", page.id);
          deactivated++;

          Sentry.captureMessage("coverage_page_deactivated", {
            level: "warning",
            extra: {
              page_id: page.id,
              competitor: comp.name,
              page_type: page.page_type,
              url: page.url,
              reason: "ai_repair_failed_after_7d",
            },
          });

          void recordEvent({
            run_id: runId,
            stage: "resolve_coverage",
            status: "success",
            metadata: { page_id: page.id, action: "deactivated", reason: "unresolvable_7d", competitor: comp.name },
          });
        } else if (!found) {
          skipped++;
        }
        continue;
      }

      // ── DEGRADED — analyze content quality ────────────────────────────
      if (page.health_state === "degraded" && ageHours >= DEGRADED_MIN_AGE_HOURS) {

        // Check recent snapshots for this page to assess content quality
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sectionRows } = await (supabase as any)
          .from("page_sections")
          .select("id, content")
          .eq("monitored_page_id", page.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const sections = (sectionRows ?? []) as { id: string; content: string | null }[];
        const sectionCount = sections.length;
        const avgLen = sectionCount > 0
          ? sections.reduce((sum, s) => sum + (s.content?.length ?? 0), 0) / sectionCount
          : 0;

        const decision = await analyzeDegradedPage(domain, page.page_type, page.url, sectionCount, avgLen);

        if (decision === "reset_baseline") {
          // Page redesigned but content is still rich — delete old baselines so new ones form
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("section_baselines")
            .delete()
            .eq("monitored_page_id", page.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("monitored_pages")
            .update({ health_state: "baseline_maturing" })
            .eq("id", page.id);

          baselineReset++;
          void recordEvent({
            run_id: runId,
            stage: "resolve_coverage",
            status: "success",
            metadata: { page_id: page.id, action: "baseline_reset", competitor: comp.name, sections: sectionCount, avgLen: Math.round(avgLen) },
          });
        } else {
          // Content too thin — attempt AI URL repair (same as blocked flow)
          aiAttempts++;
          const suggestions = await suggestAlternativeUrls(domain, page.page_type, page.url);

          let found = false;
          for (const candidateUrl of suggestions.urls) {
            if (candidateUrl === page.url) continue;
            const guard = rejectPageUrl(candidateUrl, page.page_type);
            if (guard.reject) continue;
            const validation = await validateUrl(candidateUrl).catch(() => ({ ok: false as const }));
            if (!validation.ok) continue;
            const { count } = await supabase
              .from("monitored_pages")
              .select("id", { count: "exact", head: true })
              .eq("url", candidateUrl);
            if ((count ?? 0) > 0) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("monitored_pages")
              .update({ url: candidateUrl, health_state: "healthy" })
              .eq("id", page.id);
            repaired++;
            found = true;
            void recordEvent({
              run_id: runId,
              stage: "resolve_coverage",
              status: "success",
              metadata: { page_id: page.id, action: "degraded_url_repair", old_url: page.url, new_url: candidateUrl, competitor: comp.name },
            });
            break;
          }
          if (!found) skipped++;
        }
        continue;
      }

      // ── CHALLENGE — deactivate after 7 days ────────────────────────────
      if (page.health_state === "challenge" && ageHours >= CHALLENGE_MAX_AGE_DAYS * 24) {
        // ScrapingBee has had a full week. If it still can't get through, deactivate.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("monitored_pages")
          .update({ active: false })
          .eq("id", page.id);
        deactivated++;

        Sentry.captureMessage("coverage_challenge_deactivated", {
          level: "warning",
          extra: {
            page_id: page.id,
            competitor: comp.name,
            page_type: page.page_type,
            url: page.url,
            reason: "challenge_unresolvable_7d",
          },
        });

        void recordEvent({
          run_id: runId,
          stage: "resolve_coverage",
          status: "success",
          metadata: { page_id: page.id, action: "challenge_deactivated", competitor: comp.name },
        });
        continue;
      }

      // Page doesn't meet age threshold yet — skip for now
      skipped++;
    }

    const runtimeMs = elapsed();

    void recordEvent({
      run_id: runId,
      stage: "resolve_coverage",
      status: "success",
      duration_ms: runtimeMs,
      metadata: {
        processed: stuckPages.length,
        repaired,
        baselineReset,
        deactivated,
        skipped,
        aiAttempts,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "resolve-coverage", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "resolve-coverage",
      processed: stuckPages.length,
      repaired,
      baselineReset,
      deactivated,
      skipped,
      aiAttempts,
      runtimeDurationMs: runtimeMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "resolve-coverage", status: "error", checkInId });
    void recordEvent({
      run_id: runId,
      stage: "resolve_coverage",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("resolve-coverage", handler);
