import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";
import crypto from "crypto";

interface SnapshotRow {
  id: string;
  monitored_page_id: string;
  raw_html: string;
  sections_extracted: boolean;
}

interface ExtractionRule {
  id: string;
  monitored_page_id: string;
  section_type: string;
  selector: string;
  extract_method: string;
  active: boolean;
  min_length: number | null;
  max_length: number | null;
  required_pattern: string | null;
  structure_type: string | null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateText(
  text: string,
  rule: ExtractionRule
): {
  validation_status: "valid" | "suspect" | "failed";
  validation_failure: string | null;
} {
  if (!text || text.trim().length === 0) {
    return {
      validation_status: "failed",
      validation_failure: "empty_extraction",
    };
  }

  if (rule.min_length && text.length < rule.min_length) {
    return {
      validation_status: "suspect",
      validation_failure: "below_min_length",
    };
  }

  if (rule.max_length && text.length > rule.max_length) {
    return {
      validation_status: "suspect",
      validation_failure: "above_max_length",
    };
  }

  if (rule.required_pattern) {
    const regex = new RegExp(rule.required_pattern, "i");
    if (!regex.test(text)) {
      return {
        validation_status: "suspect",
        validation_failure: "missing_required_pattern",
      };
    }
  }

  return {
    validation_status: "valid",
    validation_failure: null,
  };
}

async function handler(req: any, res: any) {
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  Sentry.captureCheckIn(
    {
      monitorSlug: "extract-sections",
      status: "in_progress",
    },
    checkInId
  );

  try {
    const batchSize = 20;

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("snapshots")
      .select("id, monitored_page_id, raw_html, sections_extracted")
      .eq("sections_extracted", false)
      .order("fetched_at", { ascending: true })
      .limit(batchSize);

    if (snapshotsError) {
      throw snapshotsError;
    }

    const pendingSnapshots = (snapshots ?? []) as SnapshotRow[];

    const rowsClaimed = pendingSnapshots.length;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;

    for (const snapshot of pendingSnapshots) {
      rowsProcessed += 1;

      try {
        const { data: rules, error: rulesError } = await supabase
          .from("extraction_rules")
          .select(
            `
            id,
            monitored_page_id,
            section_type,
            selector,
            extract_method,
            active,
            min_length,
            max_length,
            required_pattern,
            structure_type
          `
          )
          .eq("monitored_page_id", snapshot.monitored_page_id)
          .eq("active", true);

        if (rulesError) {
          throw rulesError;
        }

        const activeRules = (rules ?? []) as ExtractionRule[];

        for (const rule of activeRules) {
          const sectionText = stripHtmlToText(snapshot.raw_html);

          const sectionHash = crypto
            .createHash("sha256")
            .update(sectionText)
            .digest("hex");

          const { validation_status, validation_failure } = validateText(
            sectionText,
            rule