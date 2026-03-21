import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import crypto from "crypto";
import * as cheerio from "cheerio";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

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

const NOISE_SELECTORS = [
  "nav", "footer", "aside",
  "script", "style", "noscript",
  "[aria-hidden='true']",
  "[role='banner']", "[role='navigation']", "[role='complementary']",
  ".cookie-banner", ".cookie-notice", "#cookie-notice",
  ".consent-banner", "#consent-banner",
  ".gdpr-banner", "#gdpr-banner",
  ".cc-banner", "#cc-banner",
  ".chat-widget", "#chat-widget",
  "#intercom-container", ".intercom-lightweight-app",
  "#hubspot-messages-iframe-container",
  ".drift-widget", "#drift-widget",
  "#crisp-chatbox",
  ".announcement-bar", ".promo-bar",
  ".notification-bar", ".alert-bar",
  "[data-nosnippet]",
];

const BROAD_SELECTORS = new Set(["main", "body", "article", "#content", ".content"]);

function cleanText(text: string): string {
  let t = text.normalize("NFC");
  t = t.replace(/[\u00A0\u200B\u200C\u200D\u2009\u2060\uFEFF]/g, " ");
  t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  t = t.replace(/[\u2013\u2014]/g, "-");
  return t.replace(/\s+/g, " ").trim();
}

function validateText(
  text: string,
  rule: ExtractionRuleRow
): { validation_status: ValidationStatus; validation_failure: string | null } {
  if (!text) return { validation_status: "failed", validation_failure: "empty_extraction" };

  if (rule.min_length !== null && text.length < rule.min_length) {
    return { validation_status: "suspect", validation_failure: "below_min_length" };
  }

  if (rule.max_length !== null && text.length > rule.max_length) {
    return { validation_status: "suspect", validation_failure: "above_max_length" };
  }

  if (rule.required_pattern) {
    try {
      if (!new RegExp(rule.required_pattern, "i").test(text)) {
        return { validation_status: "suspect", validation_failure: "missing_required_pattern" };
      }
    } catch {
      return { validation_status: "failed", validation_failure: "invalid_required_pattern" };
    }
  }

  return { validation_status: "valid", validation_failure: null };
}

// Accepts a pre-parsed Cheerio root — avoids re-parsing raw_html per rule.
function extractSectionText(
  $: cheerio.CheerioAPI,
  selector: string
): { selector_status: SelectorStatus; section_text: string } {
  try {
    const nodes = $(selector);

    if (!nodes.length) return { selector_status: "missing", section_text: "" };

    if (BROAD_SELECTORS.has(selector.toLowerCase().trim())) {
      for (const noise of NOISE_SELECTORS) {
        nodes.find(noise).remove();
      }
    }

    const text = cleanText(nodes.text());
    return { selector_status: text ? "healthy" : "empty", section_text: text };
  } catch {
    return { selector_status: "invalid_selector", section_text: "" };
  }
}

