import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import * as cheerio from "cheerio";

interface SnapshotRow {
  id: string;
  monitored_page_id: string;
  raw_html: string;
}

interface ExtractionRuleRow {
  monitored_page_id: string;
  section_type: string;
  selector: string;
  min_length: number | null;
  max_length: number | null;
  required_pattern: string | null;
}

type ValidationStatus = "valid" | "suspect" | "failed";
type SelectorStatus = "healthy" | "missing" | "empty" | "invalid_selector";

// Noise elements to strip from broad selectors before text extraction.
// These bleed into main/body/article and produce false diffs on layout changes.
const NOISE_SELECTORS = [
  "nav", "footer", "aside",
  "script", "style", "noscript",
  "[aria-hidden='true']",
  "[role='banner']", "[role='navigation']", "[role='complementary']",
  // Cookie and consent banners
  ".cookie-banner", ".cookie-notice", "#cookie-notice",
  ".consent-banner", "#consent-banner",
  ".gdpr-banner", "#gdpr-banner",
  ".cc-banner", "#cc-banner",
  // Chat and support widgets
  ".chat-widget", "#chat-widget",
  "#intercom-container", ".intercom-lightweight-app",
  "#hubspot-messages-iframe-container",
  ".drift-widget", "#drift-widget",
  "#crisp-chatbox",
  // Promotional bars (rotate frequently, low-signal)
  ".announcement-bar", ".promo-bar",
  ".notification-bar", ".alert-bar",
  // Bot/crawl barriers (nosnippet hints)
  "[data-nosnippet]",
];

// Broad selectors that capture the full document or major regions:
// noise stripping is applied only to these to avoid over-stripping narrow selectors.
const BROAD_SELECTORS = new Set(["main", "body", "article", "#content", ".content"]);

function cleanText(text: string): string {
  // Normalize combining characters (café = caf + combining e → café)
  let t = text.normalize("NFC");
  // Replace non-breaking and zero-width spaces with plain space
  t = t.replace(/[\u00A0\u200B\u200C\u200D\u2009\u2060\uFEFF]/g, " ");
  // Normalize smart quotes/apostrophes to ASCII
  t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  // Normalize em/en dashes to hyphen
  t = t.replace(/[\u2013\u2014]/g, "-");
  // Collapse whitespace
  return t.replace(/\s+/g, " ").trim();
}

function validateText(
  text: string,
  rule: ExtractionRuleRow
): {
  validation_status: ValidationStatus;
  validation_failure: string | null;
} {
  if (!text) {
    return {
      validation_status: "failed",
      validation_failure: "empty_extraction",
    };
  }

  if (rule.min_length !== null && text.length < rule.min_length) {
    return {
      validation_status: "suspect",
      validation_failure: "below_min_length",
    };
  }

  if (rule.max_length !== null && text.length > rule.max_length) {
    return {
      validation_status: "suspect",
      validation_failure: "above_max_length",
    };
  }

  if (rule.required_pattern) {
    try {
      const regex = new RegExp(rule.required_pattern, "i");

      if (!regex.test(text)) {
        return {
          validation_status: "suspect",
          validation_failure: "missing_required_pattern",
        };
      }
    } catch {
      return {
        validation_status: "failed",
        validation_failure: "invalid_required_pattern",
      };
    }
  }

  return {
    validation_status: "valid",
    validation_failure: null,
  };
}

