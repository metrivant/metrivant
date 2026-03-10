import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

interface PageSectionRow {
  id: string;
  section_text: string;
  section_hash: string;
}

function classifySignal(
  sectionType: string,
  previousText: string,
  currentText: string
) {
  if (sectionType === "pricing_plans") {
    return {
      signal_type: "price_point_change",
      severity: "high",
      signal_data: {
        previous_excerpt: previousText.slice(0, 200),
        current_excerpt: currentText.slice(0, 200),
      },
    };
  }

  if (sectionType === "hero") {
    return {
      signal_type: "positioning_shift",
      severity: "medium",
      signal_data: {
        previous_excerpt: previousText.slice(0, 200),
        current_excerpt: currentText.slice(0, 200),
      },
    };
  }

  if (sectionType === "release_feed") {
    return {
      signal_type: "feature_launch",
      severity: "medium",
      signal_data: {
        previous_excerpt: previousText.slice(0, 200),
        current_excerpt: currentText.slice(0, 200),
      },
    };
  }

  return {
    signal_type: "content_change",
    severity: "low",
    signal_data: {
      previous_excerpt: previousText.slice(0, 200),
      current_excerpt: currentText.slice(0, 200),
    },
  };
}

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  let rowsClaimed = 0;
  let rowsProcessed = 0;
  let rowsSucceeded = 0;
  let rowsFailed = 0;
  let signalsCreated = 0;

  Sentry.captureCheckIn({
    monitorSlug: "detect-signals",
    status: "in_progress",
  });

  try {
    const { data: diffs, error } = await supabase
      .from("section_diffs")
      .select("*")
      .eq("confirmed", true)
      .eq("signal_detected", false)
      .eq("is_noise", false)
      .order("last_seen_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    rowsClaimed = diffs?.length ?? 0;

    for (const diff of diffs ?? []) {
      rowsProcessed += 1;

      try {
        if (!diff.previous_section_id || !diff.current_section_id) {
          throw new Error(`Diff ${diff.id} missing section references`);
        }

        const { data: previousSection } = await supabase
          .from("page_sections")
          .select("id, section_text, section_hash")
          .eq("id", diff.previous_section_id)
          .maybeSingle();

        const { data: currentSection } = await supabase
          .from("page_sections")
          .select("id, section_text, section_hash")
          .eq("id", diff.current_section_id)
          .maybeSingle();

        const previous = previousSection as PageSectionRow | null;
        const current = currentSection as PageSectionRow | null;

        if (!previous || !current) {
          throw new Error(`Diff ${diff.id} missing section rows`);
        }

        const signal = classifySignal(
          diff.section_type,
          previous.section_text,
          current.section_text
        );

        const { error: upsertError } = await supabase
          .from("signals")
          .upsert(
            {
              section_diff_id: diff.id,
              monitored_page_id: diff.monitored_page_id,
              signal_type: signal.signal_type,
              signal_data: signal.signal_data,
              severity: signal.severity,
              detected_at: diff.last_seen_at,
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

        if (upsertError) throw upsertError;

        const { error: updateDiffError } = await supabase
          .from("section_diffs")
          .update({
            signal_detected: true,
            last_error: null,
          })
          .eq("id", diff.id);

        if (updateDiffError) throw updateDiffError;

        rowsSucceeded += 1;signalsCreated += 1;
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