// Minimal semaphore for bounded snapshot concurrency.
function createSemaphore(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return function acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        running++;
        fn().then(
          (v) => { running--; if (queue.length) queue.shift()!(); resolve(v); },
          (e) => { running--; if (queue.length) queue.shift()!(); reject(e); }
        );
      };
      if (running < max) run(); else queue.push(run);
    });
  };
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "extract-sections", status: "in_progress" });

  try {
    // Pre-pass: shell and js_rendered snapshots are intentionally not extracted
    // (bot walls / JS-heavy pages produce empty sections that pollute baselines).
    // Mark them done immediately so they don't accumulate as orphaned rows and
    // don't trigger false-positive backlog warnings in the health check.
    await supabase
      .from("snapshots")
      .update({
        sections_extracted: true,
        sections_extracted_at: new Date().toISOString(),
        raw_html: null,
      })
      .eq("sections_extracted", false)
      .in("fetch_quality", ["shell", "js_rendered"]);

    const batchSize = 25; // lowered from 50 — halves peak memory (raw_html × N) with no coverage loss at 15min cadence

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("snapshots")
      .select("id, monitored_page_id, raw_html")
      .eq("sections_extracted", false)
      .eq("fetch_quality", "full")
      .order("fetched_at", { ascending: true })
      .limit(batchSize);

    if (snapshotsError) throw snapshotsError;

    const pendingSnapshots = (snapshots ?? []) as SnapshotRow[];
    const monitoredPageIds = [...new Set(pendingSnapshots.map((s) => s.monitored_page_id))];

    const { data: rules, error: rulesError } = await supabase
      .from("extraction_rules")
      .select("monitored_page_id, section_type, selector, min_length, max_length, required_pattern")
      .in("monitored_page_id", monitoredPageIds)
      .eq("active", true);

    if (rulesError) throw rulesError;

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

    const sectionsWrittenByPage = new Map<string, number>();
    const allFailedPageIds = new Set<string>(); // pages where every section failed in this batch

    // ── Bounded concurrency across snapshots ──────────────────────────────────
    // Cheerio parsing is CPU-bound; DB writes are I/O-bound. Running 5 in parallel
    // keeps the Vercel function busy without overwhelming the Supabase connection pool.
    const sem = createSemaphore(5);

    const results = await Promise.allSettled(
      pendingSnapshots.map((snapshot) =>
        sem(async () => {
          const elapsed = startTimer();
          const pageRules = rulesByPage.get(snapshot.monitored_page_id) ?? [];

          if (pageRules.length === 0) {
            // No rules — mark extracted and release raw_html storage.
            const { error: skipMarkError } = await supabase
              .from("snapshots")
              .update({
                sections_extracted: true,
                sections_extracted_at: new Date().toISOString(),
                raw_html: null,
              })
              .eq("id", snapshot.id);
            if (skipMarkError) throw skipMarkError;
            void recordEvent({ run_id: runId, stage: "extract", status: "skipped", monitored_page_id: snapshot.monitored_page_id, snapshot_id: snapshot.id, duration_ms: elapsed(), metadata: { sections_found: 0, validation_state: "skipped", rule_count: 0 } });
            return { skippedNoRules: true, sectionsWritten: 0, pageId: snapshot.monitored_page_id, snapshotId: snapshot.id };
          }

          // ── Parse HTML once per snapshot ─────────────────────────────────────
          // Previously parsed once per rule — O(rules) parses per snapshot.
          // Now parsed once, all rules share the same $ handle.
          const $ = cheerio.load(snapshot.raw_html);

          // ── Extract all sections and prepare bulk upsert payload ─────────────
          const sectionRows: Record<string, unknown>[] = [];

          for (const rule of pageRules) {
            const extracted = extractSectionText($, rule.selector);
            const sectionText = extracted.section_text;
            const sectionHash = crypto.createHash("sha256").update(sectionText).digest("hex");
            const { validation_status, validation_failure } = validateText(sectionText, rule);

            sectionRows.push({
              snapshot_id:        snapshot.id,
              monitored_page_id:  snapshot.monitored_page_id,
              section_type:       rule.section_type,
              section_text:       sectionText,
              section_hash:       sectionHash,
              extraction_status:  validation_status === "failed" ? "failed" : "success",
              selector_status:    extracted.selector_status,
              consecutive_empty:  sectionText ? 0 : 1,
              content_length:     sectionText.length,
              word_count:         sectionText ? sectionText.split(/\s+/).length : 0,
              validation_status,
              validation_failure,
              parser_version:     "v1",
              structured_content: null,
            });
          }

          // ── Bulk upsert all sections for this snapshot in one DB call ─────────
          // Replaces one upsert per rule — reduces round-trips from N_rules to 1.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertError } = await supabase
            .from("page_sections")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(sectionRows as any[], { onConflict: "snapshot_id,section_type" });

          if (upsertError) throw upsertError;

          // Release raw_html — sections extracted, HTML no longer needed.
          const { error: markError } = await supabase
            .from("snapshots")
            .update({
              sections_extracted: true,
              sections_extracted_at: new Date().toISOString(),
              raw_html: null,
            })
            .eq("id", snapshot.id);

          if (markError) throw markError;

          const worstValidation =
            sectionRows.some((r) => r.validation_status === "failed") ? "failed" :
            sectionRows.some((r) => r.validation_status === "suspect") ? "suspect" : "valid";

          void recordEvent({ run_id: runId, stage: "extract", status: "success", monitored_page_id: snapshot.monitored_page_id, snapshot_id: snapshot.id, duration_ms: elapsed(), metadata: { sections_found: sectionRows.length, validation_state: worstValidation, rule_count: pageRules.length } });

          const allSectionsFailed =
            sectionRows.length > 0 && sectionRows.every((r) => r.validation_status === "failed");

          return {
            skippedNoRules: false,
            sectionsWritten: sectionRows.length,
            pageId: snapshot.monitored_page_id,
            snapshotId: snapshot.id,
            allSectionsFailed,
          };
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const snap   = pendingSnapshots[i];
      rowsProcessed += 1;
      if (result.status === "rejected") {
        rowsFailed += 1;
        Sentry.captureException(result.reason);
        void recordEvent({ run_id: runId, stage: "extract", status: "failure", monitored_page_id: snap.monitored_page_id, snapshot_id: snap.id, metadata: { sections_found: 0, validation_state: "failed", rule_count: rulesByPage.get(snap.monitored_page_id)?.length ?? 0 } });

        // ── Quarantine: snapshots that fail extraction 3+ times are removed from
        // the queue to prevent infinite retry loops from poisoned HTML.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count: failCount } = await (supabase as any)
            .from("pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "extract")
            .eq("status", "failure")
            .eq("snapshot_id", snap.id);

          if ((failCount ?? 0) >= 3) {
            await supabase
              .from("snapshots")
              .update({ sections_extracted: true, raw_html: null } as Record<string, unknown>)
              .eq("id", snap.id);
            Sentry.captureMessage("snapshot_quarantined", {
              level: "warning",
              extra: { snapshot_id: snap.id, monitored_page_id: snap.monitored_page_id, fail_count: failCount },
            });
          }
        } catch (quarantineErr) {
          // Non-fatal — quarantine failure must never block pipeline
          Sentry.captureException(quarantineErr);
        }
      } else {
        rowsSucceeded += 1;
        if (result.value.skippedNoRules) {
          rowsSkippedNoRules += 1;
        } else {
          sectionsWritten += result.value.sectionsWritten;
          sectionsWrittenByPage.set(
            result.value.pageId,
            (sectionsWrittenByPage.get(result.value.pageId) ?? 0) + result.value.sectionsWritten
          );
          if (result.value.allSectionsFailed) {
            allFailedPageIds.add(result.value.pageId);
          }
        }
      }
    }

    // ── Extraction drift detection ─────────────────────────────────────────────
    if (sectionsWrittenByPage.size > 0) {
      try {
        const processedPageIds = [...sectionsWrittenByPage.keys()];
        const currentBatchSnapshotIds = new Set(pendingSnapshots.map((s) => s.id));

        // Limit scales with pages processed — 10 historical snapshots per page is
        // sufficient for the 5-snapshot rolling average, with 2× headroom.
        const { data: recentSectionRows } = await supabase
          .from("page_sections")
          .select("monitored_page_id, snapshot_id")
          .in("monitored_page_id", processedPageIds)
          .order("created_at", { ascending: false })
          .limit(processedPageIds.length * 10);

        const historicalRows = (recentSectionRows ?? []).filter(
          (r) => !currentBatchSnapshotIds.has((r as { snapshot_id: string }).snapshot_id)
        );

        if (historicalRows.length > 0) {
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
            if (!pageSnaps || pageSnaps.size === 0) continue;

            const historyCounts = [...pageSnaps.values()].slice(0, 5);
            const avgCount = historyCounts.reduce((a, b) => a + b, 0) / historyCounts.length;

            if (avgCount >= 2) {
              const deviation = Math.abs(currentCount - avgCount) / avgCount;
              const absoluteDelta = Math.abs(currentCount - avgCount);
              if (deviation > 0.6 && absoluteDelta >= 2) {
                Sentry.captureMessage("extraction_drift_detected", {
                  level: "warning",
                  extra: {
                    monitored_page_id:             pageId,
                    current_section_count:         currentCount,
                    historical_avg_section_count:  parseFloat(avgCount.toFixed(1)),
                    deviation_pct:                 Math.round(deviation * 100),
                    prior_snapshots_sampled:        historyCounts.length,
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

    // ── Degraded state detection ───────────────────────────────────────────────
    // A page is degraded when fetch succeeds but section extraction repeatedly fails.
    // Gate: all sections failed in this batch AND ≥2 of the last 3 prior snapshot
    // batches for the same page also had all-failed sections.
    // Only downgrades pages currently 'healthy' — never overwrites blocked/challenge.
    let pagesDegradedCount = 0;
    if (allFailedPageIds.size > 0) {
      try {
        const failedIds = [...allFailedPageIds];
        const currentBatchSnapshotIdSet = new Set(pendingSnapshots.map((s) => s.id));

        // Fetch recent section history for failed pages.
        // 15 rows per page provides enough headroom for 3 prior snapshots × 5 sections.
        const { data: historyRows } = await supabase
          .from("page_sections")
          .select("monitored_page_id, snapshot_id, validation_status")
          .in("monitored_page_id", failedIds)
          .order("created_at", { ascending: false })
          .limit(failedIds.length * 15);

        // Group by page → snapshot → [validation_statuses], excluding current batch.
        const sectionsByPageSnap = new Map<string, Map<string, string[]>>();
        for (const row of (historyRows ?? [])) {
          const r = row as { monitored_page_id: string; snapshot_id: string; validation_status: string };
          if (currentBatchSnapshotIdSet.has(r.snapshot_id)) continue;
          if (!sectionsByPageSnap.has(r.monitored_page_id)) {
            sectionsByPageSnap.set(r.monitored_page_id, new Map());
          }
          const snapMap = sectionsByPageSnap.get(r.monitored_page_id)!;
          if (!snapMap.has(r.snapshot_id)) snapMap.set(r.snapshot_id, []);
          snapMap.get(r.snapshot_id)!.push(r.validation_status);
        }

        const degradePageIds: string[] = [];
        for (const pageId of failedIds) {
          const snapMap = sectionsByPageSnap.get(pageId);
          if (!snapMap || snapMap.size === 0) continue; // no prior history yet

          // Check last 3 prior snapshots: count how many were all-failed.
          const priorSnapshots = [...snapMap.entries()].slice(0, 3);
          const allFailedCount = priorSnapshots.filter(([, statuses]) =>
            statuses.length > 0 && statuses.every((s) => s === "failed")
          ).length;

          if (allFailedCount >= 2) {
            degradePageIds.push(pageId);
          }
        }

        if (degradePageIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: degradeError } = await supabase
            .from("monitored_pages")
            .update({ health_state: "degraded" } as any)
            .in("id", degradePageIds)
            .eq("health_state", "healthy"); // only downgrade from healthy — never touch blocked/challenge

          if (degradeError) {
            Sentry.captureException(degradeError);
          } else {
            pagesDegradedCount = degradePageIds.length;
          }
        }
      } catch (degradedError) {
        // Non-fatal — degraded detection must never block pipeline output.
        Sentry.captureException(degradedError);
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
      pagesDegradedCount,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "extract-sections", status: "ok", checkInId });
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
      pagesDegradedCount,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "extract-sections", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("extract-sections", handler);