function extractSectionText(
  rawHtml: string,
  selector: string
): {
  selector_status: SelectorStatus;
  section_text: string;
} {
  try {
    const $ = cheerio.load(rawHtml);
    const nodes = $(selector);

    if (!nodes.length) {
      return {
        selector_status: "missing",
        section_text: "",
      };
    }

    // Strip noise elements for broad selectors to prevent nav/footer/script bleed.
    // Narrow selectors (h1, h2, .pricing) are left untouched.
    if (BROAD_SELECTORS.has(selector.toLowerCase().trim())) {
      for (const noise of NOISE_SELECTORS) {
        nodes.find(noise).remove();
      }
    }

    const text = cleanText(nodes.text());

    return {
      selector_status: text ? "healthy" : "empty",
      section_text: text,
    };
  } catch {
    return {
      selector_status: "invalid_selector",
      section_text: "",
    };
  }
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "extract-sections",
    status: "in_progress",
  });

  try {
    const batchSize = 50;

    // Only process 'full' quality snapshots. 'shell' (bot wall) and
    // 'js_rendered' (SPA) snapshots are stored for diagnostics and the
    // auto-deactivation trigger but will never yield valid sections.
    // Using .eq('full') is future-proof: any new non-full quality level
    // is automatically excluded without a code change here.
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("snapshots")
      .select("id, monitored_page_id, raw_html")
      .eq("sections_extracted", false)
      .eq("fetch_quality", "full")
      .order("fetched_at", { ascending: true })
      .limit(batchSize);

    if (snapshotsError) {
      throw snapshotsError;
    }

    const pendingSnapshots = (snapshots ?? []) as SnapshotRow[];
    const monitoredPageIds = [...new Set(pendingSnapshots.map((s) => s.monitored_page_id))];

    const { data: rules, error: rulesError } = await supabase
      .from("extraction_rules")
      .select(
        `
        monitored_page_id,
        section_type,
        selector,
        min_length,
        max_length,
        required_pattern
      `
      )
      .in("monitored_page_id", monitoredPageIds)
      .eq("active", true);

    if (rulesError) {
      throw rulesError;
    }

    const rulesByPage = new Map<string, ExtractionRuleRow[]>();

    for (const rule of (rules ?? []) as ExtractionRuleRow[]) {
      const existing = rulesByPage.get(rule.monitored_page_id) ?? [];
      existing.push(rule);
      rulesByPage.set(rule.monitored_page_id, existing);
    }

    const rowsClaimed = pendingSnapshots.length;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let sectionsWritten = 0;
    let rowsSkippedNoRules = 0;
    let driftWarnings = 0;

    // Track sections written per page this run for drift comparison.
    const sectionsWrittenByPage = new Map<string, number>();

    for (const snapshot of pendingSnapshots) {
      rowsProcessed += 1;

      try {
        const pageRules = rulesByPage.get(snapshot.monitored_page_id) ?? [];

        if (pageRules.length === 0) {
          rowsSkippedNoRules += 1;
          Sentry.addBreadcrumb({
            category: "pipeline",
            message: "Snapshot skipped: no active extraction rules",
            level: "warning",
            data: { snapshot_id: snapshot.id, monitored_page_id: snapshot.monitored_page_id },
          });
          // Mark as extracted and immediately release raw_html storage.
          // Snapshots with no extraction rules will never be re-processed —
          // raw_html serves no purpose after this point.
          const { error: skipMarkError } = await supabase
            .from("snapshots")
            .update({
              sections_extracted: true,
              sections_extracted_at: new Date().toISOString(),
              raw_html: null,
            })
            .eq("id", snapshot.id);
          if (skipMarkError) throw skipMarkError;
          continue;
        }

        for (const rule of pageRules) {
          const extracted = extractSectionText(snapshot.raw_html, rule.selector);
          const sectionText = extracted.section_text;
          const sectionHash = crypto
            .createHash("sha256")
            .update(sectionText)
            .digest("hex");

          const contentLength = sectionText.length;
          const wordCount = sectionText ? sectionText.split(/\s+/).length : 0;

          const { validation_status, validation_failure } = validateText(
            sectionText,
            rule
          );

          const { error: upsertError } = await supabase
            .from("page_sections")
            .upsert(
              {
                snapshot_id: snapshot.id,
                monitored_page_id: snapshot.monitored_page_id,
                section_type: rule.section_type,
                section_text: sectionText,
                section_hash: sectionHash,
                extraction_status: validation_status === "failed" ? "failed" : "success",
                selector_status: extracted.selector_status,
                consecutive_empty: sectionText ? 0 : 1,
                content_length: contentLength,
                word_count: wordCount,
                validation_status,
                validation_failure,
                parser_version: "v1",
                structured_content: null,
              },
              {
                onConflict: "snapshot_id,section_type",
              }
            );

          if (upsertError) {
            throw upsertError;
          }

          sectionsWritten += 1;
          sectionsWrittenByPage.set(
            snapshot.monitored_page_id,
            (sectionsWrittenByPage.get(snapshot.monitored_page_id) ?? 0) + 1
          );
        }

        // Release raw_html immediately — sections are extracted, HTML is no longer
        // needed. Nulling here instead of the 90-day retention cron prevents
        // unbounded storage growth (100KB × crawl volume = grotesque at scale).
        const { error: markError } = await supabase
          .from("snapshots")
          .update({
            sections_extracted: true,
            sections_extracted_at: new Date().toISOString(),
            raw_html: null,
          })
          .eq("id", snapshot.id);

        if (markError) {
          throw markError;
        }

        rowsSucceeded += 1;
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
      }
    }

    // ── Extraction drift detection ─────────────────────────────────────────────
    // Compare sections written for each page this run against its recent history.
    // A >60% deviation in section count indicates a site redesign, selector rot,
    // or CDN/render change that silently degrades extraction quality.
    if (sectionsWrittenByPage.size > 0) {
      try {
        const processedPageIds = [...sectionsWrittenByPage.keys()];
        const currentBatchSnapshotIds = new Set(pendingSnapshots.map((s) => s.id));

        // Fetch recent section rows across all processed pages (generous limit).
        // Filter current batch in TypeScript to avoid PostgREST NOT IN complexity.
        const { data: recentSectionRows } = await supabase
          .from("page_sections")
          .select("monitored_page_id, snapshot_id")
          .in("monitored_page_id", processedPageIds)
          .order("created_at", { ascending: false })
          .limit(600);

        const historicalRows = (recentSectionRows ?? []).filter(
          (r) => !currentBatchSnapshotIds.has((r as { snapshot_id: string }).snapshot_id)
        );

        if (historicalRows.length > 0) {
          // Group by page → snapshot → section count.
          const snapCountsByPage = new Map<string, Map<string, number>>();
          for (const r of historicalRows) {
            const row = r as { monitored_page_id: string; snapshot_id: string };
            if (!snapCountsByPage.has(row.monitored_page_id)) {
              snapCountsByPage.set(row.monitored_page_id, new Map());
            }
            const smap = snapCountsByPage.get(row.monitored_page_id)!;
            smap.set(row.snapshot_id, (smap.get(row.snapshot_id) ?? 0) + 1);
          }

          for (const [pageId, currentCount] of sectionsWrittenByPage) {
            const pageSnaps = snapCountsByPage.get(pageId);
            if (!pageSnaps || pageSnaps.size === 0) continue; // no history yet

            // Average over up to 5 most-recent prior snapshots.
            const historyCounts = [...pageSnaps.values()].slice(0, 5);
            const avgCount = historyCounts.reduce((a, b) => a + b, 0) / historyCounts.length;

            // Only evaluate pages with a meaningful historical baseline (≥2 avg sections).
            // Pages with avgCount=1 trivially hit 100% deviation on any change — these
            // are single-rule pages where variance is expected and not indicative of
            // extraction rot.
            if (avgCount >= 2) {
              const deviation = Math.abs(currentCount - avgCount) / avgCount;
              // Also require an absolute delta of ≥2 sections to suppress noise on
              // low-section pages (e.g., avg=2 → current=3 is 50% relative but 1 section absolute).
              const absoluteDelta = Math.abs(currentCount - avgCount);
              if (deviation > 0.6 && absoluteDelta >= 2) {
                Sentry.captureMessage("extraction_drift_detected", {
                  level: "warning",
                  extra: {
                    monitored_page_id: pageId,
                    current_section_count: currentCount,
                    historical_avg_section_count: parseFloat(avgCount.toFixed(1)),
                    deviation_pct: Math.round(deviation * 100),
                    prior_snapshots_sampled: historyCounts.length,
                  },
                });
                driftWarnings += 1;
              }
            }
          }
        }
      } catch (driftError) {
        // Non-fatal — drift detection must never block pipeline output.
        Sentry.captureException(driftError);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "extract-sections",
      batch_size: rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsSkippedNoRules,
      sectionsWritten,
      driftWarnings,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "extract-sections",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "extract-sections",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsSkippedNoRules,
      sectionsWritten,
      driftWarnings,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "extract-sections",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("extract-sections", handler);