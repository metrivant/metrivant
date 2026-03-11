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

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
    const batchSize = 20;

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("snapshots")
      .select("id, monitored_page_id, raw_html")
      .eq("sections_extracted", false)
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
          // Mark as extracted to prevent infinite re-processing on future runs.
          const { error: skipMarkError } = await supabase
            .from("snapshots")
            .update({
              sections_extracted: true,
              sections_extracted_at: new Date().toISOString(),
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
        }

        const { error: markError } = await supabase
          .from("snapshots")
          .update({
            sections_extracted: true,
            sections_extracted_at: new Date().toISOString(),
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

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsSkippedNoRules,
      sectionsWritten,
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