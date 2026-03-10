import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

interface SectionDiffRow {
  id: string;
  monitored_page_id: string;
  section_type: string;
  previous_section_id: string | null;
  current_section_id: string | null;
  detected_at: string;
}

interface PageSectionRow {
  id: string;
  section_text: string;
  section_hash: string;
}

function extractPrices(text: string): string[] {
  const matches = text.match(/[$£€]\s?\d+(?:[.,]\d{1,2})?/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))].sort();
}

function classifySignal(
  sectionType: string,
  previousText: string,
  currentText: string
): {
  signal_type: string;
  severity: string;
  signal_data: Record<string, unknown>;
} {
  if (sectionType === "pricing_plans") {
    const oldPrices = extractPrices(previousText);
    const newPrices = extractPrices(currentText);

    if (JSON.stringify(oldPrices) !== JSON.stringify(newPrices)) {
      return {
        signal_type: "price_point_change",
        severity: "high",
        signal_data: {
          old_prices: oldPrices,
          new_prices: newPrices,
        },
      };
    }

    return {
      signal_type: "tier_change",
      severity: "medium",
      signal_data: {
        previous_excerpt: previousText.slice(0, 300),
        current_excerpt: currentText.slice(0, 300),
      },
    };
  }

  if (sectionType === "hero") {
    return {
      signal_type: "positioning_shift",
      severity: "medium",
      signal_data: {
        previous_excerpt: previousText.slice(0, 300),
        current_excerpt: currentText.slice(0, 300),
      },
    };
  }

  if (sectionType === "release_feed") {
    return {
      signal_type: "feature_launch",
      severity: "medium",
      signal_data: {
        previous_excerpt: previousText.slice(0, 300),
        current_excerpt: currentText.slice(0, 300),
      },
    };
  }

  return {
    signal_type: "content_change",
    severity: "low",
    signal_data: {
      previous_excerpt: previousText.slice(0, 300),
      current_excerpt: currentText.slice(0, 300),
    },
  };
}

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "detect-signals",
    status: "in_progress",
  });

  try {
    const batchSize = 20;

    const { data: diffs, error: diffsError } = await supabase
      .from("section_diffs")
      .select(
        `
        id,
        monitored_page_id,
        section_type,
        previous_section_id,
        current_section_id,
        detected_at
      `
      )
      .eq("status", "confirmed")
      .eq("signal_detected", false)
      .eq("is_noise", false)
      .order("detected_at", { ascending: true })
      .limit(batchSize);

    if (diffsError) {
      throw diffsError;
    }

    const pendingDiffs = (diffs ?? []) as SectionDiffRow[];

    const rowsClaimed = pendingDiffs.length;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let signalsCreated = 0;

    for (const diff of pendingDiffs) {
      rowsProcessed += 1;

      try {
        if (!diff.previous_section_id || !diff.current_section_id) {
          throw new Error(`Diff ${diff.id} missing section references`);
        }

        const { data: previousSection, error: previousError } = await supabase
          .from("page_sections")
          .select("id, section_text, section_hash")
          .eq("id", diff.previous_section_id)
          .maybeSingle();

        if (previousError) {
          throw previousError;
        }

        const { data: currentSection, error: currentError } = await supabase
          .from("page_sections")
          .select("id, section_text, section_hash")
          .eq("id", diff.current_section_id)
          .maybeSingle();

        if (currentError) {
          throw currentError;
        }

        const previous = previousSection as PageSectionRow | null;
        const current = currentSection as PageSectionRow | null;if (!previous || !current) {
          throw new Error(`Diff ${diff.id} has missing section rows`);
        }

        const signal = classifySignal(
          diff.section_type,
          previous.section_text,
          current.section_text
        );

        const { error: upsertSignalError } = await supabase
          .from("signals")
          .upsert(
            {
              section_diff_id: diff.id,
              monitored_page_id: diff.monitored_page_id,
              signal_type: signal.signal_type,
              signal_data: signal.signal_data,
              severity: signal.severity,
              detected_at: diff.detected_at,
              interpreted: false,
              status: "pending",
              retry_count: 0,
              last_error: null,
              is_duplicate: false,
              related_signal_id: null,
            },
            {
              onConflict: "section_diff_id,signal_type",
            }
          );

        if (upsertSignalError) {
          throw upsertSignalError;
        }

        const { error: updateDiffError } = await supabase
          .from("section_diffs")
          .update({
            signal_detected: true,
            last_error: null,
          })
          .eq("id", diff.id);

        if (updateDiffError) {
          throw updateDiffError;
        }

        rowsSucceeded += 1;
        signalsCreated += 1;
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
      signalsCreated,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "detect-signals",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-signals",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      signalsCreated,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "detect-signals",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-signals", handler);